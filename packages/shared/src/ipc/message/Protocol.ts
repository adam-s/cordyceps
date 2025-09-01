import { Event } from 'vs/base/common/event';
import { VSBuffer } from 'vs/base/common/buffer';
import { BufferReader, deserialize, IMessagePassingProtocol } from 'vs/base/parts/ipc/common/ipc';
import { Message, CRX_DEEP_RESEARCH_MESSAGE, CRX_DEEP_RESEARCH_DISCONNECT } from '@shared/utils/message';
import { responseTypeToStr, type ResponseType } from '@shared/ipc/message/ChannelClient';

/**
 * Protocol error context interface
 */
interface IProtocolErrorContext {
  tabId?: number;
  payload?: Message;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Protocol error type
 */
type ProtocolError = Error | chrome.runtime.LastError | { message: string };

/**
 * Protocol implementation for Chrome extension messaging
 */
export class Protocol implements IMessagePassingProtocol {
  private readonly debugEnabled: boolean = false;

  constructor(
    private readonly source: string,
    readonly onMessage: Event<VSBuffer>,
    private readonly target: string,
    private readonly sender?: chrome.runtime.MessageSender,
    readonly onReconnect?: Event<VSBuffer>,
  ) {
    // Trace events
    this.onMessage = Event.forEach(onMessage, (message: VSBuffer) => {
      this.debugLog('Receiving message', message, true);
    });
    if (onReconnect) {
      this.onReconnect = onReconnect;
    }
  }

  /**
   * Send a message through the protocol
   */
  send(message: VSBuffer): void {
    this.debugLog('Sending message', message);

    const payload = this.createMessagePayload(message);

    if (this.sender?.tab?.id) {
      this.sendToTab(this.sender.tab.id, payload);
    } else {
      this.sendToRuntime(payload);
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
   * Send message to specific tab
   */
  private sendToTab(tabId: number, payload: Message): void {
    chrome.tabs
      .sendMessage(tabId, payload, {
        documentId: this.sender?.documentId,
      })
      .catch(error => {
        this.logError('Failed to send message to tab', error, {
          tabId,
          payload,
        });
      });
  }

  /**
   * Send message to runtime
   */
  private async sendToRuntime(payload: Message): Promise<void> {
    try {
      await chrome.runtime.sendMessage(payload).catch(error => {
        this.debugLog('Failed to send runtime message', { error, payload });
      });
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Disconnect the protocol
   */
  async disconnect(): Promise<void> {
    this.debugLog('Disconnecting protocol');
    try {
      await chrome.runtime
        .sendMessage({
          type: CRX_DEEP_RESEARCH_DISCONNECT,
          source: this.source,
          target: this.target,
        })
        .catch(error => {
          this.debugLog('Failed to send disconnect message', error);
        });
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Log debug information when debug mode is enabled
   */
  private debugLog(message: string, data?: VSBuffer | unknown, isReceiving: boolean = false): void {
    if (!this.debugEnabled) return;

    const direction = isReceiving
      ? `${this.target} -> ${this.source}`
      : `${this.source} -> ${this.target}`;
    console.group(`Protocol [${direction}]`);

    if (data instanceof VSBuffer) {
      const reader = new BufferReader(data);
      const header = deserialize(reader);
      const body = deserialize(reader);
      const type: ResponseType = header?.[0];

      console.log('Decoded message:', {
        type: responseTypeToStr(type),
        header,
        body,
        raw: data,
      });
    } else if (data) {
      console.log('Data:', data);
    }
    console.groupEnd();
  }

  /**
   * Log protocol errors with context
   */
  private logError(message: string, error: ProtocolError, context?: IProtocolErrorContext): void {
    console.error(`Protocol Error [${this.source} -> ${this.target}]: ${message}`, {
      error: {
        message: 'message' in error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'ProtocolError',
        stack: error instanceof Error ? error.stack : new Error().stack,
      },
      context,
    });
  }
}
