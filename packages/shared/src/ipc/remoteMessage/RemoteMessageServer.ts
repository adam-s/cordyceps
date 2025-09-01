import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { ClientConnectionEvent, IPCServer } from 'vs/base/parts/ipc/common/ipc';
import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import {
  Message,
  CRX_DEEP_RESEARCH_DISCONNECT,
  CRX_DEEP_RESEARCH_HELLO,
  CRX_DEEP_RESEARCH_MESSAGE,
} from '@shared/utils/message';
import { VSBuffer } from 'vs/base/common/buffer';
import { RemoteProtocol } from './RemoteProtocol';
import { Logger, LogComponent } from '@shared/utils/logging';

export class RemoteMessageServer extends IPCServer {
  // Add logger instance
  private static readonly logger = Logger.forComponent('RemoteMessageServer' as LogComponent);

  /**
   * Creates an event emitter for socket messages with transformation
   * @param emitter Socket emitter
   * @param eventName Event name to listen for
   * @param map Function to transform message data
   * @returns Event that emits transformed messages
   */
  static fromMessageEmitter<T>(
    emitter: Socket,
    eventName: string,
    map: (messageBody: Uint8Array, source: string, target: string) => T,
  ): Event<T> {
    this.logger.debug(`Setting up message emitter for event: ${eventName}`);

    const result = new Emitter<T>({
      onWillAddFirstListener: () => {
        this.logger.debug(`Adding first listener for event: ${eventName}`);
        emitter.on(eventName, listener);
      },
      onDidRemoveLastListener: () => {
        this.logger.debug(`Removing last listener for event: ${eventName}`);
        emitter.off(eventName, listener);
      },
    });

    function listener(message: Message) {
      if (message && message.type === eventName) {
        RemoteMessageServer.logger.debug(
          `Received ${eventName} message from ${message.source} to ${message.target}`,
        );

        const messageBody = new Uint8Array(message.body);
        const mapped = map(messageBody, message.source, message.target);
        try {
          result.fire(mapped);
        } catch (error) {
          RemoteMessageServer.logger.error(
            `Error processing ${eventName} message:`,
            error as Error,
          );
        }
      }
    }

    return result.event;
  }

  /**
   * Creates a filtered message event for specific sender and channel
   * @param senderId Source client ID
   * @param channelId Target channel ID
   * @param socket Socket instance
   * @param eventName Event name to listen for
   * @returns Event that emits filtered VSBuffer messages
   */
  static createMessageEvent(
    senderId: string,
    channelId: string | undefined,
    socket: Socket,
    eventName: string = CRX_DEEP_RESEARCH_MESSAGE,
  ): Event<VSBuffer> {
    this.logger.debug(
      `Creating message event for ${eventName}, sender: ${senderId}, channel: ${channelId}`,
    );

    // Create base message event
    const onMessage = this.fromMessageEmitter(socket, eventName, (messageBody, source, target) => {
      this.logger.debug(`Message received: ${eventName}, source: ${source}, target: ${target}`);
      return {
        messageBody,
        source,
        target,
      };
    });

    // Apply message filtering
    const filteredMessage = Event.filter(onMessage, ({ source, target }) => {
      const match = source === senderId && target === channelId;
      if (!match) {
        this.logger.debug(
          `Filtered out message: source=${source}, target=${target} (expected: source=${senderId}, target=${channelId})`,
        );
      }
      return match;
    });

    // Transform to VSBuffer
    return Event.map(filteredMessage, ({ messageBody }) => {
      this.logger.debug(`Transforming message to VSBuffer, length: ${messageBody.length}`);
      return VSBuffer.wrap(messageBody);
    });
  }

  /**
   * Creates and configures a socket.io server instance
   * @param httpServer The HTTP server to attach the socket.io server to
   * @param path The path for the socket.io server
   * @returns Configured socket.io Server instance
   */
  static createServer(httpServer: HttpServer, path = '/socket'): Server {
    RemoteMessageServer.logger.debug(`Creating server with path: ${path}`);
    const io = new Server(httpServer, {
      path,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      // Add transports configuration
      transports: ['websocket', 'polling'],
      maxHttpBufferSize: 1e8,
    });

    RemoteMessageServer.logger.debug('Server created successfully');
    return io;
  }

  private static readonly activeClients = new Map<string, IDisposable>();

  constructor(channelId: string, io: Server) {
    RemoteMessageServer.logger.debug(`Initializing RemoteMessageServer for channel: ${channelId}`);
    super(RemoteMessageServer.createClientConnectionHandler(channelId, io));
  }

  static createClientConnectionHandler(
    channelId: string,
    io: Server,
  ): Event<ClientConnectionEvent> {
    RemoteMessageServer.logger.debug(`Setting up connection handler for channel: ${channelId}`);

    // Create a proper VSCode event emitter that we'll fire when socket connections occur
    const connectionEmitter = new Emitter<ClientConnectionEvent>();

    // Register the socket.io connection handler
    io.on('connection', (socket: Socket) => {
      RemoteMessageServer.logger.debug(`New socket connection: ${socket.id}`);

      const onHello = this.fromMessageEmitter(
        socket,
        CRX_DEEP_RESEARCH_HELLO,
        (messageBody, source, target) => ({
          messageBody,
          source,
          target,
        }),
      );

      // Filter messages for this channel
      const filteredHello = Event.filter(onHello, message => message.target === channelId);

      // Subscribe to the filtered hello events
      Event.once(filteredHello)(({ source }) => {
        RemoteMessageServer.logger.debug(
          `Processing HELLO from client: ${source} for channel: ${channelId}`,
        );

        // Handle existing client
        const existingClient = RemoteMessageServer.activeClients.get(source);
        if (existingClient) {
          RemoteMessageServer.logger.debug(`Disposing existing client: ${source}`);
          existingClient.dispose();
        }

        // Setup reconnection handling
        const onReconnect = new Emitter<void>();
        const clientDisposables = new DisposableStore();
        RemoteMessageServer.activeClients.set(
          source,
          toDisposable(() => {
            RemoteMessageServer.logger.debug(`Client reconnecting: ${source}`);
            onReconnect.fire();
            clientDisposables.dispose();
          }),
        );

        // Create message handlers
        const onMessage = this.createMessageEvent(source, channelId, socket, CRX_DEEP_RESEARCH_MESSAGE);
        const disconnectEvent = this.createMessageEvent(
          source,
          channelId,
          socket,
          CRX_DEEP_RESEARCH_DISCONNECT,
        );

        // Create socket disconnect handler
        const socketDisconnectEmitter = new Emitter<void>();
        socket.on('disconnect', () => {
          RemoteMessageServer.logger.debug(`Socket disconnected: ${socket.id}, client: ${source}`);
          socketDisconnectEmitter.fire();
        });
        clientDisposables.add(socketDisconnectEmitter);

        // Combine disconnect events
        const onDidClientDisconnect = Event.any(
          Event.signal(disconnectEvent),
          onReconnect.event,
          socketDisconnectEmitter.event,
        );

        const protocol = new RemoteProtocol(channelId, source, onMessage, socket);

        RemoteMessageServer.logger.debug(`Client connection established: ${source}`);

        // Fire the connection event to notify subscribers
        connectionEmitter.fire({
          protocol,
          onDidClientDisconnect,
        });
      });
    });

    // Return the event from the emitter
    return connectionEmitter.event;
  }
}
