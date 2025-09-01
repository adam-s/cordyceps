/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { FrameManager } from './frameManager';
import { Frame, FrameLocator } from './frame';
import { Progress, executeWithProgress, ProgressController } from './core/progress';
import { Session } from './session';
import { FrameExecutionContext } from './core/frameExecutionContext';
import { NavigationDelegate } from './navigation/navigationDelegate';
import type {
  NavigateOptionsWithProgress,
  Rect,
  ClickOptions,
  SelectOption,
  SelectOptionOptions,
  ExpectScreenshotOptions,
  ScreenshotOptions,
  PageFrameEvent,
  NavigationResponse,
  WaitForEventOptions,
  LifecycleEvent,
  TimeoutOptions,
} from './utilities/types';
import { ByRoleOptions } from '@injected/isomorphic/locatorUtils';
import { LocatorOptions, Locator } from './locator';
import { ElementHandle } from './elementHandle';
import {
  getContentFrameId,
  createPageSnapshotForAI,
  isJavaScriptErrorInEvaluate,
  validateScreenshotFormat,
  StateAwareEvent,
} from './utilities/pageUtils';
import { convertBrowserBufferToNodeBuffer } from './utilities/bufferUtils';
import type { FilePayload } from '@shared/utils/fileInputTypes';
import { Screenshotter, validateScreenshotOptions } from './media/screenshotter';
import { waitForCondition } from './utilities/utils';
import { LongStandingScope } from '@injected/isomorphic/manualPromise';
import { DownloadManager, DownloadEventData } from './operations/downloadManager';
import { Download } from './operations/download';
import { ContentScriptReadinessManager } from './navigation/contentScriptReadiness';

export class Page extends Disposable {
  // Event emitters for page lifecycle events
  private readonly _onFrameAttached = this._register(new Emitter<PageFrameEvent>());
  private readonly _onFrameDetached = this._register(new Emitter<PageFrameEvent>());
  private readonly _onInternalFrameNavigatedToNewDocument = this._register(
    new Emitter<PageFrameEvent>()
  );
  // State-aware lifecycle events that handle "already fired" scenarios
  private readonly _onDomContentLoaded = this._register(new StateAwareEvent<PageFrameEvent>());
  private readonly _onLoad = this._register(new StateAwareEvent<PageFrameEvent>());
  private readonly _onDownload = this._register(new Emitter<Download>());
  // Close event for page disposal/tab closure
  private readonly _onClose = this._register(new Emitter<Page>());

  public readonly onFrameAttached: Event<PageFrameEvent> = this._onFrameAttached.event;
  public readonly onFrameDetached: Event<PageFrameEvent> = this._onFrameDetached.event;
  public readonly onInternalFrameNavigatedToNewDocument: Event<PageFrameEvent> =
    this._onInternalFrameNavigatedToNewDocument.event;
  public readonly onDomContentLoaded: Event<PageFrameEvent> = this._onDomContentLoaded.event;
  public readonly onLoad: Event<PageFrameEvent> = this._onLoad.event;
  public readonly onDownload: Event<Download> = this._onDownload.event;
  public readonly onClose: Event<Page> = this._onClose.event;

  private _ownedContext?: object;
  readonly frameManager: FrameManager;
  readonly tabId: number;
  readonly session: Session;
  lastSnapshotFrameIds: number[] = [];
  readonly screenshotter: Screenshotter;
  private readonly _navigationDelegate: NavigationDelegate;
  readonly openScope = new LongStandingScope();
  private _closedState: 'open' | 'closing' | 'closed' = 'open';
  // MV3-safe extra headers applied via declarativeNetRequest per tab
  private _extraHTTPHeaders: Readonly<Record<string, string>> | undefined;

  constructor(tabId: number, session: Session) {
    super();
    this.tabId = tabId;
    this.session = session;

    // Debug logging to track page lifecycle

    this.frameManager = this._register(new FrameManager(this));
    this.screenshotter = new Screenshotter(this);
    this._navigationDelegate = new NavigationDelegate(tabId);

    // Register with download manager for download tracking
    const downloadManager = DownloadManager.getInstance();
    downloadManager.registerPage(this);

    // Listen for downloads and relay them as page events
    this._register(
      downloadManager.onDownloadStarted((event: DownloadEventData) => {
        // For now, emit download events to all pages since Chrome doesn't provide tab association
        // In a real scenario, we'd need better tab-to-download mapping
        this._onDownload.fire(event.download);
      })
    );

    // Setup content script listener immediately - this is needed for execution context creation
    this._setupContentScriptListener();

    // Initialize content script readiness manager
    const readinessManager = ContentScriptReadinessManager.getInstance();
    this._register({
      dispose: () => {
        // Clean up readiness barriers for this tab when page is disposed
        readinessManager.removeTabBarriers(this.tabId);
      },
    });
  }

