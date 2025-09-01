import { io, Socket } from 'socket.io-client';
import { IPCClient } from 'vs/base/parts/ipc/common/ipc';
import { PersistentProtocol } from '@shared/ipc/remote/protocol';
import { generateUuid } from 'vs/base/common/uuid';
import { IOSocket } from '@shared/ipc/remote/IOSocket';

export class Client extends IPCClient {
  constructor(manager: ClientConnectionManager) {
    super(manager.protocol, 'client');
  }
}
export class ClientConnectionManager {
  private _protocol: PersistentProtocol;
  id: string = generateUuid();
  private _socket: IOSocket;

  constructor(
    private readonly url: string,
    private readonly port: number,
  ) {
    const socket: Socket = this._createSocket(this.url, this.port);
    this._socket = new IOSocket(socket, this.id);
    this._protocol = new PersistentProtocol({ socket: this._socket });
  }

  private _createSocket(url: string, port: number): Socket {
    return io(`http://${url}:${port}`, {
      query: {
        id: this.id,
      },
      transports: ['websocket'],
    });
  }

  get protocol() {
    return this._protocol;
  }

  get socket() {
    return this._socket;
  }
}
