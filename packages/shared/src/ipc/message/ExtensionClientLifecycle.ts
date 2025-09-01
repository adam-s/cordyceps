import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

/**
 * Information about a specific tab/frame.
 */
export interface TabFrameInfo {
  tabId: number;
  frameId: number;
}

/**
 * Emitted when a top-level tab is closed.
 */
export interface TabRemovedEvent {
  readonly type: 'TabRemoved';
  readonly tabId: number;
}

/**
 * Emitted when a navigation occurs in any frame.
 */
export interface NavigatedEvent extends TabFrameInfo {
  readonly type: 'Navigated';
  readonly url: string;
}

/**
 * Emitted when a back/forward navigation occurs.
 */
export interface HistoryNavigationEvent extends TabFrameInfo {
  readonly type: 'HistoryNavigation';
  readonly url: string;
}

/**
 * Emitted when a content-script port disconnects (e.g. frame unload).
 */
export interface FrameRemovedEvent extends TabFrameInfo {
  readonly type: 'FrameRemoved';
}

/**
 * Union of all lifecycle events.
 */
export type LifecycleEvent =
  | TabRemovedEvent
  | NavigatedEvent
  | HistoryNavigationEvent
  | FrameRemovedEvent;

export const IExtensionClientLifecycle = createDecorator<IExtensionClientLifecycle>(
  'extensionClientLifecycle',
);

export interface IExtensionClientLifecycle {
  readonly _serviceBrand: undefined;
  readonly onLifecycleEvent: Event<LifecycleEvent>;
}

/**
 * Manages and emits lifecycle events for tabs and frames.
 */
export class ExtensionClientLifecycle extends Disposable implements IExtensionClientLifecycle {
  public readonly _serviceBrand: undefined;
  private readonly _onLifecycleEvent = this._register(new Emitter<LifecycleEvent>());
  public readonly onLifecycleEvent: Event<LifecycleEvent> = this._onLifecycleEvent.event;

  constructor() {
    super();
    // Tab closed
    chrome.tabs.onRemoved.addListener(tabId => {
      this._onLifecycleEvent.fire({ type: 'TabRemoved', tabId });
    });

    // Any navigation (including subframes)
    chrome.webNavigation.onCommitted.addListener(details => {
      this._onLifecycleEvent.fire({
        type: 'Navigated',
        tabId: details.tabId,
        frameId: details.frameId,
        url: details.url,
      });
    });

    // History (back/forward)
    chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
      this._onLifecycleEvent.fire({
        type: 'HistoryNavigation',
        tabId: details.tabId,
        frameId: details.frameId,
        url: details.url,
      });
    });

    // Detect frame unload via port disconnect
    chrome.runtime.onConnect.addListener(port => {
      const sender = port.sender;
      if (sender?.tab && typeof sender.frameId === 'number') {
        const tabId = sender.tab.id!;
        const frameId = sender.frameId;
        port.onDisconnect.addListener(() => {
          this._onLifecycleEvent.fire({ type: 'FrameRemoved', tabId, frameId });
        });
      }
    });
  }
}
