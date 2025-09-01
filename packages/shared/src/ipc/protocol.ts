import { VSBuffer } from 'vs/base/common/buffer';
import { IMessagePassingProtocol } from 'vs/base/parts/ipc/common/ipc';
import { Event } from 'vs/base/common/event';

// Define a type for serializable messages including buffers
type SerializableMessage =
  | string
  | number
  | boolean
  | null
  | undefined
  | Uint8Array
  | SerializableMessage[]
  | { [key: string]: SerializableMessage };

export interface Port {
  name: string;
  postMessage(message: SerializableMessage): void;
  disconnect(): void;
  onMessage: {
    addListener(callback: (message: SerializableMessage) => void): void;
    removeListener?(callback: (message?: SerializableMessage) => void): void;
  };
  onDisconnect: {
    addListener(callback: () => void): void;
    removeListener?(callback: (message?: SerializableMessage) => void): void;
  };
}

export class Protocol implements IMessagePassingProtocol {
  constructor(
    private port: Port,
    readonly onMessage: Event<VSBuffer>,
  ) {}

  send(message: VSBuffer): void {
    try {
      // Grab the underlying ArrayBuffer
      const buffer = message.buffer;
      // Send it *without* copying as a Transferable
      this.port.postMessage(buffer);
    } catch (e) {
      console.error('Error sending message:', e);
    }
  }

  disconnect(): void {
    this.port.disconnect();
  }
}
