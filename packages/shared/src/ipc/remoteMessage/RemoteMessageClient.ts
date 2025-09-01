import { VSBuffer } from 'vs/base/common/buffer';
import { IDisposable } from 'vs/base/common/lifecycle';
import { BufferWriter, serialize } from 'vs/base/parts/ipc/common/ipc';
import { Emitter, Event } from 'vs/base/common/event';
import { CRX_DEEP_RESEARCH_HELLO, CRX_DEEP_RESEARCH_MESSAGE, CRX_DEEP_RESEARCH_RECONNECT } from '@shared/utils/message';
import {
  ChannelClient,
  ChannelServer,
  IChannel,
  IChannelClient,
  IChannelServer,
  IServerChannel,
} from './ChannelClient';
import { Protocol, ISocketLike } from './Protocol';
import { Logger, LogComponent } from '@shared/utils/logging';

// Create logger instance for this component
const logger = Logger.forComponent('RemoteMessageClient' as LogComponent);

/**
 * Creates a filtered message event for specific sender and channel
 */
function createMessageEvent(
  senderId: string,
  channelId: string | undefined,
  eventName: string = CRX_DEEP_RESEARCH_MESSAGE,
  socket: ISocketLike,
): Event<VSBuffer> {
  const emitter = new Emitter<VSBuffer>();

  socket.on(eventName, (...args: unknown[]) => {
    const payload = args[0];
    logger.debug(`Received ${eventName} event:`, {
      payload,
      senderId,
      channelId,
    });

    if (
      payload &&
      typeof payload === 'object' &&
      'source' in payload &&
      'target' in payload &&
      'body' in payload &&
      (payload as { source: string }).source === channelId &&
      (payload as { target: string }).target === senderId &&
      Array.isArray((payload as { body: unknown[] }).body)
    ) {
      logger.debug(`Processing valid ${eventName} message:`, payload);
      const body = (payload as { body: number[] }).body;
      emitter.fire(VSBuffer.wrap(new Uint8Array(body)));
    } else {
      logger.debug(`Filtering out ${eventName} message due to mismatch:`, {
        payload,
        expectedSource: channelId,
        expectedTarget: senderId,
        hasValidFormat:
          payload &&
          typeof payload === 'object' &&
          'source' in payload &&
          'target' in payload &&
          'body' in payload,
      });
    }
  });

  return emitter.event;
}

export class RemoteMessageClient<TContext extends string>
  implements IChannelClient, IChannelServer<TContext>, IDisposable
{
  private readonly channelClient: ChannelClient;
  private readonly channelServer: ChannelServer<TContext>;
  private readonly protocol: Protocol;

  constructor(
    private readonly source: TContext,
    private readonly target: TContext,
    private readonly socket: ISocketLike,
  ) {
    this.protocol = this.createProtocol();
    this.channelClient = new ChannelClient(this.protocol);
    this.channelServer = new ChannelServer(this.protocol, this.source);

    this.sendInitialHandshake();
  }

  private createProtocol(): Protocol {
    // Create message events
    const onReconnect = createMessageEvent(
      this.source,
      this.target,
      CRX_DEEP_RESEARCH_RECONNECT,
      this.socket,
    );

    // This is already an Event<VSBuffer> so it matches the expected type
    const onMessage = createMessageEvent(this.source, this.target, CRX_DEEP_RESEARCH_MESSAGE, this.socket);

    // Create protocol instance
    const protocol = new Protocol(this.socket, this.source, onMessage, this.target, onReconnect);

    // Handle reconnection
    onReconnect(() => {
      this.sendHelloMessage();
      this.sendSourceIdentifier();
    });

    this.sendHelloMessage();

    return protocol;
  }

  private sendHelloMessage(): void {
    const helloMessage = {
      type: CRX_DEEP_RESEARCH_HELLO,
      source: this.source,
      target: this.target,
      body: [],
    };

    this.socket.emit(CRX_DEEP_RESEARCH_HELLO, helloMessage);
  }

  private sendSourceIdentifier(): void {
    const writer = new BufferWriter();
    serialize(writer, this.source);
    this.protocol.send(writer.buffer);
  }

  private sendInitialHandshake(): void {
    // We need to send the source identifier AFTER the hello message is sent
    setTimeout(() => {
      this.sendSourceIdentifier();

      // Set up a listener for the first message and respond with initialization
      const subscription = this.protocol.onMessage(() => {
        // Only handle first message then clean up
        subscription.dispose();

        // Send initialization response immediately
        const writer = new BufferWriter();
        serialize(writer, [200]); // ResponseType.Initialize
        serialize(writer, undefined);
        this.protocol.send(writer.buffer);

        // Log successful initialization
        logger.debug('Initialization response sent');
      });
    }, 100);
  }

  // IChannelClient implementation
  getChannel<T extends IChannel>(channelName: string): T {
    return this.channelClient.getChannel(channelName) as T;
  }

  // IChannelServer implementation
  registerChannel(channelName: string, channel: IServerChannel<TContext>): void {
    this.channelServer.registerChannel(channelName, channel);
  }

  // IDisposable implementation
  dispose(): void {
    this.protocol.disconnect();
    this.channelClient.dispose();
    this.channelServer.dispose();
  }
}
