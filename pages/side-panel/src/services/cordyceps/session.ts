import { Event, Emitter } from 'vs/base/common/event';
import { CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED } from '@shared/utils/message';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';

export class Session extends Disposable {
  /**
   * Session is the adapter for Chrome APIs related to:
   * - content script handshake (runtime messages)
   * - tab lifecycle (tabs.onCreated/onRemoved)
   * - navigation lifecycle (webNavigation.*)
   *
   * Network observation (chrome.webRequest.*) is intentionally NOT handled here.
   * Use NetworkListenerManager for all request/response tracking to avoid double listeners
   * and to keep concerns separated.
   */
  private readonly _onContentScriptLoaded = this._register(
    new Emitter<chrome.runtime.MessageSender>()
  );
  readonly onContentScriptLoaded: Event<chrome.runtime.MessageSender> =
    this._onContentScriptLoaded.event;

  private readonly _onTabCreated = this._register(new Emitter<chrome.tabs.Tab>());
  readonly onTabCreated: Event<chrome.tabs.Tab> = this._onTabCreated.event;

  private readonly _onTabRemoved = this._register(
    new Emitter<{
      tabId: number;
      removeInfo: chrome.tabs.TabRemoveInfo;
    }>()
  );
  readonly onTabRemoved: Event<{ tabId: number; removeInfo: chrome.tabs.TabRemoveInfo }> =
    this._onTabRemoved.event;

  private readonly _onTabActivated = this._register(new Emitter<chrome.tabs.TabActiveInfo>());
  readonly onTabActivated: Event<chrome.tabs.TabActiveInfo> = this._onTabActivated.event;

  private readonly _onBeforeNavigate = this._register(
    new Emitter<chrome.webNavigation.WebNavigationParentedCallbackDetails>()
  );
  readonly onBeforeNavigate: Event<chrome.webNavigation.WebNavigationParentedCallbackDetails> =
    this._onBeforeNavigate.event;

  private readonly _onCommitted = this._register(
    new Emitter<chrome.webNavigation.WebNavigationTransitionCallbackDetails>()
  );
  readonly onCommitted: Event<chrome.webNavigation.WebNavigationTransitionCallbackDetails> =
    this._onCommitted.event;

  private readonly _onCompleted = this._register(
    new Emitter<chrome.webNavigation.WebNavigationFramedCallbackDetails>()
  );
  readonly onCompleted: Event<chrome.webNavigation.WebNavigationFramedCallbackDetails> =
    this._onCompleted.event;

  private readonly _onDOMContentLoaded = this._register(
    new Emitter<chrome.webNavigation.WebNavigationFramedCallbackDetails>()
  );
  readonly onDOMContentLoaded: Event<chrome.webNavigation.WebNavigationFramedCallbackDetails> =
    this._onDOMContentLoaded.event;

  // Same-document navigations
  private readonly _onHistoryStateUpdated = this._register(
    new Emitter<chrome.webNavigation.WebNavigationTransitionCallbackDetails>()
  );
  readonly onHistoryStateUpdated: Event<chrome.webNavigation.WebNavigationTransitionCallbackDetails> =
    this._onHistoryStateUpdated.event;

  private readonly _onReferenceFragmentUpdated = this._register(
    new Emitter<chrome.webNavigation.WebNavigationTransitionCallbackDetails>()
  );
  readonly onReferenceFragmentUpdated: Event<chrome.webNavigation.WebNavigationTransitionCallbackDetails> =
    this._onReferenceFragmentUpdated.event;

  private readonly _onErrorOccurred = this._register(
    new Emitter<chrome.webNavigation.WebNavigationFramedErrorCallbackDetails>()
  );
  readonly onErrorOccurred: Event<chrome.webNavigation.WebNavigationFramedErrorCallbackDetails> =
    this._onErrorOccurred.event;

  readonly windowId: number;

  constructor(windowId: number) {
    super();
    this.windowId = windowId;
    this._setupMessageListener();
    this._setupTabListeners();
    this._setupWebNavigationListeners();
  }

  dispose(): void {
    super.dispose();
  }

