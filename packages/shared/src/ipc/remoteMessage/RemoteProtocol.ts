import { Event } from 'vs/base/common/event';
import { VSBuffer } from 'vs/base/common/buffer';
import { BufferReader, deserialize, IMessagePassingProtocol } from 'vs/base/parts/ipc/common/ipc';
import { CRX_DEEP_RESEARCH_MESSAGE, CRX_DEEP_RESEARCH_DISCONNECT } from '@shared/utils/message';
import { responseTypeToStr, type ResponseType } from '@shared/ipc/message/ChannelClient';
import { Socket } from 'socket.io';

/**
 * Protocol implementation for Chrome extension messaging
 */
export class RemoteProtocol implements IMessagePassingProtocol {
  private readonly debugEnabled: boolean = false;

  constructor(
    private readonly source: string,
    private readonly target: string,
    readonly onMessage: Event<VSBuffer>,
    private readonly socket: Socket,
  ) {
    // Trace events
    this.onMessage = Event.forEach(onMessage, (message: VSBuffer) => {
      this.debugLog('Receiving message', message, true);
    });
  }

  /**
   * Send a message through the protocol
   */
  send(message: VSBuffer): void {
    this.debugLog('Sending message', message);
    this.socket.emit(CRX_DEEP_RESEARCH_MESSAGE, {
      type: CRX_DEEP_RESEARCH_MESSAGE,
      source: this.source,
      target: this.target,
      body: Array.from(new Uint8Array(message.buffer)),
    });
  }

  /**
   * Disconnect the protocol
   */
  async disconnect(): Promise<void> {
    this.debugLog('Disconnecting protocol');
    this.socket.emit(CRX_DEEP_RESEARCH_MESSAGE, {
      type: CRX_DEEP_RESEARCH_DISCONNECT,
      source: this.source,
      target: this.target,
    });
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
}
