import { Disposable } from 'vs/base/common/lifecycle';
import { Progress, ProgressController, executeWithProgress } from './core/progress';
import { StateAwareEvent } from './utilities/pageUtils';
import type { FrameManager } from './frameManager';
import type { FrameExecutionContext } from './core/frameExecutionContext';
import type {
  NavigateOptionsWithProgress,
  WaitForElementOptions,
  ClickOptions,
  SelectOption,
  SelectOptionOptions,
  FrameDragAndDropOptions,
  ScreenshotOptions,
  NavigationEvent,
  LifecycleEvent,
  RegularLifecycleEvent,
  DocumentInfo,
  NavigationResponse,
  CallMetadata,
  NavigationRequest,
  ResponseInfo,
  RequestInfo,
  TimeoutOptions,
} from './utilities/types';
import { verifyLifecycle } from './utilities/types';
import { ContentScriptReadinessManager } from './navigation/contentScriptReadiness';
import { FrameSelectors } from './operations/frameSelectors';
import {
  getByTestIdSelector,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByTextSelector,
  getByTitleSelector,
  ByRoleOptions,
  getByRoleSelector,
} from '@injected/isomorphic/locatorUtils';
import { LocatorOptions, Locator } from './locator';
import { isString } from '@injected/isomorphic/stringUtils';
import { ElementHandle } from './elementHandle';
import { DEFAULT_RETRY_TIMEOUTS } from './utilities/constants';
import {
  calculateCenterPosition,
  testIdAttributeName,
  createDragAndDropScript,
  validateWaitState,
  isNonRetriableError,
  doesStateMatch,
  shouldReturnElementHandle,
  getFileInputWaitState,
  createSelectorWaitMessage,
  createElementNotFoundError,
  createBoundingBoxError,
  createFrameEnterSelector,
  createFrameNthSelector,
} from './utilities/frameUtils';
import { parseURL } from './utilities/utils';
import { FileTransferPortController } from './file-transfer/fileTransferPortController';
import { ParsedSelector } from '@injected/isomorphic/selectorParser';
import { getNavigationTracker, InternalNavigation } from './navigation/navigationTracker';
import { getNetworkObserver } from './navigation/networkObserver';
import { LongStandingScope, ManualPromise } from '@injected/isomorphic/manualPromise';
import { Event, Emitter } from 'vs/base/common/event';

export type World = 'main' | 'utility';

export function serverSideCallMetadata(): CallMetadata {
  return {
    id: '',
    startTime: 0,
    endTime: 0,
    type: 'Internal',
    method: '',
    params: {},
    log: [],
    isServerSide: true,
  };
}

type ContextData = {
  contextPromise: ManualPromise<FrameExecutionContext | { destroyedReason: string }>;
  context: FrameExecutionContext | null;
};

export class NavigationAbortedError extends Error {
  readonly documentId?: string;
  constructor(documentId: string | undefined, message: string) {
    super(message);
    this.documentId = documentId;
  }
}

/**
 * Network classes for handling Chrome extension webRequest integration
 * Provides Playwright-compatible interfaces over Chrome's webRequest API
 */
class Network {
  /**
   * Request class implementing NavigationRequest interface
   * Maps Chrome webRequest details to Playwright-style request handling
   */
  static Request = class NetworkRequest implements NavigationRequest {
    id: string;
    url: string;
    method: string;
    resourceType: string;
    headers: Record<string, string>;
    timestamp: number;
    _documentId?: string;
    private _response: ResponseInfo | null = null;

    constructor(requestInfo: RequestInfo, documentId?: string) {
      this.id = requestInfo.id;
      this.url = requestInfo.url;
      this.method = requestInfo.method;
      this.resourceType = requestInfo.resourceType;
      this.headers = requestInfo.headers;
      this.timestamp = requestInfo.timestamp;
      this._documentId = documentId;
    }

    /**
     * Returns the response for this request
     * Implements NavigationRequest interface requirement
     */
    async response(): Promise<ResponseInfo | null> {
      return this._response;
    }

    /**
     * Sets the response for this request
     * Called when response is received from Chrome webRequest API
     */
    _setResponse(responseInfo: ResponseInfo): void {
      this._response = responseInfo;
    }

    /**
     * Returns the final request in a redirect chain
     * For Chrome extension compatibility - returns self since we don't track redirects at this level
     */
    _finalRequest(): NavigationRequest {
      return this;
    }
  };

  /**
   * Response class for handling Chrome webRequest response data
   * Provides structured access to response information
   */
  static ResponseData = class NetworkResponseData {
    id: string;
    url: string;
    status: number;
    headers: Record<string, string>;
    timestamp: number;
    request: RequestInfo;

    constructor(responseInfo: ResponseInfo) {
      this.id = responseInfo.id;
      this.url = responseInfo.url;
      this.status = responseInfo.status;
      this.headers = responseInfo.headers;
      this.timestamp = responseInfo.timestamp;
      this.request = responseInfo.request;
    }
  };

  /**
   * Simple NavigationResponse implementation for Frame.goto()
   * Provides basic response information for successful navigations
   */
  static NavigationResponse = class NavigationResponseImpl implements NavigationResponse {
    private _url: string;
    private _status: number;
    private _statusText: string;
    private _headers: Record<string, string>;
    private _request: NavigationRequest | null;

    constructor(
      url: string,
      status: number = 200,
      statusText: string = 'OK',
      headers: Record<string, string> = {},
      request: NavigationRequest | null = null
    ) {
      this._url = url;
      this._status = status;
      this._statusText = statusText;
      // Normalize header names to lower-case for consistent lookups
      const normalized: Record<string, string> = {};
      for (const k of Object.keys(headers)) {
        normalized[k.toLowerCase()] = headers[k];
      }
      this._headers = normalized;
      this._request = request;
    }

    url(): string {
      return this._url;
    }

    status(): number {
      return this._status;
    }

    statusText(): string {
      return this._statusText;
    }

    headers(): Record<string, string> {
      return { ...this._headers };
    }

    headerValue(name: string): string | undefined {
      return this._headers[name.toLowerCase()];
    }

    request(): NavigationRequest {
      // For now, return a minimal request object if none provided
      return (
        this._request ||
        ({
          id: '',
          url: this._url,
          method: 'GET',
          resourceType: 'document',
          headers: {},
          timestamp: Date.now(),
          response: async () => null,
          _finalRequest: () => this._request!,
        } as NavigationRequest)
      );
    }

    ok(): boolean {
      return this._status >= 200 && this._status < 300;
    }
  };
}

/**
 * Frame class for managing frame interactions in Chrome extensions.
 *
 * This implementation provides a high-level API for interacting with frames,
 * including element selection, form interaction, and content execution.
 * Navigation is handled through the NavigationTracker for better reliability.
 */
export class Frame extends Disposable {
  // Event emitters for frame lifecycle events based on Playwright's Frame events
  private readonly _onInternalNavigation = this._register(new Emitter<NavigationEvent>());
  private readonly _onAddLifecycle = this._register(new Emitter<LifecycleEvent>());
  private readonly _onRemoveLifecycle = this._register(new Emitter<LifecycleEvent>());

  // StateAware lifecycle events for specific event types (similar to Page API)
  private readonly _onDomContentLoaded = this._register(new StateAwareEvent<LifecycleEvent>());
  private readonly _onLoad = this._register(new StateAwareEvent<LifecycleEvent>());

  // Public event interfaces matching Playwright's Frame event system
  public readonly onInternalNavigation: Event<NavigationEvent> = this._onInternalNavigation.event;
  public readonly onAddLifecycle: Event<LifecycleEvent> = this._onAddLifecycle.event;
  public readonly onRemoveLifecycle: Event<LifecycleEvent> = this._onRemoveLifecycle.event;

