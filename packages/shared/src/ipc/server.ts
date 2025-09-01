import { VSBuffer } from 'vs/base/common/buffer';
import { ClientConnectionEvent, IPCServer } from 'vs/base/parts/ipc/common/ipc';
import { Emitter, Event } from 'vs/base/common/event';
import { IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { Port, Protocol } from './protocol';

export class Server extends IPCServer {
  private static readonly Clients = new Map<string, IDisposable>();

  _onDidClientConnect = new Emitter<ClientConnectionEvent>();
  readonly onDidClientConnect: Event<ClientConnectionEvent> = this._onDidClientConnect.event;

  private static createOnDidClientConnect(
    onCreateMessageChannel: Event<{ port: Port; id: string }>,
  ): Event<ClientConnectionEvent> {
    return Event.map(onCreateMessageChannel, ({ port, id }) => {
      const client = Server.Clients.get(id);
      client?.dispose();

      const onDidClientReconnect = new Emitter<void>();
      Server.Clients.set(
        id,
        toDisposable(() => onDidClientReconnect.fire()),
      );

      const onReceiveClientEvent = new Emitter<VSBuffer>();
      const onMessage = onReceiveClientEvent.event;
      port.onMessage.addListener(data => {
        const arrayBuffer =
          data instanceof ArrayBuffer
            ? data
            : data instanceof Uint8Array
              ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
              : new ArrayBuffer(0);
        onReceiveClientEvent.fire(VSBuffer.wrap(new Uint8Array(arrayBuffer)));
      });

      const onDidClientDisconnect = onDidClientReconnect.event;
      port.onDisconnect.addListener(() => {
        onDidClientReconnect.fire();
        client?.dispose();
        Server.Clients.delete(id);
      });
      const protocol = new Protocol(port, onMessage);
      return { protocol, onDidClientDisconnect };
    });
  }

  constructor(onCreateMessageChannel: Event<{ port: Port; id: string }>) {
    super(Server.createOnDidClientConnect(onCreateMessageChannel));
  }
}
