import { Emitter, Event } from 'vs/base/common/event';
import { Message } from '@shared/utils/message';

export function fromMessageEmitter<T>(
  emitter: chrome.runtime.ExtensionMessageEvent,
  eventName: string,
  map: (
    messageBody: Uint8Array,
    sender: chrome.runtime.MessageSender,
    source: string,
    target: string,
  ) => T,
): Event<T> {
  const result = new Emitter<T>({
    onWillAddFirstListener: () => emitter.addListener(listener),
    onDidRemoveLastListener: () => emitter.removeListener(listener),
  });

  function listener(message: Message, sender: chrome.runtime.MessageSender) {
    if (message && message.type === eventName) {
      const messageBody = new Uint8Array(message.body);
      const mapped = map(messageBody, sender, message.source, message.target);
      try {
        result.fire(mapped);
      } catch (error) {
        console.log('argh!', error);
      }
    }
  }

  return result.event;
}
