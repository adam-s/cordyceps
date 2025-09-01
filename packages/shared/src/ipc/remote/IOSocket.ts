import { Socket } from 'socket.io-client';
import { ISocket, SocketCloseEvent } from '@shared/ipc/remote/protocol';
import { IDisposable } from 'vs/base/common/lifecycle';
import { VSBuffer } from 'vs/base/common/buffer';

const socketEndTimeoutMs = 30_000;

export class IOSocket implements ISocket {
  public readonly socket: Socket;
  public readonly id: string;

  private readonly _errorListener: (err: Error) => void;
  private readonly _closeListener: (hadError: boolean) => void;
  private readonly _endListener: () => void;
  private _canWrite = true;

  constructor(socket: Socket, id: string) {
    this.socket = socket;
    this.id = id;

    this._errorListener = (err: Error) => {
      console.error('Socket error', err);
    };

    let endTimeoutHandle: NodeJS.Timeout | number | undefined;
    this._closeListener = (hadError: boolean) => {
      if (hadError) {
        console.error('Socket closed due to an error');
      }
      this._canWrite = false;
      if (endTimeoutHandle) {
        clearTimeout(endTimeoutHandle);
      }
    };
    this._endListener = () => {
      this._canWrite = false;
      endTimeoutHandle = setTimeout(() => socket.disconnect(), socketEndTimeoutMs);
    };

    this.socket.on('error', this._errorListener);
    this.socket.on('close', this._closeListener);
    this.socket.on('end', this._endListener);
  }

  public dispose(): void {
    this.socket.off('error', this._errorListener);
    this.socket.off('close', this._closeListener);
    this.socket.off('end', this._endListener);
    this.socket.disconnect();
  }

  public onData(_listener: (e: VSBuffer) => void): IDisposable {
    const listener = (buff: ArrayBuffer | Buffer) => {
      const uint8 = buff instanceof ArrayBuffer ? new Uint8Array(buff) : buff;
      _listener(VSBuffer.wrap(uint8 as Uint8Array));
    };

    this.socket.on('message', listener);
    return {
      dispose: () => this.socket.off('message', listener),
    };
  }

  public onClose(listener: (e: SocketCloseEvent) => void): IDisposable {
    this.socket.on('close', listener);
    return {
      dispose: () => this.socket.off('close', listener),
    };
  }

  public onEnd(listener: () => void): IDisposable {
    this.socket.on('end', listener);
    return {
      dispose: () => this.socket.off('end', listener),
    };
  }

  public write(buffer: VSBuffer): void {
    this.socket.emit('message', buffer.buffer);
  }

  public end(): void {
    this.socket.disconnect();
  }

  public drain(): Promise<void> {
    return Promise.resolve();
  }
}