  // StateAware lifecycle events - fire immediately if already occurred
  public readonly onDomContentLoaded = this._onDomContentLoaded.event;
  public readonly onLoad = this._onLoad.event;

  _currentDocument: DocumentInfo;
  private _pendingDocument: DocumentInfo | undefined;
  private _raceAgainstEvaluationStallingEventsPromises = new Set<ManualPromise<unknown>>();

  private _parentFrame: Frame | null;
  private _childFrames = new Set<Frame>();
  public frameId: number;
  public readonly frameManager: FrameManager;
  private _url?: string;
  private _name: string = '';
  private _context?: FrameExecutionContext;
  readonly selectors: FrameSelectors;
  readonly fileTransferPortController: FileTransferPortController;
  readonly _detachedScope = new LongStandingScope();
  _firedLifecycleEvents = new Set<LifecycleEvent>();
  private _contextData = new Map<World, ContextData>();
  readonly _redirectedNavigations = new Map<
    string,
    { url: string; gotoPromise: Promise<NavigationResponse | null> }
  >(); // documentId -> data
  private _navigationTrackerDisposable: { dispose(): void } | null = null;
  private _webNavigationDisposables: Array<{ dispose(): void }> = [];

  constructor(
    frameId: number,
    frameManager: FrameManager,
    parentFrame: Frame | null,
    url?: string
  ) {
    super();
    this.frameId = frameId;
    this.frameManager = parentFrame ? parentFrame.frameManager : frameManager;

    this._parentFrame = parentFrame;
    this._url = url;
    this._currentDocument = { documentId: undefined, request: undefined };
    this.selectors = new FrameSelectors(this);
    this.fileTransferPortController = this._register(new FileTransferPortController());

    // Add this frame to parent's children
    if (parentFrame) {
      parentFrame._childFrames.add(this);
      // Ensure this frame is removed from parent when disposed
      this._register({
        dispose: () => {
          if (parentFrame) {
            parentFrame._childFrames.delete(this);
          }
        },
      });
    }
    // Set up NavigationTracker event bridge for lifecycle synchronization
    this._setupNavigationTrackerBridge();
  }

  /**
   * Get the current tab ID dynamically from the frame manager.
   * This ensures the tab ID is always current, even after tab switches.
   */
  get tabId(): number {
    return this.frameManager.tabId;
  }

  // #region START nav

  setPendingDocument(documentInfo: DocumentInfo | undefined) {
    this._pendingDocument = documentInfo;
    if (documentInfo)
      this._invalidateNonStallingEvaluations('Navigation interrupted the evaluation');
  }

  pendingDocument(): DocumentInfo | undefined {
    return this._pendingDocument;
  }

  _invalidateNonStallingEvaluations(message: string) {
    if (!this._raceAgainstEvaluationStallingEventsPromises.size) return;
    const error = new Error(message);
    for (const promise of this._raceAgainstEvaluationStallingEventsPromises) promise.reject(error);
  }

  async raceAgainstEvaluationStallingEvents<T>(cb: () => Promise<T>): Promise<T> {
    if (this._pendingDocument) throw new Error('Frame is currently attempting a navigation');

    const promise = new ManualPromise<T>();
    this._raceAgainstEvaluationStallingEventsPromises.add(promise as ManualPromise<unknown>);
    try {
      return await Promise.race([cb(), promise]);
    } finally {
      this._raceAgainstEvaluationStallingEventsPromises.delete(promise as ManualPromise<unknown>);
    }
  }

  _onClearLifecycle() {
    for (const event of this._firedLifecycleEvents) this._fireRemoveLifecycle(event);
    this._firedLifecycleEvents.clear();

    // Reset StateAware lifecycle events for new navigation
    this._onDomContentLoaded.reset();
    this._onLoad.reset();

    this._onLifecycleEvent('commit');
  }

  /**
   * Called when the frame commits a navigation to a new document.
   * Invalidate and dispose the previous execution context so future evaluations
   * happen in a fresh context that will be re-created once the content script loads.
   */
  _onNewDocumentCommitted(reason: string = 'Navigated to new document'): void {
    const ctx = this._context;
    if (ctx) {
      try {
        ctx.contextDestroyed(reason);
      } catch {
        // Ignore teardown errors; the frame is transitioning to a new document.
      }
      this._context = undefined;
    }
  }

  _onLifecycleEvent(event: RegularLifecycleEvent) {
    if (this._firedLifecycleEvents.has(event)) {
      return;
    }
    this._firedLifecycleEvents.add(event);
    this._fireAddLifecycle(event);
  }

  // #endregion END nav

  /**
   * Fire internal navigation event matching Playwright's NavigationEvent structure
   * This method can be called by FrameManager during navigation lifecycle
   */
  _fireInternalNavigation(
    url: string,
    name: string = '',
    newDocument?: DocumentInfo,
    error?: Error,
    isPublic: boolean = true
  ): void {
    const navigationEvent: NavigationEvent = {
      url,
      name,
      newDocument,
      error,
      isPublic,
    };
    this._onInternalNavigation.fire(navigationEvent);
  }

  /**
   * Fire add lifecycle event
   */
  private _fireAddLifecycle(lifecycle: LifecycleEvent): void {
    this._onAddLifecycle.fire(lifecycle);

    // Also fire specific StateAwareEvent for the lifecycle type
    if (lifecycle === 'domcontentloaded') {
      this._onDomContentLoaded.fire(lifecycle);
    } else if (lifecycle === 'load') {
      this._onLoad.fire(lifecycle);
    }
  }

  /**
   * Fire remove lifecycle event
   */
  private _fireRemoveLifecycle(lifecycle: LifecycleEvent): void {
    this._onRemoveLifecycle.fire(lifecycle);
  }

