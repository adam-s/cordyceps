// pages/content-main/src/ipc/createPort.ts

import { CreateMainPortMessage, CrxDeepResearchMessage } from '@shared/utils/main';
import { Port } from '@shared/ipc/protocol';

export async function createMainWorldPort<TPort extends string>(
  id: string,
  portType: TPort,
): Promise<() => Port> {
  const { port1, port2 } = new MessageChannel();

  // Wait for server to initialize
  await new Promise<void>(resolve => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }

      const message = event.data as CrxDeepResearchMessage<TPort>;
      if (message.type === `crx-deep-research:initializeContentScript:${portType}`) {
        window.removeEventListener('message', handler);
        resolve();
      }
    };
    window.addEventListener('message', handler);
  });

  // Send create port message
  const createPortMessage: CreateMainPortMessage<TPort> = {
    type: `crx-deep-research:create${portType}Port`,
    id,
  } as CreateMainPortMessage<TPort>;
  window.postMessage(createPortMessage, '*', [port2]);

  // Wait for server response
  await new Promise<void>(resolve => {
    port1.onmessage = (event: MessageEvent) => {
      const message = event.data as CrxDeepResearchMessage<TPort>;
      if (message.type === `crx-deep-research:hello:${portType}`) {
        port1.onmessage = null;
        resolve();
      }
    };
  });

  // Return as non-generic Port for compatibility
  return () =>
    ({
      name: `crx-deep-research:create${portType}Port`,
      postMessage: (msg: unknown) => port1.postMessage(msg),
      disconnect: () => port1.close(),
      onMessage: {
        addListener: (callback: (msg: unknown) => void) => {
          port1.onmessage = (event: MessageEvent) => callback(event.data);
        },
      },
      onDisconnect: {
        addListener: () => {
          // Implement if needed
        },
      },
    }) as Port;
}
