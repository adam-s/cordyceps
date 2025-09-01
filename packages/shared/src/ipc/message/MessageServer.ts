// Core imports
import { VSBuffer } from 'vs/base/common/buffer';
import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { ClientConnectionEvent, IPCServer } from 'vs/base/parts/ipc/common/ipc';

// Local imports
import { CRX_DEEP_RESEARCH_DISCONNECT, CRX_DEEP_RESEARCH_HELLO, CRX_DEEP_RESEARCH_MESSAGE } from '@shared/utils/message';
import { fromMessageEmitter } from '@shared/ipc/message/common';
import { Protocol } from '@shared/ipc/message/Protocol';

/**
 * Represents a client connection event with extended functionality
 */
export interface ClientConnectEvent {
  id: string;
  source: string;
  sender: chrome.runtime.MessageSender;
  disconnect: () => void;
  deleteClient: () => void;
  onDidClientDisconnect: Event<void>;
}

/**
 * Creates a filtered message event for specific sender and channel
 */
function createMessageEvent(
  senderId: string,
  channelId: string | undefined,
  eventName: string = CRX_DEEP_RESEARCH_MESSAGE,
): Event<VSBuffer> {
  // Create base message event
  const onMessage = fromMessageEmitter(
    chrome.runtime.onMessage,
    eventName,
    (messageBody, sender, source, target) => ({
      messageBody,
      sender,
      source,
      target,
    }),
  );

  // Apply message filtering
  const filteredMessage = Event.filter(onMessage, ({ source, target }) => {
    return source === senderId && target === channelId;
  });

  // Transform to VSBuffer
  return Event.map(filteredMessage, ({ messageBody }) => {
    return VSBuffer.wrap(messageBody);
  });
}

/**
 * MessageServer implementation for Chrome extension messaging
 */
export class MessageServer extends IPCServer {
  private static readonly _onDidClientConnect = new Emitter<ClientConnectEvent>();
  public static readonly onDidClientConnect = MessageServer._onDidClientConnect.event;

  private static readonly activeClients = new Map<string, IDisposable>();
  private static readonly clientEvents = new Map<string, ClientConnectEvent>();

  constructor(channelId: string) {
    super(MessageServer.createClientConnectionHandler(channelId));
  }

  public getClientEvent(connectionId: string): ClientConnectEvent | undefined {
    return MessageServer.clientEvents.get(connectionId);
  }

  private static createClientConnectionHandler(channelId: string): Event<ClientConnectionEvent> {
    // Listen for hello messages
    const onHello = fromMessageEmitter(
      chrome.runtime.onMessage,
      CRX_DEEP_RESEARCH_HELLO,
      (messageBody, sender, source, target) => {
        // IPC Step 2: Handle the hello message
        return {
          messageBody,
          sender,
          source,
          target,
        };
      },
    );
    // Filter messages for this channel
    const filteredHello = Event.filter(onHello, message => {
      // IPC Step 3: Filter messages by channel ID to ensure correct recipient
      return message.target === channelId;
    });

    return Event.map(filteredHello, ({ sender, source }) => {
      // IPC Step 4: Create a client connection event
      // IPC Step 4 a: Handle existing client]
      const existingClient = MessageServer.activeClients.get(source);
      existingClient?.dispose();

      const onReconnect = new Emitter<void>();
      const clientDisposables = new DisposableStore();
      // IPC Step 4 b: Add new client to active clients
      MessageServer.activeClients.set(
        source,
        toDisposable(() => {
          onReconnect.fire();
          clientDisposables.dispose();
        }),
      );

      // Create message handlers
      const disconnectEvent = createMessageEvent(source, channelId, CRX_DEEP_RESEARCH_DISCONNECT);
      const onDidClientDisconnect = Event.any(Event.signal(disconnectEvent), onReconnect.event);
      const onMessage = createMessageEvent(source, channelId, CRX_DEEP_RESEARCH_MESSAGE);

      // IPC Step 5: Create protocol instance
      const protocol = new Protocol(channelId, onMessage, source, sender);

      // IPC Step 6: Create client connection event emitted in IPCServer
      const clientConnectionEvent = {
        id: source,
        source,
        sender,
        disconnect: () => {
          onReconnect.fire();
          MessageServer.activeClients.delete(source);
          MessageServer.clientEvents.delete(source);
          clientDisposables.dispose();
        },
        deleteClient: () => {
          MessageServer.activeClients.delete(source);
          MessageServer.clientEvents.delete(source);
          clientDisposables.dispose();
        },
        onDidClientDisconnect,
      };

      // Store the client event for later access
      MessageServer.clientEvents.set(source, clientConnectionEvent);

      // Fire onDidClientConnect event
      MessageServer._onDidClientConnect.fire(clientConnectionEvent);

      // Return client connection event
      return {
        protocol,
        onDidClientDisconnect,
      };
    });
  }

  public dispose(): void {
    super.dispose();
    MessageServer.activeClients.forEach(d => d.dispose());
    MessageServer.activeClients.clear();
    MessageServer.clientEvents.clear();
  }
}