  /**
   * Fire frame attached event
   */
  _fireFrameAttached(frame: Frame): void {
    this._onFrameAttached.fire({ frame });
  }

  /**
   * Fire frame detached event
   */
  _fireFrameDetached(frame: Frame): void {
    this._onFrameDetached.fire({ frame });
  }

  /**
   * Fire internal frame navigated to new document event
   */
  _fireInternalFrameNavigatedToNewDocument(frame: Frame): void {
    this._onInternalFrameNavigatedToNewDocument.fire({ frame });
  }

  // Page-level lifecycle relays for consumers that don't want to subscribe per frame
  _fireDomContentLoaded(frame: Frame): void {
    // Only fire page-level events for main frame to avoid duplicates from child frames
    if (frame === this.mainFrame()) {
      this._onDomContentLoaded.fire({ frame });
    }
  }

  _fireLoad(frame: Frame): void {
    // Only fire page-level events for main frame to avoid duplicates from child frames
    if (frame === this.mainFrame()) {
      this._onLoad.fire({ frame });
    }
  }

  frameNavigatedToNewDocument(frame: Frame) {
    this._fireInternalFrameNavigatedToNewDocument(frame);

    // Reset lifecycle events for main frame navigation to handle new document lifecycle
    if (frame === this.mainFrame()) {
      this._onDomContentLoaded.reset();
      this._onLoad.reset();
    }

    const origin = frame.origin();
    if (origin) {
      // Track visited origin for browser-use context compatibility
      this._addVisitedOrigin(origin);
    }
  }

  /**
   * Track visited origins for browser-use compatibility
   * In Chrome extension context, this is mainly for analytics/debugging
   */
  private _visitedOrigins = new Set<string>();

  private _addVisitedOrigin(origin: string): void {
    this._visitedOrigins.add(origin);
  }

  /**
   * Get all visited origins for this page
   * Useful for browser-use context integration and debugging
   */
  getVisitedOrigins(): string[] {
    return Array.from(this._visitedOrigins);
  }

  /**
   * Browser context compatibility object for browser-use integration
   * Provides a minimal interface that browser-use expects
   */
  get browserContext() {
    return {
      addVisitedOrigin: (origin: string) => this._addVisitedOrigin(origin),
      getVisitedOrigins: () => this.getVisitedOrigins(),
    };
  }

  isClosed(): boolean {
    return this._closedState === 'closed';
  }

  /**
   * Activate this page's tab and focus its window.
   * Chrome extension equivalent of Playwright's bringToFront.
   */
  public async bringToFront(): Promise<void> {
    // Ensure the window is focused first (if available), then activate the tab
    const tab = await chrome.tabs.get(this.tabId);
    if (typeof tab.windowId === 'number') {
      try {
        await chrome.windows.update(tab.windowId, { focused: true });
      } catch (e) {
        console.debug('bringToFront: failed to focus window', e);
      }
    }
    try {
      await chrome.tabs.update(this.tabId, { active: true });
    } catch (e) {
      console.debug('bringToFront: failed to activate tab', e);
    }
  }

  /**
   * Explicitly close this page and clean up all resources.
   * This provides a clear API for ownership and helps in testing.
   * Also removes the actual Chrome tab.
   */
  async close(): Promise<void> {
    // Update closed state before disposing to prevent race conditions
    if (this._closedState === 'closed') {
      return;
    }

    this._closedState = 'closing';

    // Fire close event before disposing (similar to Playwright's _onClose)
    this._onClose.fire(this);

    // Close the actual Chrome tab - this is the responsibility of Page.close()
    // Wait for the tab removal to complete
    try {
      await chrome.tabs.remove(this.tabId);
    } catch (error) {
      console.warn(`⚠️ Failed to remove Chrome tab ${this.tabId}:`, error);
    }

    // Now dispose of resources
    this.dispose();

    // Mark as fully closed
    this._closedState = 'closed';
  }

  dispose(): void {
    super.dispose();
  }