  /**
   * Wait for navigation using VS Code Event system
   * Chrome extension-compatible version of Playwright's waitForNavigation
   */
  async waitForNavigation(
    progress: Progress,
    options: { waitUntil?: LifecycleEvent; timeout?: number } = {}
  ): Promise<NavigationResponse | null> {
    const waitUntil = verifyLifecycle('waitUntil', options.waitUntil || 'load');
    const timeout = options.timeout || 30000;

    return new Promise<NavigationResponse | null>((resolve, reject) => {
      const disposables: { dispose(): void }[] = [];
      let navigationReceived = false;
      let lifecycleReceived = false;
      let pendingNavigation: NavigationEvent | null = null;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        disposables.forEach(d => d.dispose());
        reject(new Error(`Navigation timeout of ${timeout}ms exceeded`));
      }, timeout);

      const cleanup = () => {
        clearTimeout(timeoutHandle);
        disposables.forEach(d => d.dispose());
      };

      const checkCompletion = () => {
        if (navigationReceived && lifecycleReceived && pendingNavigation) {
          cleanup();
          // Return null for now - response plumbing can be added later
          resolve(null);
        }
      };

      // Listen for navigation events
      const navigationDisposable = this.onInternalNavigation((navEvent: NavigationEvent) => {
        if (navEvent.error) {
          cleanup();
          reject(navEvent.error);
          return;
        }
        navigationReceived = true;
        pendingNavigation = navEvent;
        checkCompletion();
      });
      disposables.push(navigationDisposable);

      // Listen for lifecycle events
      const lifecycleDisposable = this.onAddLifecycle((lifecycle: LifecycleEvent) => {
        if (lifecycle === waitUntil) {
          lifecycleReceived = true;
          checkCompletion();
        }
      });
      disposables.push(lifecycleDisposable);

      // Clean up when progress is aborted
      progress.cleanupWhenAborted(cleanup);
    });
  }

  /**
   * Internal navigation waiting method with Playwright-compatible signature
   * Used by reload() and other navigation methods that need requiresNewDocument flag
   */
  async _waitForNavigation(
    progress: Progress,
    requiresNewDocument: boolean,
    options: { waitUntil?: LifecycleEvent; timeout?: number } = {}
  ): Promise<NavigationResponse | null> {
    const waitUntil = verifyLifecycle('waitUntil', options.waitUntil || 'load');

    // Safe progress logging - check if progress.log exists
    if (progress && typeof progress.log === 'function') {
      progress.log(`waiting for navigation until "${waitUntil}"`);
    }
    // If progress is not provided, log to console

    const navigationEvent = await Frame.waitForEvent(
      progress,
      this.onInternalNavigation,
      (event: NavigationEvent) => {
        // Any failed navigation results in a rejection
        if (event.error) {
          return true;
        }
        // Check if we require a new document (for reload vs pushState distinction)
        if (requiresNewDocument && !event.newDocument) {
          return false;
        }

        // Safe progress logging
        if (progress && typeof progress.log === 'function') {
          progress.log(`  navigated to "${this._url}"`);
        }

        return true;
      },
      options.timeout || 30000
    );
    // Check for navigation error
    if (navigationEvent.error) {
      throw navigationEvent.error;
    }
    const isSameDocument = !navigationEvent.newDocument;
    const shouldSkipLifecycleWait = isSameDocument && waitUntil !== 'commit';
    if (!shouldSkipLifecycleWait && !this._firedLifecycleEvents.has(waitUntil)) {
      await Frame.waitForEvent(
        progress,
        this.onAddLifecycle,
        (e: LifecycleEvent) => {
          return e === waitUntil;
        },
        options.timeout || 30000
      );
    }

    // Extract request and return response (or null)
    const request = navigationEvent.newDocument ? navigationEvent.newDocument.request : undefined;
    if (request) {
      return null;
    }
    return null;
  }

  /**
   * Wait for a specific lifecycle state to be reached
   * Chrome extension-compatible version of Playwright's _waitForLoadState
   */
  async _waitForLoadState(progress: Progress, state: LifecycleEvent): Promise<void> {
    const waitUntil = verifyLifecycle('state', state);

    // Check if the requested lifecycle event is already satisfied or implied
    const isAlreadySatisfied = this._firedLifecycleEvents.has(waitUntil);
    const isImpliedByLaterEvents = this._isLifecycleEventImplied(waitUntil);

    if (isAlreadySatisfied) {
      return;
    }

    if (isImpliedByLaterEvents) {
      // Mark the implied event as fired for consistency
      this._firedLifecycleEvents.add(waitUntil);
      this._fireAddLifecycle(waitUntil);
      return;
    }

    // For cases where we might be on an already-loaded page, check document readyState
    if (waitUntil === 'load' || waitUntil === 'domcontentloaded') {
      try {
        const readyState = await this.evaluate(() => document.readyState);

        if (
          readyState === 'complete' &&
          (waitUntil === 'load' || waitUntil === 'domcontentloaded')
        ) {
          this._firedLifecycleEvents.add(waitUntil);
          this._fireAddLifecycle(waitUntil);
          if (waitUntil === 'load') {
            // Also mark domcontentloaded as satisfied since load implies it
            if (!this._firedLifecycleEvents.has('domcontentloaded')) {
              this._firedLifecycleEvents.add('domcontentloaded');
              this._fireAddLifecycle('domcontentloaded');
            }
          }
          return;
        }

        if (readyState === 'interactive' && waitUntil === 'domcontentloaded') {
          this._firedLifecycleEvents.add('domcontentloaded');
          this._fireAddLifecycle('domcontentloaded');
          return;
        }
      } catch (error) {
        // Could not check readyState, continue with normal waiting
      }
    }
    // Use progress.race to respect the timeout from executeWithProgress instead of hardcoded 30s
    await progress.race(
      Frame.waitForEvent(
        progress,
        this.onAddLifecycle,
        (e: LifecycleEvent) => {
          return e === waitUntil;
        },
        30000 // This becomes irrelevant as progress.race will handle timeout
      )
    );
  }

  /**
   * Check if a lifecycle event is implied by later events that have already fired
   * For example, if 'load' has fired, then 'domcontentloaded' is implied
   */
  private _isLifecycleEventImplied(event: LifecycleEvent): boolean {
    switch (event) {
      case 'domcontentloaded':
        // If 'load' has fired, then 'domcontentloaded' must have already occurred
        return this._firedLifecycleEvents.has('load');
      case 'commit':
        // If 'domcontentloaded' or 'load' has fired, then 'commit' must have already occurred
        return (
          this._firedLifecycleEvents.has('domcontentloaded') ||
          this._firedLifecycleEvents.has('load')
        );
      default:
        return false;
    }
  }

  /**
   * Helper method to wait for specific events using VS Code Event system
   * Chrome extension-compatible replacement for Playwright's helper.waitForEvent
   */
  static waitForEvent<T>(
    progress: Progress,
    event: Event<T>,
    predicate?: (eventArg: T) => boolean,
    timeout: number = 30000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let disposable: { dispose(): void } | null = null;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        if (disposable) disposable.dispose();
        reject(new Error(`Event timeout of ${timeout}ms exceeded`));
      }, timeout);

      const cleanup = () => {
        clearTimeout(timeoutHandle);
        if (disposable) disposable.dispose();
      };

      // Listen for the event
      disposable = event((eventArg: T) => {
        try {
          if (predicate && !predicate(eventArg)) {
            return; // Continue waiting
          }
          cleanup();
          resolve(eventArg);
        } catch (e) {
          cleanup();
          reject(e);
        }
      });

      // Clean up when progress is aborted
      // Safety check for progress.cleanupWhenAborted
      if (progress && typeof progress.cleanupWhenAborted === 'function') {
        progress.cleanupWhenAborted(cleanup);
      } else {
        // Still register cleanup in case we need it, but without progress support
      }
    });
  }

  public async _retryWithProgressAndTimeouts<R>(
    progress: Progress,
    timeouts: readonly number[] = DEFAULT_RETRY_TIMEOUTS,
    action: (continuePolling: symbol) => Promise<R | symbol>
  ): Promise<R> {
    const continuePolling = Symbol('continuePolling');
    // Prepend zero to ensure immediate first attempt
    const delays = [0, ...timeouts];
    let idx = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const delay = delays[Math.min(idx++, delays.length - 1)];
      if (delay) {
        // race a simple timeout against any page/frame abort signals
        await progress.race(new Promise(f => setTimeout(f, delay)));
      }
      try {
        const result = await action(continuePolling);
        if (result !== continuePolling) {
          return result as R;
        }
        // else loop and retry
      } catch (e) {
        // If it's a "hard" error, bubble up; otherwise retry
        if ((e as Error).message.includes('not connected')) {
          continue;
        }
        throw e;
      }
    }
  }

  _onDetached() {
    this._detachedScope.close(new Error('Frame was detached'));
    for (const data of this._contextData.values()) {
      if (data.context) data.context.contextDestroyed('Frame was detached');
      data.contextPromise.resolve({ destroyedReason: 'Frame was detached' });
    }
    if (this._parentFrame) this._parentFrame._childFrames.delete(this);
    this._parentFrame = null;
  }

  isDetached(): boolean {
    return this._detachedScope.isClosed();
  }

  async raceNavigationAction(
    progress: Progress,
    action: () => Promise<NavigationResponse | null>
  ): Promise<NavigationResponse | null> {
    return LongStandingScope.raceMultiple(
      [this._detachedScope, this.frameManager.page.openScope],
      action().catch(e => {
        if (e instanceof NavigationAbortedError && e.documentId) {
          const data = this._redirectedNavigations.get(e.documentId);
          if (data) {
            // Safe progress logging
            if (progress && typeof progress.log === 'function') {
              progress.log(`waiting for redirected navigation to "${data.url}"`);
            }
            return progress.race(data.gotoPromise);
          }
        }
        throw e;
      })
    );
  }

  /**
   * Wait for a timeout that is cancelable by a Progress instance.
   * @param progress Progress controller that supports .wait(timeout)
   * @param timeout Timeout in milliseconds to wait
   */
  async waitForTimeout(timeout: number, progress?: Progress): Promise<void> {
    // Use the provided Progress if available so callers can cancel the wait.
    return executeWithProgress(async p => p.wait(timeout), { timeout, progress });
  }

  redirectNavigation(url: string, documentId: string, referer: string | undefined) {
    const controller = new ProgressController(30000); // 30 second timeout
    const data = {
      url,
      gotoPromise: controller.run(() => this.goto(url, { referer, timeout: 30000 })),
    };
    this._redirectedNavigations.set(documentId, data);
    data.gotoPromise.finally(() => this._redirectedNavigations.delete(documentId));
  }

  /**
   * Navigate this frame using a Playwright-style algorithm backed by NavigationTracker.
   * - Initiates navigation via chrome.tabs.update
   * - Waits for 'commit', then for the requested lifecycle (default 'commit')
   * - Returns null (response plumbing can be added later)
   */
  async goto(
    url: string,
    options?: NavigateOptionsWithProgress
  ): Promise<NavigationResponse | null> {
    if (this._parentFrame) {
      throw new Error('Child frame navigation not yet implemented');
    }

    // Resolve against current URL (if any) to support relative navigation inputs
    let absoluteUrl = url;
    try {
      // If current frame URL is available, use it as base for relative paths
      const base = this._url ? new URL(this._url) : undefined;
      absoluteUrl = base ? new URL(url, base).toString() : new URL(url).toString();
    } catch {
      // If URL parsing fails, keep the original string; the subsequent validator will catch it
      absoluteUrl = url;
    }

    // Security: block unsupported or dangerous URL schemes early
    if (!this._isAllowedNavigationUrl(absoluteUrl)) {
      throw new Error(
        `Blocked navigation to disallowed URL scheme: ${absoluteUrl}. Only http(s) URLs are permitted.`
      );
    }

    const waitUntil = options?.waitUntil ?? 'commit'; // Use 'commit' for better reliability
    const timeoutMs = options?.timeout ?? 30000;

    return executeWithProgress(async p => {
      const tracker = getNavigationTracker();

      // Initiate navigation using content script injection to create proper browser history
      // chrome.tabs.update() does NOT create browser history entries, but window.location.assign() does
      p.log(`Frame ${this.frameId} navigating to "${absoluteUrl}" (with history)`);

      try {
        // Use content script injection to navigate with proper history
        await chrome.scripting.executeScript({
          target: { tabId: this.tabId, allFrames: false },
          world: 'MAIN',
          func: (targetUrl: string) => {
            // Use window.location.assign() to create a proper history entry
            window.location.assign(targetUrl);
          },
          args: [absoluteUrl],
        });
      } catch (error) {
        // Fallback to chrome.tabs.update if content script injection fails
        console.warn(
          `Content script navigation failed for tab ${this.tabId}, falling back to chrome.tabs.update:`,
          error
        );
        chrome.tabs.update(this.tabId, { url: absoluteUrl });
      }

      // Wait for navigation to complete with the requested lifecycle
      p.log(`Waiting for navigation until "${waitUntil}"`);

      const trackerPromise = tracker.waitForNavigation(this.tabId, this.frameId, {
        // Do not pass toUrl to allow redirects (e.g., path changes) to resolve
        waitUntil,
        timeoutMs,
      });

      let navEv: InternalNavigation;
      try {
        navEv = await trackerPromise;
        p.log('Navigation tracker completed successfully');
      } catch (error) {
        p.log(`Navigation tracker failed: ${String(error)}`);
        throw error;
      }

      // Update our URL to the committed one (could differ due to redirects)
      this.setUrl(navEv.url);

      // Fire internal navigation event
      this._fireInternalNavigation(
        navEv.url,
        '', // frame name - not available from NavigationTracker currently
        navEv.newDocument
          ? {
              documentId: navEv.newDocument.documentId,
              request: undefined, // request not available from NavigationTracker
            }
          : undefined
      );

      // Create a NavigationResponse using NetworkObserver if available
      const net = getNetworkObserver();
      let status = 200;
      let statusText = 'OK';
      let headers: Record<string, string> = {};
      try {
        // Best effort: wait briefly for the main-frame response to be recorded
        const resp = await net
          .waitForMainFrameResponse(this.tabId, this.frameId, navEv.url, 2000)
          .catch(() => net.getResponse(this.tabId, this.frameId, navEv.url));
        if (resp) {
          status = resp.status || status;
          headers = resp.headers || headers;
          // Chrome doesn't provide reason phrase; synthesize from status where possible
          statusText = status >= 200 && status < 300 ? 'OK' : `${status}`;
        }
      } catch {
        // Ignore network observer errors — fallback to defaults
      }

      const navigationResponse = new Network.NavigationResponse(
        navEv.url,
        status,
        statusText,
        headers,
        null
      );

      return navigationResponse;
    }, options);
  }

  /**
   * Wait for a specific lifecycle state to be reached
   * Chrome extension-compatible version of Playwright's waitForLoadState
   */
  async waitForLoadState(
    state: LifecycleEvent = 'load',
    options: TimeoutOptions = {}
  ): Promise<void> {
    return executeWithProgress(async progress => {
      const verifiedState = verifyLifecycle('state', state);
      progress.log(`Waiting for load state "${verifiedState}"`);

      // For networkidle, delegate to content script readiness (new approach)
      if (verifiedState === 'networkidle') {
        progress.log(
          `Frame.waitForLoadState: Delegating 'networkidle' to content script readiness system`
        );

        try {
          await this.waitForContentScriptReady(progress);
          progress.log('Frame.waitForLoadState: Content script readiness completed successfully');
          return;
        } catch (error) {
          progress.log(`Frame.waitForLoadState: Content script readiness failed: ${error}`);
          throw error;
        }
      }

      // For Chrome internal pages, apply timeout protection
      const url = this.url();
      if (url?.startsWith('chrome://') || url?.startsWith('chrome-untrusted://')) {
        progress.log(
          `Frame.waitForLoadState: Chrome internal page detected (${url}) - applying timeout protection`
        );

        const timeout = options.timeout ?? 5000; // Shorter timeout for Chrome pages
        try {
          await Promise.race([
            this._waitForLoadState(progress, verifiedState),
            new Promise<void>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Frame load state timed out after ${timeout}ms`)),
                timeout
              )
            ),
          ]);
        } catch (error) {
          if (error instanceof Error && error.message.includes('timed out')) {
            progress.log(
              `Frame.waitForLoadState: Timeout for Chrome internal page - continuing gracefully`
            );
            return;
          }
          throw error;
        }
      } else {
        // Normal behavior for regular pages
        await this._waitForLoadState(progress, verifiedState);
      }

      progress.log(`Load state "${verifiedState}" reached`);
    }, options);
  }

  origin(): string | undefined {
    if (!this._url || !this._url.startsWith('http')) {
      return undefined;
    }
    return parseURL(this._url)?.origin;
  }

  name(): string {
    return this._name;
  }

  setName(name: string): void {
    this._name = name;
  }

  dispose(): void {
    // Clean up NavigationTracker bridge
    if (this._navigationTrackerDisposable) {
      this._navigationTrackerDisposable.dispose();
      this._navigationTrackerDisposable = null;
    }

    // Clean up web navigation listeners
    if (this._webNavigationDisposables.length > 0) {
      for (const disposable of this._webNavigationDisposables) {
        disposable.dispose();
      }
      this._webNavigationDisposables = [];
    }

    super.dispose();
  }

  _setContext(context: FrameExecutionContext): void {
    this._context = context;
  }

  /**
   * Get execution context with automatic content script readiness.
   * This is the primary way to access the frame's execution context.
   *
   * @deprecated Use `await frame.getContext()` instead for automatic readiness handling
   */
  get context(): FrameExecutionContext {
    if (!this._context) {
      throw new Error(
        `Frame ${this.frameId} has no execution context. Use 'await frame.getContext()' for automatic readiness handling.`
      );
    }
    return this._context;
  }

  /**
   * Get execution context with automatic content script readiness check.
   * This is the recommended way to access frame context in all operations.
   *
   * @param progress Optional progress controller for timeout and cancellation
   * @returns Promise resolving to the frame's execution context
   */
  async getContext(progress?: Progress): Promise<FrameExecutionContext> {
    const logPrefix = `🔧 Frame ${this.frameId} getContext():`;
    progress?.log(`${logPrefix} Starting getContext call`);

    if (this._context) {
      progress?.log(`${logPrefix} Context already exists, returning immediately`);
      return this._context;
    }

    progress?.log(`${logPrefix} No context found, waiting for content script readiness`);

    // Test frame connectivity with direct chrome.scripting instead of this.evaluate
    // to avoid circular dependency
    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId, frameIds: [this.frameId] },
        func: () => true,
        world: 'MAIN',
      });
    } catch (evalError) {
      // If we can't evaluate, frame might be unresponsive but continue anyway
      console.warn(
        `Frame ${this.frameId} connectivity test failed, continuing anyway: ${evalError}`
      );
    }

    // Add timeout to content script readiness - reduced from 10s to 2s for better UX
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`Frame ${this.frameId} content script readiness timed out after 2 seconds`)
        );
      }, 2000); // Reduced from 10000ms to 2000ms
    });

    // Wait for content script readiness and execution context creation
    await Promise.race([this.waitForContentScriptReady(progress), timeoutPromise]);
    progress?.log(`${logPrefix} Content script readiness complete`);

    // If context is still undefined after content script is ready,
    // it may have been cleared during navigation. Recreate it.
    if (!this._context) {
      progress?.log(`${logPrefix} Context still null, creating execution context`);
      this.frameManager.page.createExecutionContext(this);
      progress?.log(`${logPrefix} Execution context creation call completed`);
    }

    // Handle edge case where context creation is still delayed
    if (!this._context) {
      progress?.log(`${logPrefix} Context still null, waiting for context creation`);
      await this._waitForContextCreation();
      progress?.log(`${logPrefix} Context creation wait completed`);
    }

    progress?.log(`${logPrefix} Returning context successfully`);
    return this._context!;
  }

  /**
   * Internal helper to wait for execution context creation with timeout
   */
  private async _waitForContextCreation(): Promise<void> {
    const timeout = 5000;
    const pollInterval = 50;
    const startTime = Date.now();

    while (!this._context && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    if (!this._context) {
      throw new Error(
        `Frame ${this.frameId} execution context was not created within ${timeout}ms after content script readiness. ` +
          `This may indicate a content script loading issue.`
      );
    }
  }

  /**
   * Access the shared Session via its manager.
   */
  get session() {
    return this.frameManager.page.session;
  }

  get mainFrame() {
    return this.frameManager.mainFrame();
  }

  parentFrame(): Frame | null {
    return this._parentFrame;
  }

  childFrames(): Frame[] {
    return Array.from(this._childFrames);
  }

  clearChildFrames(): void {
    for (const childFrame of this._childFrames) {
      childFrame.dispose();
    }
    this._childFrames.clear();
  }

  title(): Promise<string> {
    // For Chrome extension pages and other system pages that don't allow content script injection,
    // we should get the title from the tab metadata instead of trying to evaluate document.title
    const url = this._url;
    if (
      url &&
      (url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:'))
    ) {
      // For system pages, get title from chrome.tabs API instead of script injection
      return this._getTitleFromTabMetadata();
    }

    // For regular pages, use the standard evaluate method
    return this.evaluate(() => document.title);
  }

  /**
   * Get page title from Chrome tabs API for system pages that don't allow script injection
   */
  private async _getTitleFromTabMetadata(): Promise<string> {
    try {
      const tab = await chrome.tabs.get(this.tabId);
      return tab.title || 'Unknown';
    } catch (error) {
      // Fallback to URL hostname or default
      const url = this._url;
      if (url) {
        try {
          return new URL(url).hostname;
        } catch {
          return 'Unknown';
        }
      }
      return 'Unknown';
    }
  }

  url(): string | undefined {
    return this._url;
  }
  setUrl(url: string): void {
    this._url = url;
  }

  async waitForSelector(
    progress: Progress,
    selector: string,
    performActionPreChecksAndLog: boolean,
    options: WaitForElementOptions,
    scope?: ElementHandle
  ): Promise<ElementHandle | null> {
    // Validate options
    const { state = 'visible' } = options;
    validateWaitState(state);

    // Log once if requested
    if (performActionPreChecksAndLog) {
      progress.log(createSelectorWaitMessage(selector, state));
    }
    // Main retry loop
    return this._retryWithProgressAndTimeouts(
      progress,
      DEFAULT_RETRY_TIMEOUTS,
      async continuePolling => {
        // Step 1: Resolve selector metadata
        const resolved = await progress.race(
          this.selectors.resolveInjectedForSelector(selector, options, scope)
        );
        if (!resolved) {
          // For hidden/detached states, null means success
          if (state === 'hidden' || state === 'detached') {
            return null;
          }
          return continuePolling;
        }

        const context = await resolved.frame.getContext();

        const result = await progress.race(
          context.waitForSelectorEvaluation(
            resolved.info.parsed,
            resolved.info.strict,
            resolved.frame === this && scope ? scope.remoteObject : null,
            selector,
            resolved.info.world
          )
        );

        if (!result) {
          // For hidden/detached states, null means success
          if (state === 'hidden' || state === 'detached') {
            return null;
          }
          return continuePolling;
        }

        // Step 3: Process result
        const { log, elementHandle, visible, attached, error } = result;

        // Handle errors from content script
        if (error) {
          throw new Error(`Selector evaluation failed: ${error}`);
        }

        // Log any messages from content script
        if (log) {
          progress.log(log);
        }

        // Step 4: Check if current state matches desired state
        if (!doesStateMatch(state, visible, attached)) {
          return continuePolling; // Keep retrying
        }

        // Step 5: Handle return value based on options and state
        if (!shouldReturnElementHandle(state, options.omitReturnValue)) {
          return null; // User doesn't need the element or element shouldn't be used
        }

        // Step 6: Return ElementHandle for attached/visible states
        if (elementHandle) {
          const context = await resolved.frame.getContext();
          return new ElementHandle(context, elementHandle);
        }

        return null;
      }
    );
  }

  isNonRetriableError(e: Error) {
    return isNonRetriableError(e);
  }

  // #region Dom Interaction

  /**
   * Helper method to execute an action with an ElementHandle, handling the lifecycle of
   * getting the handle, executing the action, and disposing of the handle.
   */
  private async _executeWithElementHandle<T>(
    selector: string,
    timeout: number,
    action: (handle: ElementHandle, progress: Progress) => Promise<T>
  ): Promise<T> {
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, { strict: true });

        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }

        try {
          const result = await action(handle, progress);
          return result;
        } finally {
          handle.dispose();
        }
      },
      { timeout }
    );
  }

  /**
   * Click a selector, but only after the frame has loaded.
   */
  async click(selector: string, options?: ClickOptions): Promise<void> {
    // Simplified click without auto-wait since we use content script readiness
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.clickWithProgress(progress, options)
    );
  }

  async dblclick(selector: string, options?: ClickOptions): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.dblclickWithProgress(progress, options)
    );
  }

  async tap(selector: string, options?: ClickOptions): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.tapWithProgress(progress, options)
    );
  }

  async dispatchEvent(
    selector: string,
    type: string,
    eventInit: Record<string, unknown> = {},
    options?: { timeout?: number }
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.dispatchEventWithProgress(progress, type, eventInit)
    );
  }

  /**
   * Perform a drag and drop operation from source selector to target selector.
   *
   * @param source The CSS selector of the source element to drag from
   * @param target The CSS selector of the target element to drop to
   * @param options Optional drag and drop configuration
   * @returns Promise that resolves when drag and drop is complete
   *
   * @example
   * ```typescript
   * // Basic drag and drop
   * await frame.dragAndDrop('#source-element', '#target-element');
   *
   * // With custom positions
   * await frame.dragAndDrop('#source', '#target', {
   *   sourcePosition: { x: 10, y: 10 },
   *   targetPosition: { x: 50, y: 50 }
   * });
   * ```
   */
  async dragAndDrop(
    source: string,
    target: string,
    options: FrameDragAndDropOptions & { timeout?: number } = {}
  ): Promise<void> {
    const timeout = options.timeout || 30000;

    return await executeWithProgress(
      async progress => {
        progress.log(`Starting drag and drop from "${source}" to "${target}"`);

        // Get both source and target elements first to ensure they exist
        const sourceHandle = await this.waitForSelector(progress, source, false, { strict: true });
        if (!sourceHandle) {
          throw new Error(createElementNotFoundError(source));
        }

        const targetHandle = await this.waitForSelector(progress, target, false, { strict: true });
        if (!targetHandle) {
          sourceHandle.dispose();
          throw new Error(createElementNotFoundError(target));
        }

        try {
          // Get bounding boxes for position calculations
          const sourceBox = await sourceHandle.boundingBox();
          const targetBox = await targetHandle.boundingBox();

          if (!sourceBox) {
            throw new Error(createBoundingBoxError(source, 'no bounding box'));
          }
          if (!targetBox) {
            throw new Error(createBoundingBoxError(target, 'no bounding box'));
          }

          const sourcePosition = options.sourcePosition || calculateCenterPosition(sourceBox);
          const targetPosition = options.targetPosition || calculateCenterPosition(targetBox);

          // Use the improved drag and drop simulation with DataTransfer
          const context = await this.getContext(progress);
          await context.executeScript(
            createDragAndDropScript(),
            'MAIN',
            source,
            target,
            sourcePosition,
            targetPosition
          );

          progress.log(`Drag and drop from "${source}" to "${target}" completed successfully`);
        } finally {
          // Always dispose of handles
          sourceHandle.dispose();
          targetHandle.dispose();
        }
      },
      { timeout }
    );
  }

  /**
   * Chrome extension version of Playwright's rafrafTimeout.
   * Waits for double requestAnimationFrame and timeout using content script execution.
   */
  async rafrafTimeout(progress: Progress, timeout: number): Promise<void> {
    if (timeout === 0) {
      return;
    }
    // Execute double RAF directly without progress.race wrapper
    const context = await this.getContext();
    const rafPromise = context
      .executeScript(() => {
        return new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });
      }, 'MAIN')
      .then(() => {})
      .catch(error => {
        throw error;
      });

    // Create timeout promise with progress.wait
    const timeoutPromise = progress.wait(timeout).catch(error => {
      throw error;
    });
    // Wait for both to complete
    await Promise.all([rafPromise, timeoutPromise]);
  }

  /**
   * Chrome extension version of Playwright's rafrafTimeoutScreenshotElementWithProgress.
   * Takes a screenshot of an element after waiting for animations to settle.
   */
  async rafrafTimeoutScreenshotElementWithProgress(
    progress: Progress,
    selector: string,
    timeout: number,
    options: ScreenshotOptions
  ): Promise<Buffer> {
    return await this._executeWithElementHandle(selector, 30000, async (handle, p) => {
      await this.rafrafTimeout(p, timeout);
      const bufferLike = await this.frameManager.page.screenshotter.screenshotElement(
        p,
        handle,
        options
      );

      // Convert BrowserBuffer to Node.js Buffer for compatibility
      if (
        bufferLike &&
        typeof bufferLike.length === 'number' &&
        typeof bufferLike.toString === 'function'
      ) {
        const base64 = bufferLike.toString('base64');
        const result = Buffer.from(base64, 'base64');
        return result;
      }
      return bufferLike as unknown as Buffer;
    });
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return new Locator(this, selector, options);
  }

  /**
   * Validate navigation target URL is allowed. Only http and https are permitted.
   * Chrome internal pages or extension URLs are not navigable via content scripts
   * and should be handled by callers explicitly.
   */
  private _isAllowedNavigationUrl(target: string): boolean {
    try {
      const u = new URL(target);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(testIdAttributeName(), testId));
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTitleSelector(text, options));
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.locator(getByRoleSelector(role, options));
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(this, selector);
  }

  async check(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number }
  ): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, { strict: true });
        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }
        try {
          return await handle.checkWithProgress(progress);
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 }
    );
  }

  async uncheck(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number }
  ): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, { strict: true });
        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }
        try {
          return await handle.uncheckWithProgress(progress);
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 }
    );
  }

  async setChecked(
    selector: string,
    checked: boolean,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number }
  ): Promise<void> {
    if (checked) {
      await this.check(selector, options);
    } else {
      await this.uncheck(selector, options);
    }
  }

  async fill(
    selector: string,
    value: string,
    options?: { timeout?: number; force?: boolean }
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.fillWithProgress(progress, value, options)
    );
  }

  async selectOption(
    selector: string,
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions
  ): Promise<string[]> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.selectOptionWithProgress(progress, values, options)
    );
  }

  async clear(selector: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.clearWithProgress(progress, options)
    );
  }

  /**
   * Sets files on an input element following Playwright patterns.
   * This method provides a high-level interface for setting files with proper validation.
   *
   * @param selector CSS selector for the input element
   * @param files Array of file payloads or File objects to set
   * @param options Options for the operation including timeout and force
   * @returns Promise that resolves when files are set
   *
   * @example
   * ```typescript
   * // Set files from File objects
   * await frame.setInputFiles('#file-input', [file1, file2]);
   *
   * // Set files from data with custom options
   * await frame.setInputFiles('#file-input', [
   *   { name: 'test.txt', mimeType: 'text/plain', buffer: textBuffer }
   * ], { force: true, timeout: 60000 });
   * ```
   */
  async setInputFiles(
    selector: string,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[] | File[],
    options?: { force?: boolean; directoryUpload?: boolean; timeout?: number }
  ): Promise<void> {
    // For hidden elements with force option, wait for attached state instead of visible
    const waitState = getFileInputWaitState(options?.force);

    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, {
          strict: true,
          state: waitState,
        });

        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }

        try {
          const result = await handle.setInputFilesWithProgress(progress, files, options);
          return result;
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 }
    );
  }

  async highlight(selector: string, options?: { timeout?: number }): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const context = await this.getContext(progress);
        await context.highlight(selector);
      },
      { timeout: options?.timeout || 30000 }
    );
  }

  async hideHighlight(): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const context = await this.getContext(progress);
        await context.hideHighlight();
      },
      { timeout: 30000 }
    );
  }

  /**
   * Wait for page evaluation context to be ready using a backoff strategy.
   * This method tests if page.evaluate() is working properly before attempting real evaluations.
   *
   * @param backoffDelays Array of delay times in milliseconds for each retry attempt (default: [0, 10, 20, 30, 50, 80, 100])
   * @param timeout Total timeout in milliseconds for the entire operation (default: 5000)
   * @returns Promise that resolves when page.evaluate() is working, rejects if timeout is reached
   */
  async waitForEvaluationReady(
    backoffDelays: number[] = [0, 10, 20, 30, 50, 80, 100],
    timeout: number = 5000
  ): Promise<void> {
    // First check if this frame is detached - fail fast to avoid waiting
    if (this.isDetached()) {
      throw new Error(`Frame ${this.frameId} is detached and cannot be evaluated`);
    }

    const startTime = Date.now();

    for (const delay of backoffDelays) {
      // Check if we've exceeded the total timeout
      if (Date.now() - startTime > timeout) {
        throw new Error(`Frame evaluation readiness timeout after ${timeout}ms`);
      }

      // Check if frame became detached during the wait
      if (this.isDetached()) {
        throw new Error(`Frame ${this.frameId} became detached during evaluation readiness check`);
      }

      try {
        const testPromise = this.evaluate(() => {
          return 1 + 1;
        });

        const timeoutPromise = new Promise<number>(resolve => {
          setTimeout(() => resolve(-1), delay);
        });

        const result = await Promise.race([testPromise, timeoutPromise]);

        if (result === 2) {
          return;
        }
      } catch (error) {
        // If frame became detached, don't continue with more backoff attempts
        if (this.isDetached()) {
          throw new Error(`Frame ${this.frameId} became detached during evaluation attempt`);
        }
      }
    }

    throw new Error(
      `Frame evaluation not ready after all backoff attempts: ${backoffDelays.join(', ')}ms`
    );
  }

  async evaluate<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number }
  ): Promise<R> {
    return await executeWithProgress(
      async p => {
        // Ensure execution context is ready
        const context = await this.getContext(p);

        // Pass function directly, args as rest parameters
        if (arg !== undefined) {
          const result = await context.executeScript(pageFunction, 'MAIN', arg);
          return result as R;
        } else {
          // Cast to no-arg function when no argument provided
          const noArgFunction = pageFunction as () => R;
          const result = await context.executeScript(noArgFunction, 'MAIN');
          return result as R;
        }
      },
      { timeout: options?.timeout || 30000 }
    );
  }

  async evaluateHandle<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number }
  ): Promise<ElementHandle | null> {
    return await executeWithProgress(
      async progress => {
        // Ensure execution context is ready
        const context = await this.getContext(progress);

        // Pass function directly, args as rest parameters
        if (arg !== undefined) {
          const result = await context.evaluateHandle(pageFunction, 'MAIN', arg);
          return result;
        } else {
          // Cast to no-arg function when no argument provided
          const noArgFunction = pageFunction as () => R;
          const result = await context.evaluateHandle(noArgFunction, 'MAIN');
          return result;
        }
      },
      { timeout: options?.timeout || 30000 }
    );
  }

  async queryCount(selector: string): Promise<number> {
    return await this.selectors.queryCount(selector);
  }

  async queryAll(selector: string, scope?: ElementHandle): Promise<ElementHandle[]> {
    return await this.selectors.queryAll(selector, scope);
  }

  async getAttribute(
    selector: string,
    name: string,
    options?: { timeout?: number }
  ): Promise<string | null> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.getAttribute(name)
    );
  }

  async hover(selector: string, options?: { timeout?: number }): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.hover()
    );
  }

  async innerHTML(selector: string, options?: { timeout?: number }): Promise<string> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.innerHTML()
    );
  }

  async innerText(selector: string, options?: { timeout?: number }): Promise<string> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.innerText()
    );
  }

  async textContent(selector: string, options?: { timeout?: number }): Promise<string> {
    const result = await this._executeWithElementHandle(
      selector,
      options?.timeout || 30000,
      handle => handle.textContent()
    );
    return result;
  }

  async inputValue(selector: string, options?: { timeout?: number }): Promise<string> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.inputValue()
    );
  }

  async isChecked(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isChecked()
    );
  }

  async isDisabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isDisabled()
    );
  }

  async isEditable(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isEditable()
    );
  }

  async isEnabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isEnabled()
    );
  }

  async isHidden(selector: string, options?: { timeout?: number }): Promise<boolean> {
    // For isHidden, we need to find the element whether it's visible or hidden
    // So we use state: 'attached' instead of the default 'visible'
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, {
          strict: true,
          state: 'attached',
        });

        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }

        try {
          return await handle.isHidden();
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 }
    );
  }

  async isVisible(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isVisible()
    );
  }

  async press(
    selector: string,
    key: string,
    options?: { delay?: number; timeout?: number }
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.press(key, { delay: options?.delay })
    );
  }

  async type(
    selector: string,
    text: string,
    options?: { delay?: number; timeout?: number }
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.type(text, { delay: options?.delay })
    );
  }

  /**
   * Generate an ARIA snapshot for the frame or a specific element within it.
   *
   * @param options Configuration options for the ARIA snapshot
   * @param options.forAI Whether to optimize the snapshot for AI consumption (default: true)
   * @param options.refPrefix Prefix to use for element references in the snapshot (default: '')
   * @param options.selector Optional CSS selector to target a specific element (default: entire frame)
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: 30000)
   * @returns A string representation of the ARIA accessibility tree
   *
   * @example
   * ```typescript
   * // Get ARIA snapshot of entire frame
   * const fullSnapshot = await frame.ariaSnapshot({ forAI: true });
   *
   * // Get ARIA snapshot of specific element
   * const formSnapshot = await frame.ariaSnapshot({
   *   forAI: true,
   *   selector: '#main-form',
   *   refPrefix: 'form'
   * });
   * ```
   */
  async ariaSnapshot(options?: {
    forAI?: boolean;
    refPrefix?: string;
    selector?: string;
    timeout?: number;
  }): Promise<string> {
    if (!this._context) {
      throw new Error('Frame context not available');
    }

    const forAI = options?.forAI ?? true;
    const refPrefix = options?.refPrefix ?? '';
    const timeout = options?.timeout ?? 30000;

    if (options?.selector) {
      // Get snapshot for specific element
      return this._executeWithElementHandle(options.selector, timeout, async handle => {
        if (!this._context) {
          throw new Error('Frame context not available');
        }
        const result = await this._context.ariaSnapshot(forAI, refPrefix, 'MAIN', handle);
        return typeof result === 'string' ? result : '';
      });
    } else {
      // Get snapshot for entire frame
      const result = await this._context.ariaSnapshot(forAI, refPrefix, 'MAIN');
      return typeof result === 'string' ? result : '';
    }
  }

  /**
   * Creates a file transfer port in the content script for transferring files and buffers.
   * This creates a temporary communication channel between the content script and side panel
   * specifically for file and buffer transfers.
   *
   * @param options Configuration options for the file transfer port
   * @param options.timeout Maximum time to wait for port creation in milliseconds (default: 30000)
   * @returns The port ID that can be used to communicate with the created port
   *
   * @example
   * ```typescript
   * // Create a file transfer port
   * const portId = await frame.createFileTransferPort();
   *
   * // Use the port ID with FileTransferPortController to manage transfers
   * const controller = new FileTransferPortController();
   * const port = controller.getPort(portId);
   * if (port) {
   *   await port.requestFile('#file-input');
   * }
   * ```
   */
  async createFileTransferPort(options?: { timeout?: number }): Promise<string> {
    if (!this._context) {
      throw new Error('Frame context not available');
    }

    const timeout = options?.timeout ?? 30000;

    return executeWithProgress(
      async () => {
        const portId = await this._context!.createFileTransferPort();
        if (!portId) {
          throw new Error('Failed to create file transfer port');
        }
        return portId;
      },
      { timeout }
    );
  }

  async maskSelectors(selectors: ParsedSelector[], color: string): Promise<void> {
    if (!this._context) {
      throw new Error('Frame context not available');
    }

    await this._context.executeScript(
      (parsedSelectors: unknown[], maskColor: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        if (injected && injected.maskSelectors) {
          injected.maskSelectors(parsedSelectors, maskColor);
        }
      },
      'MAIN',
      selectors as unknown[],
      color
    );
  }

  /**
   * Network request management methods for tracking inflight requests
   * These methods provide interface compatibility with browser-use context expectations
   */

  /**
   * Get the full HTML content of the frame including doctype and document element.
   * Chrome extension-compatible version of Playwright's frame.content()
   * @returns Promise resolving to the complete HTML content as a string
   */
  async content(): Promise<string> {
    try {
      return await this.evaluate(() => {
        let retVal = '';
        if (document.doctype) {
          retVal = new XMLSerializer().serializeToString(document.doctype);
        }
        if (document.documentElement) {
          retVal += document.documentElement.outerHTML;
        }
        return retVal;
      });
    } catch (e) {
      if (e instanceof Error && this.isNonRetriableError(e)) {
        throw e;
      }
      throw new Error(
        'Unable to retrieve content because the page is navigating and changing the content.'
      );
    }
  }

  /**
   * Set up the NavigationTracker event bridge to synchronize chrome.webNavigation
   * lifecycle events with Frame's _firedLifecycleEvents. This ensures that
   * click-triggered navigation properly updates Frame lifecycle state.
   */
  private _setupNavigationTrackerBridge(): void {
    const navigationTracker = getNavigationTracker();

    // Subscribe to NavigationTracker events for this specific frame
    this._navigationTrackerDisposable = navigationTracker.onInternalNavigation(navEvent => {
      // Only handle events for this specific frame
      if (navEvent.tabId !== this.tabId || navEvent.frameId !== this.frameId) {
        return;
      }
      // Update frame URL if provided
      if (navEvent.url && navEvent.url !== this._url) {
        this.setUrl(navEvent.url);
      }

      // Fire navigation event through Frame's event system
      this._fireInternalNavigation(
        navEvent.url,
        '', // frame name not available from NavigationTracker
        navEvent.newDocument
          ? {
              documentId: navEvent.newDocument.documentId,
              request: undefined,
            }
          : undefined,
        undefined, // no error
        true // isPublic
      );

      // Synchronize lifecycle events by checking NavigationTracker's internal state
      // This is the key bridge: when NavigationTracker marks lifecycle events,
      // we also mark them in Frame's _firedLifecycleEvents
      this._syncLifecycleFromNavigationTracker(navEvent);
    });

    // Set up direct chrome.webNavigation listeners for more precise lifecycle tracking
    this._setupWebNavigationLifecycleBridge();
  }

  /**
   * Set up direct chrome.webNavigation listeners to ensure Frame lifecycle events
   * are properly synchronized with browser navigation events. This provides more
   * reliable lifecycle tracking than inferring from NavigationTracker.
   */
  private _setupWebNavigationLifecycleBridge(): void {
    // Listen for DOMContentLoaded events
    const onDOMContentLoaded = (
      details: chrome.webNavigation.WebNavigationFramedCallbackDetails
    ) => {
      if (details.tabId === this.tabId && details.frameId === this.frameId) {
        if (!this._firedLifecycleEvents.has('domcontentloaded')) {
          this._onLifecycleEvent('domcontentloaded');
        }
      }
    };

    // Listen for Completed (load) events
    const onCompleted = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
      if (details.tabId === this.tabId && details.frameId === this.frameId) {
        if (!this._firedLifecycleEvents.has('load')) {
          this._onLifecycleEvent('load');
        }
      }
    };

    // Listen for Committed events
    const onCommitted = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      if (details.tabId === this.tabId && details.frameId === this.frameId) {
        if (!this._firedLifecycleEvents.has('commit')) {
          this._onLifecycleEvent('commit');
        }
      }
    };

    // Add listeners to chrome.webNavigation
    chrome.webNavigation.onDOMContentLoaded.addListener(onDOMContentLoaded);
    chrome.webNavigation.onCompleted.addListener(onCompleted);
    chrome.webNavigation.onCommitted.addListener(onCommitted);

    // Store disposables for cleanup
    this._webNavigationDisposables.push(
      { dispose: () => chrome.webNavigation.onDOMContentLoaded.removeListener(onDOMContentLoaded) },
      { dispose: () => chrome.webNavigation.onCompleted.removeListener(onCompleted) },
      { dispose: () => chrome.webNavigation.onCommitted.removeListener(onCommitted) }
    );
  }

  /**
   * Mark lifecycle events for an already-loaded page
   * This is called when the frame is created on a page that's already fully loaded
   */
  public _markAlreadyLoadedPage(): void {
    // Check if we're on a regular HTTP(S) page (not chrome:// or about:blank)
    if (this._url && this._url.startsWith('http') && this._url !== 'about:blank') {
      // Mark standard lifecycle events as already fired
      const lifecycleEvents: ('domcontentloaded' | 'load' | 'commit')[] = [
        'domcontentloaded',
        'load',
        'commit',
      ];

      for (const event of lifecycleEvents) {
        if (!this._firedLifecycleEvents.has(event)) {
          this._onLifecycleEvent(event);
        }
      }
    }
  }

  /**
   * Synchronize lifecycle events from NavigationTracker to Frame's _firedLifecycleEvents.
   * This method bridges the gap between chrome.webNavigation events and Frame lifecycle.
   */
  private _syncLifecycleFromNavigationTracker(navEvent: {
    url: string;
    newDocument?: { documentId: string };
  }): void {
    // Since NavigationTracker tracks lifecycle internally, we need to check its state
    // For navigation events, we can infer certain lifecycle states:

    if (navEvent.newDocument) {
      // New document navigation - clear existing lifecycle and start fresh
      this._onClearLifecycle();
    }

    // Always mark 'commit' for any navigation event from NavigationTracker
    if (!this._firedLifecycleEvents.has('commit')) {
      this._onLifecycleEvent('commit');
    }

    // For navigation completion, we need to check if the page has actually loaded
    // We'll use a heuristic: if this is not a new document navigation and the URL
    // is HTTP(S), we can assume DOMContentLoaded and load have likely fired
    if (!navEvent.newDocument && this._url?.startsWith('http')) {
      // Same-document navigation or completed navigation - mark standard lifecycle events
      const lifecycleEvents: ('domcontentloaded' | 'load')[] = ['domcontentloaded', 'load'];

      for (const event of lifecycleEvents) {
        if (!this._firedLifecycleEvents.has(event)) {
          this._onLifecycleEvent(event);
        }
      }
    }
  }

  /**
   * Wait for frame to be ready (content script loaded and evaluated)
   * Replaces waitForLoadState('networkidle')
   */
  async waitForContentScriptReady(progress?: Progress): Promise<void> {
    const barrier = ContentScriptReadinessManager.getInstance().getBarrier(
      this.tabId,
      this.frameId
    );
    const result = await barrier.waitForReady(progress);
    return result;
  }
}

// #region FrameLocator
export class FrameLocator {
  private _frame: Frame;
  private _frameSelector: string;

  constructor(frame: Frame, selector: string) {
    this._frame = frame;
    this._frameSelector = selector;
  }

  locator(selectorOrLocator: string | Locator, options?: LocatorOptions): Locator {
    if (isString(selectorOrLocator))
      return new Locator(
        this._frame,
        createFrameEnterSelector(this._frameSelector, selectorOrLocator),
        options
      );
    if (selectorOrLocator._frame !== this._frame)
      throw new Error(`Locators must belong to the same frame.`);
    return new Locator(
      this._frame,
      createFrameEnterSelector(this._frameSelector, selectorOrLocator._selector),
      options
    );
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(testIdAttributeName(), testId));
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTitleSelector(text, options));
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.locator(getByRoleSelector(role, options));
  }

  owner() {
    return new Locator(this._frame, this._frameSelector);
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(this._frame, createFrameEnterSelector(this._frameSelector, selector));
  }

  first(): FrameLocator {
    return new FrameLocator(this._frame, createFrameNthSelector(this._frameSelector, 0));
  }

  last(): FrameLocator {
    return new FrameLocator(this._frame, createFrameNthSelector(this._frameSelector, -1));
  }

  nth(index: number): FrameLocator {
    return new FrameLocator(this._frame, createFrameNthSelector(this._frameSelector, index));
  }

  content() {}
}