  private _setupMessageListener(): void {
    const messageListener = (message: { type: string }, sender: chrome.runtime.MessageSender) => {
      if (message.type === CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED) {
        this._onContentScriptLoaded.fire(sender);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    this._register({
      dispose: () => chrome.runtime.onMessage.removeListener(messageListener),
    });
  }

  private _setupWebNavigationListeners(): void {
    const onBeforeNavigate = (details: chrome.webNavigation.WebNavigationParentedCallbackDetails) =>
      this._onBeforeNavigate.fire(details);
    const onCommitted = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) =>
      this._onCommitted.fire(details);
    const onCompleted = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) =>
      this._onCompleted.fire(details);
    const onDOMContentLoaded = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) =>
      this._onDOMContentLoaded.fire(details);
    const onHistoryStateUpdated = (
      details: chrome.webNavigation.WebNavigationTransitionCallbackDetails
    ) => this._onHistoryStateUpdated.fire(details);
    const onReferenceFragmentUpdated = (
      details: chrome.webNavigation.WebNavigationTransitionCallbackDetails
    ) => this._onReferenceFragmentUpdated.fire(details);
    const onErrorOccurred = (
      details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails
    ) => this._onErrorOccurred.fire(details);

    chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    chrome.webNavigation.onCommitted.addListener(onCommitted);
    chrome.webNavigation.onCompleted.addListener(onCompleted);
    chrome.webNavigation.onDOMContentLoaded.addListener(onDOMContentLoaded);
    chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated);
    chrome.webNavigation.onReferenceFragmentUpdated.addListener(onReferenceFragmentUpdated);
    chrome.webNavigation.onErrorOccurred.addListener(onErrorOccurred);

    this._register({
      dispose: () => {
        chrome.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
        chrome.webNavigation.onCommitted.removeListener(onCommitted);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        chrome.webNavigation.onDOMContentLoaded.removeListener(onDOMContentLoaded);
        chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated);
        chrome.webNavigation.onReferenceFragmentUpdated.removeListener(onReferenceFragmentUpdated);
        chrome.webNavigation.onErrorOccurred.removeListener(onErrorOccurred);
      },
    });
  }

  private _setupTabListeners(): void {
    const tabCreatedListener = (tab: chrome.tabs.Tab) => {
      this._onTabCreated.fire(tab);
      if (tab.windowId !== this.windowId) return;
      if (typeof tab.id === 'number') {
        // Tab created - navigation tracking handled by NavigationTracker singleton
      }
    };

    const tabRemovedListener = (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
      this._onTabRemoved.fire({ tabId, removeInfo });
      // Tab removed - cleanup handled by NavigationTracker singleton
    };

    const tabActivatedListener = (activeInfo: chrome.tabs.TabActiveInfo) => {
      this._onTabActivated.fire(activeInfo);
    };

    chrome.tabs.onCreated.addListener(tabCreatedListener);
    chrome.tabs.onRemoved.addListener(tabRemovedListener);
    chrome.tabs.onActivated.addListener(tabActivatedListener);

    this._register({
      dispose: () => {
        chrome.tabs.onCreated.removeListener(tabCreatedListener);
        chrome.tabs.onRemoved.removeListener(tabRemovedListener);
        chrome.tabs.onActivated.removeListener(tabActivatedListener);
      },
    });
  }

  /**
   * Creates a new event that only fires for events that have a specific tabId.
   */
  public static forTab<T extends { tabId: number }>(
    event: Event<T>,
    tabId: number,
    disposables?: DisposableStore
  ): Event<T> {
    return Event.filter(event, (e: T) => e.tabId === tabId, disposables);
  }

  /**
   * Creates a new event that only fires for content script loads in a specific tab.
   */
  public static forTabContentScript(
    event: Event<chrome.runtime.MessageSender>,
    tabId: number,
    disposables?: DisposableStore
  ): Event<chrome.runtime.MessageSender> {
    return Event.filter(
      event,
      (sender: chrome.runtime.MessageSender) => sender.tab?.id === tabId,
      disposables
    );
  }

  /**
   * Creates a new event that only fires for events that have a specific frameId.
   */
  public static forFrame<T extends { frameId: number }>(
    event: Event<T>,
    frameId: number,
    disposables?: DisposableStore
  ): Event<T> {
    return Event.filter(event, (e: T) => e.frameId === frameId, disposables);
  }
}
