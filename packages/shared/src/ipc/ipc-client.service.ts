// @shared/ipc/client.service.ts
import { Disposable } from 'vs/base/common/lifecycle';
import { VSBuffer } from 'vs/base/common/buffer';
import { IChannel, IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { Client } from '@shared/ipc/client';
import { Port, Protocol } from '@shared/ipc/protocol';
import { IClientService } from '@shared/ipc/client.service';
import { Emitter } from 'vs/base/common/event';

export class IPCClientService extends Disposable implements IClientService {
  declare readonly _serviceBrand: undefined;

  private client: Client;

  constructor(documentId: string, portFactory: (documentId: string) => Port) {
    super();
    const port = portFactory(documentId);
    const onReceiveClientEvent = new Emitter<VSBuffer>();
    const onMessage = onReceiveClientEvent.event;

    port.onMessage.addListener(message => {
      const arrayBuffer =
        message instanceof ArrayBuffer
          ? message
          : message instanceof Uint8Array
            ? message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength)
            : new ArrayBuffer(0);
      onReceiveClientEvent.fire(VSBuffer.wrap(new Uint8Array(arrayBuffer)));
    });

    const protocol = new Protocol(port, onMessage);
    this.client = this._register(new Client(protocol, `documentId:${documentId}`));
  }

  getChannel(channelName: string): IChannel {
    return this.client.getChannel(channelName);
  }

  registerChannel(channelName: string, channel: IServerChannel<string>): void {
    this.client.registerChannel(channelName, channel);
  }
}