  private _setupContentScriptListener(): void {
    // Create a tab-specific event for content script loads
    const onContentScriptLoadedForTab = Session.forTabContentScript(
      this.session.onContentScriptLoaded,
      this.tabId
    );

    this._register(
      onContentScriptLoadedForTab(sender => {
        const { frameId } = sender;
        if (frameId === undefined) {
          return;
        }
        const frame = this.frameManager.frame(frameId);
        if (!frame) {
          return;
        }
        this._createExecutionContext(frame);
      })
    );
  }

  private _createExecutionContext(frame: Frame): void {
    const context = new FrameExecutionContext(frame);
    frame._setContext(context);
  }

  /**
   * Public method to create execution context for frames
   * Called by FrameManager when frames are attached
   */
  public createExecutionContext(frame: Frame): void {
    this._createExecutionContext(frame);
  }

  /**
   * Wait for a timeout that is cancelable by a Progress instance.
   * @param progress Progress controller that supports .wait(timeout)
   * @param timeout Timeout in milliseconds to wait
   */
  async waitForTimeout(timeout: number): Promise<void> {
    return executeWithProgress(async progress =>
      this.mainFrame().waitForTimeout(timeout, progress)
    );
  }

  async waitForMainFrame(progress?: Progress): Promise<Frame> {
    if (progress) {
      progress.log('Waiting for main frame to be attached');
      // Use progress.race to handle abort conditions and timeouts
      return progress.race(this.frameManager.waitForMainFrame());
    }
    return this.frameManager.waitForMainFrame();
  }

  mainFrame(): Frame {
    return this.frameManager.mainFrame();
  }

  frames(): Frame[] {
    return this.frameManager.frames();
  }

  /**
   * Get the current URL of the page.
   * Returns the URL of the main frame.
   */
  url(): string {
    try {
      return this.mainFrame().url() || 'about:blank';
    } catch (error) {
      console.warn('Failed to get page URL:', error);
      return 'about:blank';
    }
  }

  title(): Promise<string> {
    return this.mainFrame().title();
  }

  public async goto(
    url: string,
    options?: NavigateOptionsWithProgress
  ): Promise<NavigationResponse | null> {
    return executeWithProgress(async p => {
      p.log(`Page navigating to "${url}"`);
      const result = await this.mainFrame().goto(url, { ...options, progress: p });
      return result;
    }, options);
  }

  async reload(options?: NavigateOptionsWithProgress): Promise<NavigationResponse | null> {
    return executeWithProgress(async p => {
      return this.mainFrame().raceNavigationAction(p, async () => {
        // Note: waitForNavigation may fail before we get response to reload(),
        // so we should await it immediately.
        const [response] = await Promise.all([
          // Reload must be a new document, and should not be confused with a stray pushState.
          this.mainFrame()._waitForNavigation(p, true /* requiresNewDocument */, options || {}),
          // chrome.tabs.reload is synchronous, just wrap in Promise.resolve for consistency
          Promise.resolve(chrome.tabs.reload(this.tabId)),
        ]);
        return response;
      });
    }, options);
  }

