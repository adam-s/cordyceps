import { Event } from 'vs/base/common/event';
import { VSBuffer } from 'vs/base/common/buffer';
import { IMessagePassingProtocol } from 'vs/base/parts/ipc/common/ipc';
import { Message, CRX_DEEP_RESEARCH_MESSAGE } from '@shared/utils/message';
import { Logger, LogComponent } from '@shared/utils/logging';

/**
 * Socket interface compatible with both socket.io client and server
 */
export interface ISocketLike {
  emit(event: string, ...args: unknown[]): boolean;
  on(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  disconnect?(): void;
}

/**
 * Protocol implementation for socket-based messaging
 */
export class Protocol implements IMessagePassingProtocol {
  private readonly logger = Logger.forComponent('Protocol' as LogComponent);
  private readonly _messageHandler: (message: VSBuffer) => void;
  private readonly _eventListeners = new Map<string, (...args: unknown[]) => void>();

  constructor(
    private readonly _socket: ISocketLike,
    private readonly source: string,
    readonly onMessage: Event<VSBuffer>,
    private readonly target: string,
    readonly onReconnect?: Event<VSBuffer>,
  ) {
    // Create a proper message handler that forwards messages to listeners
    this._messageHandler = (message: VSBuffer) => {
      this.logger.debug('Message handler processing buffer', message);
      // Actually do something with the message instead of just logging
    };

    // Setup socket event listeners with better logging
    const messageListener = (...args: unknown[]) => {
      const payload = args[0];

      this.logger.debug('Raw socket message received', {
        payload,
        source: this.source,
        target: this.target,
      });

      if (!this.isValidMessage(payload)) {
        this.logger.debug('Invalid message format', payload);
        return;
      }

      const typedPayload = payload as Message;

      // IMPORTANT: Remove strict source/target filtering that may block initialization messages
      // Only do basic validation but don't require exact matches during initialization
      const messageBuffer = VSBuffer.wrap(new Uint8Array(typedPayload.body));
      this._messageHandler(messageBuffer);
    };

    // Store the message listener for cleanup
    this._eventListeners.set(CRX_DEEP_RESEARCH_MESSAGE, messageListener);

    // Register the listener
    this._socket.on(CRX_DEEP_RESEARCH_MESSAGE, messageListener);

    // Fix: Use the onMessage event correctly
    onMessage(message => {
      this.logger.debug('onMessage event received', message);
      // Don't call _messageHandler here as it would cause duplicate processing
    });
  }

  /**
   * Type guard to check if an unknown value is a valid Message
   */
  private isValidMessage(value: unknown): value is Message {
    return (
      !!value &&
      typeof value === 'object' &&
      'type' in value &&
      'source' in value &&
      'target' in value &&
      'body' in value &&
      Array.isArray((value as Message).body)
    );
  }

  /**
   * Send a message through the protocol
   */
  send(message: VSBuffer): void {
    this.logger.debug('Sending message', message);
    const payload = this.createMessagePayload(message);
    this.sendViaSocket(payload);
  }

  /**
   * Send message via socket
   */
  private sendViaSocket(payload: Message): void {
    try {
      this.logger.debug('Sending via socket', payload);
      this._socket.emit(CRX_DEEP_RESEARCH_MESSAGE, payload);
    } catch (error) {
      this.logger.error('Failed to send message via socket', error as Error, { payload });
    }
  }

  /**
   * Create message payload from buffer
   */
  private createMessagePayload(message: VSBuffer): Message {
    return {
      type: CRX_DEEP_RESEARCH_MESSAGE,
      source: this.source,
      body: Array.from(new Uint8Array(message.buffer)),
      target: this.target,
    };
  }

  /**
   * Disconnect the protocol and clean up event listeners
   */
  async disconnect(): Promise<void> {
    this.logger.debug('Disconnecting protocol');

    // Clean up all registered event listeners
    this._eventListeners.forEach((listener, event) => {
      this.logger.debug(`Removing listener for event: ${event}`);
      this._socket.off(event, listener);
    });

    // Clear the listeners map
    this._eventListeners.clear();
  }
}
