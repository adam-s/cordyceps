import { Port } from '@shared/ipc/protocol';
import { BufferWriter, serialize } from 'vs/base/parts/ipc/common/ipc';

export function createPort(documentId: string): Port {
  const name = `crx-deep-research:service-worker:${documentId}`;
  const port = chrome.runtime.connect({ name });
  let connected = true;
  const container = { port };

  const onMessageCallbacks: Array<(message: unknown) => void> = [];
  const onDisconnectCallbacks: Array<() => void> = [];

  function attachListeners() {
    container.port.onMessage.addListener(message => {
      onMessageCallbacks.forEach(callback => callback(message));
    });
    container.port.onDisconnect.addListener(() => {
      onDisconnectCallbacks.forEach(callback => callback());
    });
  }

  attachListeners();

  container.port.onDisconnect.addListener(() => {
    connected = false;
    setTimeout(async () => {
      console.log('reconnecting');
      // reconnect to the port here
      const port = chrome.runtime.connect({ name });
      attachListeners();

      // 1. send name as ctx
      const writerCtx = new BufferWriter();
      serialize(writerCtx, `documentId:${documentId}`);
      port.postMessage(Array.from(writerCtx.buffer.buffer));

      // 2. send [200]
      // const header = [200];
      // const writer200 = new BufferWriter();
      // const body = undefined;
      // serialize(writer200, header);
      // serialize(writer200, body);
      // port.postMessage(Array.from(writer200.buffer.buffer));
      connected = true;
      container.port = port;
    }, 0);
  });

  return {
    name: container.port.name,
    postMessage: message => {
      const data = message instanceof ArrayBuffer ? Array.from(new Uint8Array(message)) : message;
      if (connected) container.port.postMessage(data);
    },
    disconnect: () => container.port.disconnect(),
    onMessage: {
      addListener: callback => onMessageCallbacks.push(callback as (message: unknown) => void),
    },
    onDisconnect: {
      addListener: callback => onDisconnectCallbacks.push(callback),
    },
  };
}