  async goBack(options?: NavigateOptionsWithProgress): Promise<NavigationResponse | null> {
    return executeWithProgress(async p => {
      return this.mainFrame().raceNavigationAction(p, async () => {
        // Note: waitForNavigation may fail before we get response to goBack,
        // so we should catch it immediately.
        let error: Error | undefined;
        const waitPromise = this.mainFrame()
          ._waitForNavigation(p, false /* requiresNewDocument */, options || {})
          .catch(e => {
            error = e;
            return null;
          });

        try {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: this.tabId, allFrames: false },
              world: 'MAIN',
              func: () => {
                // Use window.history.back() to navigate back in JavaScript history
                window.history.back();
              },
            });
          } catch (scriptError) {
            // Fallback to chrome.tabs.goBack if content script injection fails
            console.warn(
              '[Page.goBack] Content script navigation failed for tab',
              this.tabId,
              'falling back to chrome.tabs.goBack:',
              scriptError
            );
            chrome.tabs.goBack(this.tabId);
          }
          const response = await waitPromise;
          if (error) throw error;
          return response;
        } catch (e) {
          waitPromise.catch(() => {}); // Avoid an unhandled rejection.
          throw e;
        }
      });
    }, options);
  }

  async goForward(options?: NavigateOptionsWithProgress): Promise<NavigationResponse | null> {
    return executeWithProgress(async p => {
      return this.mainFrame().raceNavigationAction(p, async () => {
        // Note: waitForNavigation may fail before we get response to goForward,
        // so we should catch it immediately.
        let error: Error | undefined;
        const waitPromise = this.mainFrame()
          ._waitForNavigation(p, false /* requiresNewDocument */, options || {})
          .catch(e => {
            error = e;
            return null;
          });

        try {
          // Use content script injection to navigate forward in JavaScript history
          // This matches the navigation method used in Frame.goto() with window.location.assign()
          try {
            await chrome.scripting.executeScript({
              target: { tabId: this.tabId, allFrames: false },
              world: 'MAIN',
              func: () => {
                // Use window.history.forward() to navigate forward in JavaScript history
                window.history.forward();
              },
            });
          } catch (scriptError) {
            // Fallback to chrome.tabs.goForward if content script injection fails
            console.warn(
              `[Page.goForward] Content script navigation failed for tab ${this.tabId};`,
              'Falling back to chrome.tabs.goForward',
              scriptError
            );
            chrome.tabs.goForward(this.tabId);
          }
          const response = await waitPromise;
          if (error) throw error;
          return response;
        } catch (e) {
          waitPromise.catch(() => {}); // Avoid an unhandled rejection.
          throw e;
        }
      });
    }, options);
  }

  /**
   * Wait for a specific lifecycle state to be reached on the main frame
   * Chrome extension-compatible version of Playwright's waitForLoadState
   */
  async waitForLoadState(state?: LifecycleEvent, options?: TimeoutOptions): Promise<void> {
    const url = this.url();

    // For networkidle, delegate to content script readiness (new approach)
    if (state === 'networkidle') {
      const timeout = options?.timeout ?? 30000;
      const progress = new ProgressController(timeout);
      await progress.run(async p => {
        await this.waitForContentScriptReady(p);
      });
      return;
    }

    // For Chrome internal pages (new tab pages), use simplified load detection
    if (url?.startsWith('chrome://') || url?.startsWith('chrome-untrusted://')) {
      const timeout = options?.timeout ?? 5000; // Shorter timeout for Chrome pages
      try {
        await Promise.race([
          this.mainFrame().waitForLoadState(state || 'domcontentloaded', { timeout }),
          new Promise<void>(resolve => setTimeout(resolve, Math.min(timeout, 3000))), // Max 3s
        ]);
        return;
      } catch (error) {
        return;
      }
    }

    // Normal behavior for regular pages
    return await this.mainFrame().waitForLoadState(state, options);
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return this.mainFrame().locator(selector, options);
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.mainFrame().getByTestId(testId);
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByAltText(text, options);
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByLabel(text, options);
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByPlaceholder(text, options);
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByText(text, options);
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByTitle(text, options);
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.mainFrame().getByRole(role, options);
  }

  frameLocator(selector: string): FrameLocator {
    return this.mainFrame().frameLocator(selector);
  }

  // Additional locator methods that delegate to main frame
  first(selector: string): Locator {
    return this.mainFrame().locator(selector).first();
  }

  last(selector: string): Locator {
    return this.mainFrame().locator(selector).last();
  }

  nth(selector: string, index: number): Locator {
    return this.mainFrame().locator(selector).nth(index);
  }

  async elementHandle(selector: string, options?: { timeout?: number }): Promise<ElementHandle> {
    return this.mainFrame().locator(selector).elementHandle(options);
  }

  async elementHandles(selector: string): Promise<ElementHandle[]> {
    return this.mainFrame().locator(selector).elementHandles();
  }

  async highlight(selector: string, options?: { timeout?: number }): Promise<void> {
    await this.mainFrame().locator(selector).highlight(options);
  }

  async hideHighlight(selector: string): Promise<void> {
    await this.mainFrame().locator(selector).hideHighlight();
  }

  async boundingBox(selector: string, options?: { timeout?: number }): Promise<Rect | null> {
    return this.mainFrame().locator(selector).boundingBox(options);
  }

  async count(selector: string): Promise<number> {
    return this.mainFrame().locator(selector).count();
  }

  async all(selector: string): Promise<Locator[]> {
    return this.mainFrame().locator(selector).all();
  }

  async allInnerTexts(selector: string): Promise<string[]> {
    return this.mainFrame().locator(selector).allInnerTexts();
  }

  async allTextContents(selector: string): Promise<string[]> {
    return this.mainFrame().locator(selector).allTextContents();
  }

  async queryCount(selector: string): Promise<number> {
    return this.mainFrame().queryCount(selector);
  }

  async queryAll(selector: string, scope?: ElementHandle): Promise<ElementHandle[]> {
    return this.mainFrame().queryAll(selector, scope);
  }

  async contentFrameIdForFrame(handle: ElementHandle): Promise<number | null> {
    return await getContentFrameId(handle, this.frameManager);
  }

  async getContentFrame(handle: ElementHandle): Promise<Frame | null> {
    const frameId = await this.contentFrameIdForFrame(handle);
    if (frameId === null) {
      return null;
    }
    return this.frameManager.frame(frameId);
  }

  async snapshotForAI(options?: { progress?: Progress }): Promise<string> {
    return executeWithProgress(async p => {
      this.lastSnapshotFrameIds = [];
      return await createPageSnapshotForAI(p, this.mainFrame(), this.lastSnapshotFrameIds);
    }, options);
  }

  async click(selector: string, options?: ClickOptions): Promise<void> {
    await this.frameManager.mainFrame().click(selector, options);
  }

  async dblclick(selector: string, options?: ClickOptions): Promise<void> {
    await this.frameManager.mainFrame().dblclick(selector, options);
  }

  async tap(selector: string, options?: ClickOptions): Promise<void> {
    await this.frameManager.mainFrame().tap(selector, options);
  }

  async check(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number }
  ): Promise<void> {
    await this.frameManager.mainFrame().check(selector, options);
  }

  async uncheck(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number }
  ): Promise<void> {
    await this.frameManager.mainFrame().uncheck(selector, options);
  }

  async setChecked(
    selector: string,
    checked: boolean,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number }
  ): Promise<void> {
    await this.frameManager.mainFrame().setChecked(selector, checked, options);
  }

  async fill(
    selector: string,
    value: string,
    options?: { timeout?: number; force?: boolean }
  ): Promise<void> {
    await this.frameManager.mainFrame().fill(selector, value, options);
  }

  async selectOption(
    selector: string,
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions
  ): Promise<string[]> {
    return this.frameManager.mainFrame().selectOption(selector, values, options);
  }

  async clear(selector: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    await this.frameManager.mainFrame().clear(selector, options);
  }

  async dispatchEvent(
    selector: string,
    type: string,
    eventInit: Record<string, unknown> = {},
    options?: { timeout?: number }
  ): Promise<void> {
    await this.frameManager.mainFrame().dispatchEvent(selector, type, eventInit, options);
  }

  async getAttribute(
    selector: string,
    name: string,
    options?: { timeout?: number }
  ): Promise<string | null> {
    return await this.mainFrame().getAttribute(selector, name, options);
  }

  async hover(selector: string, options?: { timeout?: number }): Promise<void> {
    return await this.mainFrame().hover(selector, options);
  }

  async innerHTML(selector: string, options?: { timeout?: number }): Promise<string> {
    return await this.mainFrame().innerHTML(selector, options);
  }

  async innerText(selector: string, options?: { timeout?: number }): Promise<string> {
    return await this.mainFrame().innerText(selector, options);
  }

  async textContent(selector: string, options?: { timeout?: number }): Promise<string> {
    const result = await this.mainFrame().textContent(selector, options);
    return result;
  }

  async inputValue(selector: string, options?: { timeout?: number }): Promise<string> {
    return await this.mainFrame().inputValue(selector, options);
  }

  async isChecked(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isChecked(selector, options);
  }

  async isDisabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isDisabled(selector, options);
  }

  async isEditable(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isEditable(selector, options);
  }

  async isEnabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isEnabled(selector, options);
  }

  async isHidden(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isHidden(selector, options);
  }

  async isVisible(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isVisible(selector, options);
  }

  async press(
    selector: string,
    key: string,
    options?: { delay?: number; timeout?: number }
  ): Promise<void> {
    return await this.mainFrame().press(selector, key, options);
  }

  async type(
    selector: string,
    text: string,
    options?: { delay?: number; timeout?: number }
  ): Promise<void> {
    return await this.mainFrame().type(selector, text, options);
  }

  /**
   * Wait for page evaluation context to be ready using a backoff strategy.
   * This method tests if page.evaluate() is working properly before attempting real evaluations.
   * Delegates to the main frame's waitForEvaluationReady method.
   *
   * @param backoffDelays Array of delay times in milliseconds for each retry attempt (default: [0, 10, 20, 30, 50, 80, 100])
   * @param timeout Total timeout in milliseconds for the entire operation (default: 5000)
   * @returns Promise that resolves when page.evaluate() is working, rejects if timeout is reached
   */
  async waitForEvaluationReady(
    backoffDelays: number[] = [0, 10, 20, 30, 50, 80, 100],
    timeout: number = 5000
  ): Promise<void> {
    return await this.mainFrame().waitForEvaluationReady(backoffDelays, timeout);
  }

  async evaluate<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number }
  ): Promise<R> {
    return await this.mainFrame().evaluate(pageFunction, arg, options);
  }

  async evaluateHandle<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number }
  ): Promise<ElementHandle | null> {
    return await this.mainFrame().evaluateHandle(pageFunction, arg, options);
  }

  /**
   * Get bounding box for an element handle.
   * Similar to Playwright's Page._getBoundingBox method.
   */
  async _getBoundingBox(handle: ElementHandle): Promise<Rect | null> {
    return await handle.boundingBox();
  }

  /**
   * Set files on an input element.
   * Similar to Playwright's Page.setInputFiles method.
   *
   * @example
   * ```typescript
   * await page.setInputFiles('#file-input', [file1, file2]);
   *
   * await page.setInputFiles('#file-input', [
   *   { name: 'data.json', mimeType: 'application/json', buffer: jsonBuffer }
   * ]);
   * ```
   */
  async setInputFiles(
    selector: string,
    files: FilePayload[] | File[],
    options?: { force?: boolean; directoryUpload?: boolean; timeout?: number }
  ): Promise<void> {
    return await this.mainFrame().setInputFiles(selector, files, options);
  }

  async screenshot(progress: Progress, options: ScreenshotOptions): Promise<Buffer> {
    const bufferLike = await this.screenshotter.screenshotPage(progress, options);

    // Convert BrowserBuffer to Node.js Buffer for compatibility
    const result = convertBrowserBufferToNodeBuffer(bufferLike);

    return result;
  }

  /**
   * Safely evaluate a function in all frames without throwing on JavaScript errors.
   * This is the Chrome extension equivalent of Playwright's safeNonStallingEvaluateInAllFrames.
   *
   * @param func Function to execute in each frame
   * @param world Execution world to run the function in
   * @param options Configuration options
   * @returns Promise that resolves when all frame evaluations complete
   */
  async safeNonStallingEvaluateInAllFrames<Args extends unknown[]>(
    func: (...args: Args) => unknown,
    world: chrome.scripting.ExecutionWorld,
    options: { throwOnJSErrors?: boolean; skipSlowFrames?: boolean; maxFrameTimeout?: number } = {},
    ...args: Args
  ): Promise<void> {
    const maxFrameTimeout = options.maxFrameTimeout ?? 3000; // 3 second default per frame
    const skipSlowFrames = options.skipSlowFrames ?? true; // Skip slow frames by default
    const frames = this.frameManager.frames();
    // Add timeout to the entire operation to prevent infinite hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('safeNonStallingEvaluateInAllFrames timed out after 30 seconds'));
      }, 30000);
    });

    const evaluationPromise = Promise.all(
      frames.map(async (frame, index) => {
        try {
          // Create frame-specific timeout if skipSlowFrames is enabled
          const frameProcessing = async () => {
            // Test frame connectivity with a simple evaluation first
            try {
              await chrome.scripting.executeScript({
                target: { tabId: frame.tabId, frameIds: [frame.frameId] },
                func: () => true,
                world: 'MAIN',
              });
            } catch (connectError) {
              return; // Skip this frame if we can't connect
            }

            // Use frame's execution context to safely evaluate the function
            const context = await frame.getContext();

            await context.executeScript(func, world, ...args);
          };

          // Apply timeout if skipSlowFrames is enabled
          if (skipSlowFrames) {
            const frameTimeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(
                  new Error(
                    `Frame ${index} (${frame.frameId}) timed out after ${maxFrameTimeout}ms`
                  )
                );
              }, maxFrameTimeout);
            });

            await Promise.race([frameProcessing(), frameTimeoutPromise]);
          } else {
            await frameProcessing();
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);

          if (skipSlowFrames && errorMessage.includes('timed out')) {
            // Don't throw for timeout errors when skipSlowFrames is true
            return;
          }

          // Only throw if it's a JavaScript error and throwOnJSErrors is true
          if (options.throwOnJSErrors && isJavaScriptErrorInEvaluate(e)) {
            throw e;
          }
          // Silently ignore other errors (connection issues, frame detached, etc.)
          console.debug(`Frame evaluation failed silently:`, e);
        }
      })
    );

    await Promise.race([evaluationPromise, timeoutPromise]);
  }

  async expectScreenshot(
    progress: Progress,
    options: ExpectScreenshotOptions
  ): Promise<{
    actual?: Buffer;
    previous?: Buffer;
    diff?: Buffer;
    errorMessage?: string;
    log?: string[];
    timedOut?: boolean;
  }> {
    const locator = options.locator;

    // Create screenshot function based on whether we have a locator or not
    const rafrafScreenshot = locator
      ? async (timeout: number) => {
          const bufferLike = await locator.frame.rafrafTimeoutScreenshotElementWithProgress(
            progress,
            locator.selector,
            timeout,
            options || {}
          );
          // Convert BrowserBuffer to Node.js Buffer for compatibility if needed
          return convertBrowserBufferToNodeBuffer(bufferLike);
        }
      : async (timeout: number) => {
          await executeWithProgress(
            async p => {
              await this.mainFrame().rafrafTimeout(p, timeout);
            },
            { timeout: 30000 }
          );
          const bufferLike = await this.screenshotter.screenshotPage(progress, options || {});
          // Convert BrowserBuffer to Node.js Buffer for compatibility
          return convertBrowserBufferToNodeBuffer(bufferLike);
        };

    // Validate screenshot options
    try {
      const format = validateScreenshotOptions(options || {});
      validateScreenshotFormat(format);
    } catch (error) {
      return { errorMessage: (error as Error).message };
    }

    // Simple comparison for now - just take one screenshot
    // This is a simplified version without the full Playwright comparison logic
    try {
      const actual = await rafrafScreenshot(100); // Small delay before screenshot
      if (!options.expected) {
        return { actual };
      }

      // For now, return the actual screenshot
      // TODO: Implement proper image comparison using compare utilities
      return { actual };
    } catch (error) {
      return {
        errorMessage: (error as Error).message,
        timedOut: false,
      };
    }
  }

  /**
   * Wait for a specific event on this page.
   * Chrome extension compatible implementation of Playwright's waitForEvent.
   *
   * @param event The event name to wait for
   * @param optionsOrPredicate Either options object or predicate function
   * @returns Promise that resolves with the event data
   */
  async waitForEvent(
    event: string,
    optionsOrPredicate: WaitForEventOptions | ((eventArg: unknown) => boolean) = {}
  ): Promise<unknown> {
    const timeout = 30000; // Default timeout
    const options =
      typeof optionsOrPredicate === 'function'
        ? { predicate: optionsOrPredicate, timeout }
        : { timeout, ...optionsOrPredicate };

    return new Promise((resolve, reject) => {
      let disposable: { dispose(): void } | null = null;
      let timeoutHandle: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (disposable) disposable.dispose();
      };

      // Set up timeout
      timeoutHandle = setTimeout(() => {
        cleanup();
        reject(
          new Error(`Timeout ${options.timeout}ms exceeded while waiting for event "${event}"`)
        );
      }, options.timeout);

      // Map event names to VS Code events
      let vsCodeEvent: Event<unknown> | null = null;

      switch (event) {
        case 'frameattached':
          vsCodeEvent = this.onFrameAttached;
          break;
        case 'framedetached':
          vsCodeEvent = this.onFrameDetached;
          break;
        case 'framenavigated':
          vsCodeEvent = this.onInternalFrameNavigatedToNewDocument;
          break;
        case 'domcontentloaded':
          vsCodeEvent = this.onDomContentLoaded;
          break;
        case 'load':
          vsCodeEvent = this.onLoad;
          break;
        case 'download':
          vsCodeEvent = this.onDownload;
          break;
        case 'close':
          vsCodeEvent = this.onClose;
          break;
        case 'crash':
          // Page crash handling would need to be implemented
          reject(new Error(`Event "${event}" is not yet supported`));
          return;
        default:
          reject(new Error(`Unknown event "${event}"`));
          return;
      }

      if (!vsCodeEvent) {
        reject(new Error(`Failed to map event "${event}" to VS Code event`));
        return;
      }

      // Listen for the event
      disposable = vsCodeEvent((eventArg: unknown) => {
        try {
          if (options.predicate && !options.predicate(eventArg)) {
            return; // Continue waiting
          }
          cleanup();
          resolve(eventArg);
        } catch (e) {
          cleanup();
          reject(e);
        }
      });
    });
  }

  /**
   * Internal waitForEvent with progress support.
   * Provides the ability to handle cancellation and timeout via Progress.
   *
   * @param event The event name to wait for
   * @param optionsOrPredicate Either options object or predicate function
   * @param progress Progress controller for abort handling
   * @returns Promise that resolves with the event data
   */
  async _waitForEvent(
    event: string,
    optionsOrPredicate: WaitForEventOptions | ((eventArg: unknown) => boolean),
    progress: Progress
  ): Promise<unknown> {
    const options =
      typeof optionsOrPredicate === 'function'
        ? { predicate: optionsOrPredicate, timeout: 30000 }
        : { timeout: 30000, ...optionsOrPredicate };

    // Map event names to VS Code events
    let vsCodeEvent: Event<unknown> | null = null;

    switch (event) {
      case 'frameattached':
        vsCodeEvent = this.onFrameAttached;
        break;
      case 'framedetached':
        vsCodeEvent = this.onFrameDetached;
        break;
      case 'framenavigated':
        vsCodeEvent = this.onInternalFrameNavigatedToNewDocument;
        break;
      case 'domcontentloaded':
        vsCodeEvent = this.onDomContentLoaded;
        break;
      case 'load':
        vsCodeEvent = this.onLoad;
        break;
      case 'download':
        vsCodeEvent = this.onDownload;
        break;
      case 'close':
        vsCodeEvent = this.onClose;
        break;
      default:
        throw new Error(`Unknown or unsupported event "${event}"`);
    }

    if (!vsCodeEvent) {
      throw new Error(`Failed to map event "${event}" to VS Code event`);
    }

    // Use Frame's static waitForEvent method which handles progress properly
    return Frame.waitForEvent(progress, vsCodeEvent, options.predicate, options.timeout);
  }

  /**
   * Wait for a condition with race condition handling and progress support.
   * This method delegates to the autoWait utility for general-purpose waiting.
   *
   * @param progress Progress controller for abort handling
   * @param condition Function that returns true when condition is met
   * @param options Waiting options
   * @returns Promise that resolves when condition is met
   */
  async waitForCondition(
    progress: Progress,
    condition: () => boolean | Promise<boolean>,
    options: {
      pollInterval?: number;
      timeout?: number;
      description?: string;
    } = {}
  ): Promise<void> {
    return waitForCondition(progress, condition, options);
  }

  /**
   * Helper method to wait for download event and then click with consistent timing
   * Follows the same pattern as other Page methods with delay options
   */
  async waitForDownloadAndClick(
    selector: string,
    options?: { delay?: number; timeout?: number }
  ): Promise<Download> {
    const delay = options?.delay ?? 100; // Default 100ms delay between downloads
    const timeout = options?.timeout ?? 30000;

    // Start waiting for download before clicking
    const downloadPromise = this.waitForEvent('download', { timeout });

    // Add delay before clicking to space out downloads
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Click to trigger download
    await this.click(selector);

    // Wait for the download event
    return (await downloadPromise) as Download;
  }

  /**
   * Network debug snapshot is no longer available since we removed network tracking.
   * This method is kept for backward compatibility but returns null.
   */
  getNetworkDebugSnapshot(): {
    requestListeners: number;
    responseListeners: number;
    requestEmits: number;
    responseEmits: number;
    emitterId: string;
  } | null {
    console.warn('getNetworkDebugSnapshot: Network tracking has been removed, returning null');
    return null;
  }

  content() {
    return this.mainFrame().content();
  }

  /**
   * Wait for main frame content script to be ready
   * Replaces complex network stability detection
   */
  async waitForContentScriptReady(progress?: Progress): Promise<void> {
    const mainFrame = this.mainFrame();
    return mainFrame.waitForContentScriptReady(progress);
  }

  /**
   * Wait for specific frame to be ready
   */
  async waitForFrameReady(frameId: number, progress?: Progress): Promise<void> {
    const barrier = ContentScriptReadinessManager.getInstance().getBarrier(this.tabId, frameId);
    return barrier.waitForReady(progress);
  }
}
