import { Emitter } from 'vs/base/common/event';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import {
  IBrowserTabMonitor,
  ITabUpdateEvent,
  ITabChangeInfo,
  ITabInfo,
} from './ExtensionClientLifeCycleManager';

/**
 * Chrome extension implementation of browser tab monitoring
 */
export class ChromeBrowserTabMonitor extends Disposable implements IBrowserTabMonitor {
  private readonly _onTabRemoved = this._register(new Emitter<number>());
  private readonly _onTabUpdated = this._register(new Emitter<ITabUpdateEvent>());

  constructor() {
    super();
    this._setupChromeTabListeners();
  }

  /**
   * Event fired when a tab is removed
   */
  public onTabRemoved(listener: (tabId: number) => void): IDisposable {
    return this._onTabRemoved.event(listener);
  }

  /**
   * Event fired when a tab is updated
   */
  public onTabUpdated(listener: (event: ITabUpdateEvent) => void): IDisposable {
    return this._onTabUpdated.event(listener);
  }

  /**
   * Setup Chrome API event listeners
   */
  private _setupChromeTabListeners(): void {
    // Listen for tab removal events
    const tabRemovedListener = (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
      console.log(`ChromeBrowserTabMonitor: Tab ${tabId} removed`, removeInfo);
      this._onTabRemoved.fire(tabId);
    };

    // Listen for tab update events - only fire for meaningful changes
    const tabUpdatedListener = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      // Only emit events for status changes that matter for content script lifecycle
      const shouldEmit = this._shouldEmitTabUpdate(changeInfo);

      if (shouldEmit) {
        const event: ITabUpdateEvent = {
          tabId,
          changeInfo: this._mapChangeInfo(changeInfo),
          tab: this._mapTabInfo(tab),
        };

        console.log(`ChromeBrowserTabMonitor: Tab ${tabId} updated`, event);
        this._onTabUpdated.fire(event);
      }
    };

    // Register Chrome API listeners
    chrome.tabs.onRemoved.addListener(tabRemovedListener);
    chrome.tabs.onUpdated.addListener(tabUpdatedListener);

    // Register cleanup for disposal
    this._register({
      dispose: () => {
        if (chrome.tabs?.onRemoved?.removeListener) {
          chrome.tabs.onRemoved.removeListener(tabRemovedListener);
        }
        if (chrome.tabs?.onUpdated?.removeListener) {
          chrome.tabs.onUpdated.removeListener(tabUpdatedListener);
        }
      },
    });
  }

  /**
   * Determine if a tab update should emit an event
   * Only emit for meaningful changes that affect content script lifecycle
   */
  private _shouldEmitTabUpdate(changeInfo: chrome.tabs.TabChangeInfo): boolean {
    // Emit for URL changes (navigation)
    if (changeInfo.url) {
      return true;
    }

    // Don't emit for other changes like title, favicon, etc.
    return false;
  }

  /**
   * Map Chrome TabChangeInfo to our interface
   */
  private _mapChangeInfo(changeInfo: chrome.tabs.TabChangeInfo): ITabChangeInfo {
    const status = changeInfo.status;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _, ...otherProps } = changeInfo;
    return {
      status: status === 'loading' || status === 'complete' ? status : undefined,
      url: changeInfo.url,
      ...otherProps,
    };
  }

  /**
   * Map Chrome Tab to our interface
   */
  private _mapTabInfo(tab: chrome.tabs.Tab): ITabInfo {
    const { active, ...rest } = tab;
    return {
      id: tab.id!,
      url: tab.url,
      active,
      ...rest,
    };
  }
}
