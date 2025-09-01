import { Port } from '@shared/ipc/protocol';
import { Emitter, Event } from 'vs/base/common/event';

export function createPortEvent(): Event<{ port: Port; id: string }> {
  const onCreateMessageChannel = new Emitter<{ port: Port; id: string }>();

  chrome.runtime.onConnect.addListener(async (port: chrome.runtime.Port) => {
    if (port.name.startsWith('crx-deep-research:service-worker:')) {
      // Split on first two colons to get everything after 'crx-deep-research:service-worker:'
      const id = port.name.substring(port.name.indexOf(':', port.name.indexOf(':') + 1) + 1);

      onCreateMessageChannel.fire({ port: port as unknown as Port, id });
    }
  });

  return onCreateMessageChannel.event;
}
