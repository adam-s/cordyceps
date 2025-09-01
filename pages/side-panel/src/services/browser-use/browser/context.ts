import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { Page } from '@src/services/cordyceps/page';
import { ElementHandle } from '@src/services/cordyceps/elementHandle';
import { FrameLocator, Frame } from '@src/services/cordyceps/frame';
import { ScreenshotOptions } from '@src/services/cordyceps/utilities/types';
import { BrowserState, TabInfo } from './views';
import type {
  NavigateOptionsWithProgress,
  NavigationResponse,
} from '@src/services/cordyceps/utilities/types';
import { executeWithProgress, Progress } from '@src/services/cordyceps/core/progress';
import { DOMService } from '../dom/service';
import { DOMElementNode, SelectorMap } from '../dom/views';
import { ElementForSelector, ElementNode } from '../dom/types';
import { generateUuid } from 'vs/base/common/uuid';
import { ContentScriptReadinessManager } from '../../cordyceps/navigation/contentScriptReadiness';

// Configuration class for browser-use context (instantiable with sane defaults)
export class BrowserContextConfig {
  public maximumWaitPageLoadTime: number;
  public waitForNetworkIdlePageLoadTime: number;
  public allowedDomains?: string[];
  // Whether to draw highlight overlays for detected clickable elements
  public highlightElements: boolean;
  // Pixels to expand viewport bounds when collecting elements (-1 for no limit)
  public viewportExpansion: number;
  public saveDownloadsPath: string | null;
  /** Milliseconds to wait between automated actions (e.g. clicks, inputs) */
  public waitBetweenActions: number;
  /** Whether to use AI snapshot instead of traditional DOM parsing and screenshots */
  public useSnapshotForAI: boolean;

  constructor(init?: Partial<BrowserContextConfig>) {
    this.maximumWaitPageLoadTime = init?.maximumWaitPageLoadTime ?? 5; // seconds
    this.waitForNetworkIdlePageLoadTime = init?.waitForNetworkIdlePageLoadTime ?? 0.5; // seconds
    this.allowedDomains = init?.allowedDomains;
    this.highlightElements = init?.highlightElements ?? true;
    this.viewportExpansion = init?.viewportExpansion ?? 500;
    this.saveDownloadsPath = init?.saveDownloadsPath ?? null;
    this.waitBetweenActions = init?.waitBetweenActions ?? 1; // milliseconds
    this.useSnapshotForAI = init?.useSnapshotForAI ?? false;
  }
}

/**
 * Represents a browser session
 */
export class BrowserSession {
  id: string;
  startTime: Date;
  endTime: Date | null;
  state: BrowserContextState;
  // Add context property to match Python implementation
  context: BrowserWindow | null;
  // Add cachedState property to match Python implementation
  cachedState: BrowserState | null;

  constructor(id: string = crypto.randomUUID()) {
    this.id = id;
    this.startTime = new Date();
    this.endTime = null;
    this.state = BrowserContextState.CREATED;
    this.context = null;
    this.cachedState = null;
  }

  end(): void {
    // Only set endTime if not already closed (idempotent behavior)
    if (this.state !== BrowserContextState.CLOSED) {
      this.endTime = new Date();
      this.state = BrowserContextState.CLOSED;
    }
  }

  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime ? this.endTime.toISOString() : null,
      state: this.state,
      context: this.context,
      cachedState: this.cachedState,
    };
  }
}

/**
 * Enum for browser context state
 */
export enum BrowserContextState {
  CREATED = 'created',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

export class BrowserContext {
  browserWindow: BrowserWindow;
  pages: Page[];
  session: BrowserSession;
  config: BrowserContextConfig;
  // Following the Python implementation's state storage
  state: { targetId?: string; [key: string]: unknown } = {};

  static _enhancedCssSelectorForElement(
    element: ElementForSelector,
    includeDynamicAttributes: boolean = true
  ): string {
    // Removed noisy debug logs for selector generation

    try {
      // Get base selector from XPath
      const cssSelector = BrowserContext._convertSimpleXpathToCssSelector(element.xpath);

      let result = cssSelector || element.tag_name || 'div';

      // Handle class attributes
      if (
        element.attributes &&
        'class' in element.attributes &&
        element.attributes.class &&
        includeDynamicAttributes
      ) {
        // Define a regex pattern for valid class names in CSS
        const validClassNamePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

        // Iterate through the class attribute values
        const classes =
          typeof element.attributes.class === 'string' ? element.attributes.class.split(/\s+/) : [];

        for (const className of classes) {
          // Skip empty class names
          if (!className.trim()) {
            continue;
          }

          // Check if the class name is valid
          if (validClassNamePattern.test(className)) {
            // Append the valid class name to the CSS selector
            result += `.${className}`;
            // class added to selector
          } else {
            // Skip invalid class names
            // skipped invalid class
            continue;
          }
        }
      }

      // Expanded set of safe attributes that are stable and useful for selection
      const SAFE_ATTRIBUTES = new Set([
        // Data attributes
        'id',
        // Standard HTML attributes
        'name',
        'type',
        'placeholder',
        // Accessibility attributes
        'aria-label',
        'aria-labelledby',
        'aria-describedby',
        'role',
        // Common form attributes
        'for',
        'autocomplete',
        'required',
        'readonly',
        // Media attributes
        'alt',
        'title',
        'src',
        // Custom stable attributes
        'href',
        'target',
      ]);

      if (includeDynamicAttributes) {
        const dynamicAttributes = new Set(['data-id', 'data-qa', 'data-cy', 'data-testid']);

        // Add dynamic attributes to the safe attributes set
        // Convert Set to Array to avoid TypeScript iteration errors
        Array.from(dynamicAttributes).forEach(attr => {
          SAFE_ATTRIBUTES.add(attr);
        });
      }

      // Handle other attributes
      if (element.attributes) {
        for (const [attribute, value] of Object.entries(element.attributes)) {
          if (attribute === 'class') {
            continue;
          }

          // Skip invalid attribute names
          if (!attribute.trim()) {
            continue;
          }

          if (!SAFE_ATTRIBUTES.has(attribute)) {
            // Skipped unsafe attribute: attribute not added to selector
            continue;
          }

          // Escape special characters in attribute names
          const safeAttribute = attribute.replace(':', '\\:');

          // Handle different value cases
          if (value === '') {
            result += `[${safeAttribute}]`;
            // added empty attribute to selector
          } else if (typeof value === 'string' && /["'<>`\n\r\t]/.test(value)) {
            // Use contains for values with special characters
            // Regex-substitute *any* whitespace with a single space, then strip.
            const collapsedValue = value.replace(/\s+/g, ' ').trim();
            // Escape embedded double-quotes.
            const safeValue = collapsedValue.replace(/"/g, '\\"');
            result += `[${safeAttribute}*="${safeValue}"]`;
            // added attribute with special characters using *=
          } else if (value !== undefined && value !== null) {
            result += `[${safeAttribute}="${value}"]`;
            // added attribute to selector
          }
        }
      }

      // final CSS selector constructed
      return result;
    } catch (error) {
      console.error(
        `[BrowserContext._enhancedCssSelectorForElement] Error generating CSS selector:`,
        error
      );
      // Fallback to a more basic selector if something goes wrong
      const tagName = element.tag_name || '*';
      const fallbackSelector = `${tagName}[highlight_index='${element.highlight_index}']`;
      // using fallback selector
      return fallbackSelector;
    }
  }

  private static _convertSimpleXpathToCssSelector(xpath: string | undefined): string {
    // Starting XPath conversion

    if (!xpath) {
      // XPath is empty, return a default selector
      return 'div';
    }

    // Parse XPath more carefully to handle attributes with forward slashes
    // Split by / but preserve content inside brackets
    const parts: string[] = [];
    let currentPart = '';
    let insideBrackets = 0;
    let i = 0;

    while (i < xpath.length) {
      const char = xpath[i];

      if (char === '[') {
        insideBrackets++;
        currentPart += char;
      } else if (char === ']') {
        insideBrackets--;
        currentPart += char;
      } else if (char === '/' && insideBrackets === 0) {
        // Only split on / when we're not inside brackets
        if (currentPart) {
          parts.push(currentPart);
          currentPart = '';
        }
      } else {
        currentPart += char;
      }
      i++;
    }

    // Add the final part if there's any content
    if (currentPart) {
      parts.push(currentPart);
    }

    // Split into parts completed
    const cssParts: string[] = [];

    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex];
      // Processing part

      if (!part) {
        // Skipping empty part
        continue;
      }

      // Handle custom elements with colons by escaping them
      if (part.includes(':') && !part.includes('[')) {
        const basePart = part.replace(':', '\\:');
        cssParts.push(basePart);
        continue;
      }

      // Handle index notation [n]
      if (part.includes('[')) {
        const basePart = part.substring(0, part.indexOf('['));
        // Handle custom elements with colons in the base part
        const basePartEscaped = basePart.includes(':') ? basePart.replace(':', '\\:') : basePart;
        const indexPart = part.substring(part.indexOf('['));

        // Found indexed part

        // Handle multiple indices
        const indices = indexPart
          .split(']')
          .slice(0, -1)
          .map(i => i.replace('[', ''));

        // Extracted indices

        let finalPart = basePartEscaped;
        for (const idx of indices) {
          // Processing index
          try {
            // Handle numeric indices
            if (/^\d+$/.test(idx)) {
              const index = parseInt(idx) - 1;
              const nthSelector = `:nth-of-type(${index + 1})`;
              finalPart += nthSelector;
            }
            // Handle last() function
            else if (idx === 'last()') {
              finalPart += ':last-of-type';
            }
            // Handle position() functions
            else if (idx.includes('position()')) {
              if (idx.includes('>1')) {
                finalPart += ':nth-of-type(n+2)';
              }
            }
          } catch (error) {
            // Error processing index, skip
            continue;
          }
        }

        // Final part after index processing
        cssParts.push(finalPart);
      } else {
        // Adding simple part
        cssParts.push(part);
      }
    }

    const baseSelector = cssParts.join(' > ');
    // Final CSS selector constructed
    return baseSelector;
  }

  constructor(browserWindow: BrowserWindow, config?: Partial<BrowserContextConfig>) {
    this.browserWindow = browserWindow;
    this.pages = [];
    this.session = new BrowserSession();
    // Use the instantiable BrowserContextConfig so callers can import it as a value
    this.config = new BrowserContextConfig(config);
  }

  /**
   * Enter the browser context - Initialize connection to the current Chrome window
   * This method ensures the BrowserContext is properly connected to the Chrome extension environment
   * and handles session-level initialization that goes beyond basic BrowserWindow setup
   */
  async enter(): Promise<void> {
    try {
      // Entering browser-use context for Chrome extension

      // Verify we can access the current window
      const currentWindow = await chrome.windows.get(this.browserWindow.windowId);
      if (!currentWindow) {
        throw new Error(`Window ${this.browserWindow.windowId} no longer exists`);
      }

      // Ensure at least one page exists for browser automation
      const pages = this.browserWindow.pages();
      if (pages.length === 0) {
        await this.browserWindow.newPage();
      }

      // Get the current page and initialize our pages array
      const currentPage = await this.browserWindow.getCurrentPage();
      this.pages = [currentPage];

      // Update session state to active
      this.session.state = BrowserContextState.ACTIVE;
      this.session.context = this.browserWindow;

      // Browser-use context entered successfully
    } catch (error) {
      console.error('❌ Failed to enter browser-use context:', error);
      throw new Error(
        `Failed to enter browser-use context: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the current page from the browser window
   */
  async getCurrentPage(): Promise<Page> {
    // Ensure we're in an active state
    if (this.session.state !== BrowserContextState.ACTIVE) {
      await this.enter();
    }

    // Get the current active page from the browser window
    const currentPage = await this.browserWindow.getCurrentPage();

    // Always keep our pages array in sync with the BrowserWindow's pages
    // This ensures we don't get stale or contaminated page references
    this.pages = this.browserWindow.pages();

    return currentPage;
  }

  /**
   * Safe navigation that validates URL before navigating
   * This method should be used instead of direct page.goto() to ensure URL validation
   */
  async safeGoto(
    url: string,
    options?: NavigateOptionsWithProgress
  ): Promise<NavigationResponse | null> {
    // Check if URL is allowed before navigation
    const isAllowed = this._isUrlAllowed(url);
    if (!isAllowed) {
      await this._handleDisallowedNavigation(url);
      return null; // This line won't be reached due to exception, but for clarity
    }

    // If URL is allowed, proceed with navigation
    const page = await this.getCurrentPage();
    const result = await page.goto(url, options);
    return result;
  }

  /**
   * Stop loading the current page
   */
  async stopLoading(): Promise<void> {
    try {
      const page = await this.getCurrentPage();

      // Try using page.evaluate first
      if (typeof page.evaluate === 'function') {
        await page.evaluate(() => window.stop());
        console.info('Stopped page loading via page.evaluate');
      } else {
        // Fallback: use Chrome tabs API to stop loading
        console.info('Using fallback method to stop page loading');
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => window.stop(),
            });
            console.info('Stopped page loading via chrome.scripting');
          } catch (scriptError) {
            console.warn('Failed to execute stop script via chrome.scripting:', scriptError);
          }
        }
      }
    } catch (e: unknown) {
      console.error('Error stopping page loading:', e);
    }
  }

  /**
   * Takes a screenshot of the current page
   * Exact match to Python implementation's take_screenshot method
   * @param fullPage Whether to take a screenshot of the full page or just the viewport
   * @param throwOnError Whether to throw errors or return undefined on failure (default: false for graceful handling)
   * @returns Base64 encoded screenshot or undefined if error occurs and throwOnError is false
   */
  async takeScreenshot(
    fullPage: boolean = false,
    throwOnError: boolean = false
  ): Promise<string | undefined> {
    // Starting takeScreenshot

    try {
      return await executeWithProgress(async progress => {
        const page = await this.getCurrentPage();

        progress.log('Taking screenshot');

        const screenshotOptions: ScreenshotOptions = {
          fullPage,
          animations: 'disabled',
          type: 'png',
        };

        const screenshot = await page.screenshot(progress, screenshotOptions);

        const screenshotB64 = screenshot.toString('base64');

        // await this.removeHighlights();
        // Note: This line is commented out in the Python implementation

        return screenshotB64;
      });
    } catch (error) {
      console.error(`[BrowserContext.takeScreenshot] Error taking screenshot:`, error);

      if (throwOnError) {
        throw error;
      }

      return undefined;
    }
  }

  /**
   * Close the browser context - Clean up resources and prepare for shutdown
   * Note: In a Chrome extension side panel, we don't actually close browser tabs
   */
  async close(): Promise<void> {
    try {
      console.log('🚪 Closing browser-use context');

      // Clean up ContentScriptReadinessManager
      try {
        const instance = ContentScriptReadinessManager.getInstance();
        if (instance) {
          console.log('🧹 Disposing ContentScriptReadinessManager');
          instance.dispose();
        }
      } catch (error) {
        console.warn('⚠️ Error disposing ContentScriptReadinessManager:', error);
      }

      // Clear our pages reference (but don't actually close browser tabs)
      this.pages = [];

      // End the session
      this.session.end();

      console.log('✅ Browser-use context closed successfully');
    } catch (error) {
      console.error('❌ Error closing browser-use context:', error);
      // Don't throw here - we want cleanup to complete even if there are errors
    }
  }

  /**
   * Check if the browser context is active
   */
  isActive(): boolean {
    return this.session.state === BrowserContextState.ACTIVE;
  }

  /**
   * @TODO change after public methods use
   *
   * Check if a URL is allowed based on the allowed domains configuration
   * Matches the Python implementation's _is_url_allowed method
   */
  /**
   * Check if a URL is allowed based on the configured allowed domains.
   * Matches the Python implementation's _is_url_allowed method
   */
  _isUrlAllowed(url: string): boolean {
    if (!this.config.allowedDomains || this.config.allowedDomains.length === 0) {
      return true;
    }

    try {
      // Special case: allow Chrome internal URLs for new tabs
      if (
        url === 'chrome://newtab/' ||
        url === 'about:blank' ||
        url.startsWith('chrome://new-tab-page/')
      ) {
        return true;
      }

      // Parse the URL to extract the domain
      const urlObj = new URL(url);
      let domain = urlObj.hostname.toLowerCase();
      // Remove port number if present
      if (domain.includes(':')) {
        const parts = domain.split(':');
        domain = parts[0] || '';
      }

      // Check if domain matches any allowed domain pattern
      const isAllowed = this.config.allowedDomains.some(allowedDomain => {
        const lowerAllowed = allowedDomain.toLowerCase();
        const exactMatch = domain === lowerAllowed;
        const subdomainMatch = domain.endsWith('.' + lowerAllowed);
        return exactMatch || subdomainMatch;
      });

      return isAllowed;
    } catch (e: unknown) {
      // Normal behavior when testing malformed URLs
      return false;
    }
  }

  /**
   * @TODO change after public methods use
   *
   * Handle disallowed navigation - throw error or navigate to a safe URL
   */
  async _handleDisallowedNavigation(url: string): Promise<void> {
    console.error(`Disallowed URL: ${url}`);

    // Navigate to a blank page if the current URL is not allowed
    try {
      const page = await this.getCurrentPage();
      // Do not await here: about:blank often doesn't emit webNavigation events,
      // causing goto() to wait for lifecycle that never arrives. Fire-and-forget.
      try {
        chrome.tabs.update(page.tabId, { url: 'about:blank' });
        console.log('Issued navigation to about:blank for security');
      } catch (innerErr) {
        console.warn('chrome.tabs.update failed when navigating to about:blank:', innerErr);
      }
    } catch (error) {
      console.warn('Failed to navigate to about:blank, but continuing with error:', error);
      // Continue anyway - the important part is throwing the error
    }

    // Throw error to notify the calling code
    throw new Error(`URL not allowed: ${url}`);
  }

  /**
   * @TODO change after public methods use
   *
   * Ensures page is fully loaded before continuing.
   * Waits for either network to be idle or minimum WAIT_TIME, whichever is longer.
   * Also checks if the loaded URL is allowed.
   *
   * This matches the Python implementation's _wait_for_page_and_frames_load method
   * @param timeoutOverwrite Optional timeout override in seconds
   */
  async _waitForPageAndFramesLoad(options?: { timeoutOverwrite?: number }): Promise<void> {
    // Starting _waitForPageAndFramesLoad()

    // Start timing
    const startTime = Date.now();

    try {
      // Simple wait for basic page loading
      // Use a short wait period instead of complex network monitoring
      const idleTime = (this.config.waitForNetworkIdlePageLoadTime || 0.5) * 1000;
      await new Promise(resolve => setTimeout(resolve, idleTime));

      // Check if the loaded URL is allowed
      // About to get current page for URL check
      const page = await this.getCurrentPage();
      const url = page.url();

      if (!this._isUrlAllowed(url)) {
        await this._handleDisallowedNavigation(url);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('URL not allowed:')) {
        // Re-throwing URL not allowed error
        throw error; // Re-throw URL not allowed errors
      }
      console.warn(
        `[BrowserContext._waitForPageAndFramesLoad] Page load failed, continuing...`,
        error
      );
    }

    // Use timeout override if provided (match Python implementation's default value)
    // Use a default of 0.25 seconds if minimumWaitPageLoadTime is not available
    const minimumWait = options?.timeoutOverwrite ?? 0.25;

    // Calculate remaining time to meet minimum wait time
    const elapsed = (Date.now() - startTime) / 1000; // Convert to seconds
    const remaining = Math.max(minimumWait - elapsed, 0);

    // Minimum wait: ${minimumWait}s, elapsed: ${elapsed}s, remaining: ${remaining}s

    // Sleep remaining time if needed
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining * 1000));
    }
  }

  /**
   * Get tabs info
   */
  async _getTabsInfo(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = [];
    const pages = this.browserWindow.pages();

    for (let i = 0; i < pages.length; i++) {
      // Processing page

      let title = 'Unknown';
      try {
        // Try to get the title with a short timeout to avoid hanging on chrome:// pages
        // About to get title for page

        // Use a promise race to timeout quickly for problematic pages (like chrome://)
        const titlePromise = pages[i].title();
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('Title retrieval timeout')), 2000); // 2 second timeout
        });

        title = await Promise.race([titlePromise, timeoutPromise]);
      } catch (error) {
        // Failed to get title for page, using fallback
        // Fallback: use URL as title or default
        const url = pages[i].url();
        title = url ? new URL(url).hostname : 'Unknown';
      }

      tabs.push({
        pageId: i,
        url: pages[i].url(),
        title: title,
      });
      // Added tab
    }
    return tabs;
  }

  /**
   * Get the state of the browser
   * This is an exact implementation that matches the original Python code
   */
  async getState(): Promise<BrowserState> {
    console.log(`[BrowserContext.getState ######]`);
    try {
      // Wait for page and frames to load
      console.log(`[BrowserContext.getState.waiting_for_load ######]`);
      await this._waitForPageAndFramesLoad();
      console.log(`[BrowserContext.getState.load_complete ######]`);

      // Update state and store it in the session's cachedState
      console.log(`[BrowserContext.getState.updating_state ######]`);
      const state = await this._updateState();
      console.log(`[BrowserContext.getState.state_updated ######]`, {
        url: state.url,
        title: state.title,
        tabsCount: state.tabs.length,
        hasScreenshot: !!state.screenshot,
        selectorMapSize: Object.keys(state.selectorMap).length,
        tabs: state.tabs,
      });

      // Update the session's cachedState to match the current state
      // This follows the Python implementation pattern where session.cached_state = await self._update_state()
      console.log(`[BrowserContext.getState.getting_session ######]`);
      const session = await this.getSession();
      console.log(`[BrowserContext.getState.session_obtained ######]`, {
        sessionExists: !!session,
        hadCachedState: !!session.cachedState,
      });
      session.cachedState = state;
      console.log(`[BrowserContext.getState.cached_state_updated ######]`);

      // Return the state
      console.log(`[BrowserContext.getState.returning_state ######]`);
      return state;
    } catch (error) {
      console.log(`[BrowserContext.getState.error ######]`, {
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error(`[BrowserContext.getState] Error in getState():`, error);
      throw error;
    }
  }

  /**
   * Update and return state
   * This matches the original Python implementation
   */
  async _updateState(focusElement: number = -1): Promise<BrowserState> {
    console.log(`[BrowserContext._updateState ######]`, {
      focusElement,
    });

    try {
      // Get the current page
      console.log(`[BrowserContext._updateState.getting_page ######]`);
      const page = await this.getCurrentPage();
      console.log(`[BrowserContext._updateState.got_page ######]`, {
        tabId: page.tabId,
        url: page.url(),
      });

      // Check if this is a protected URL that we can't access
      const currentUrl = page.url();
      console.log(`[BrowserContext._updateState.url_check ######]`, {
        currentUrl,
        isChrome: currentUrl.startsWith('chrome://'),
        isChromeExtension: currentUrl.startsWith('chrome-extension://'),
      });
      if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
        console.log(`⚠️ Cannot access protected URL: ${currentUrl} - returning minimal state`);
        console.log(`[BrowserContext._updateState.protected_url ######]`, {
          currentUrl,
        });

        // Return minimal state for protected URLs
        console.log(`[BrowserContext._updateState.getting_tabs_protected ######]`);
        const tabs = await this._getTabsInfo();
        console.log(`[BrowserContext._updateState.tabs_protected ######]`, {
          tabsCount: tabs.length,
          tabs,
        });
        const state = new BrowserState(
          currentUrl,
          await page.title().catch(() => 'Protected Page'),
          tabs,
          undefined, // No screenshot
          0, // pixelsAbove
          0, // pixelsBelow
          [], // browserErrors
          undefined, // No element tree
          undefined, // No root element
          {} // Empty selector map
        );
        console.log(`[BrowserContext._updateState.protected_state_created ######]`);
        return state;
      }

      // Test if page is still accessible
      console.log(`[BrowserContext._updateState.accessibility_test ######]`);
      try {
        // Run a minimal evaluate to ensure the page is responsive
        await page.evaluate(() => 1);
        console.log(`[BrowserContext._updateState.accessibility_success ######]`);
      } catch (error) {
        console.log(`[BrowserContext._updateState.accessibility_error ######]`, {
          error: String(error),
        });
        // Continue without failing - page might still be usable for screenshots/other operations
      }

      // When using AI snapshots, skip traditional DOM parsing and screenshots
      console.log(`[BrowserContext._updateState.mode_check ######]`, {
        useSnapshotForAI: this.config.useSnapshotForAI,
      });
      if (this.config.useSnapshotForAI) {
        console.log('📸 Using AI snapshot mode - skipping screenshots and DOM highlighting');
        console.log(`[BrowserContext._updateState.ai_snapshot_mode ######]`);

        // Generate AI snapshot to extract ARIA references
        let selectorMap: SelectorMap = {};
        try {
          console.log(`[BrowserContext._updateState.generating_snapshot ######]`);
          const aiSnapshot = await this.snapshotForAI();
          console.log(`[BrowserContext._updateState.snapshot_generated ######]`, {
            snapshotLength: aiSnapshot.length,
          });
          selectorMap = this._buildSelectorMapFromSnapshot(aiSnapshot);
          console.log(
            `🗺️ Built selector map from AI snapshot: ${Object.keys(selectorMap).length} elements`
          );
          console.log(`[BrowserContext._updateState.selector_map_built ######]`, {
            selectorMapSize: Object.keys(selectorMap).length,
            firstFewKeys: Object.keys(selectorMap).slice(0, 5),
          });
        } catch (error) {
          console.log(`[BrowserContext._updateState.snapshot_error ######]`, {
            error: String(error),
          });
          console.warn('⚠️ Failed to build selector map from AI snapshot:', error);
        }

        // Get scroll info
        console.log(`[BrowserContext._updateState.getting_scroll_info ######]`);
        const [pixelsAbove, pixelsBelow] = await this._getScrollInfo(page);
        console.log(`[BrowserContext._updateState.scroll_info ######]`, {
          pixelsAbove,
          pixelsBelow,
        });

        // Get tabs info
        console.log(`[BrowserContext._updateState.getting_tabs_info ######]`);
        const tabs = await this._getTabsInfo();
        console.log(`[BrowserContext._updateState.tabs_info_received ######]`, {
          tabsCount: tabs.length,
          tabs,
        });

        // Create minimal state with selector map from AI snapshot
        console.log(`[BrowserContext._updateState.creating_state ######]`);
        const state = new BrowserState(
          page.url(),
          await page.title(),
          tabs,
          undefined, // No screenshot when using AI snapshots
          pixelsAbove,
          pixelsBelow,
          [], // browserErrors
          undefined, // No element tree when using AI snapshots
          undefined, // No root element when using AI snapshots
          selectorMap // Selector map built from AI snapshot ARIA references
        );
        console.log(`[BrowserContext._updateState.state_created ######]`, {
          url: state.url,
          title: state.title,
          tabsCount: state.tabs.length,
          selectorMapSize: Object.keys(state.selectorMap).length,
        });

        // Store the current state for future reference
        this.currentState = state;
        console.log(`[BrowserContext._updateState.state_stored ######]`);

        // Explicitly update the session's cachedState here
        const session = await this.getSession();
        session.cachedState = state;
        console.log(`[BrowserContext._updateState.session_updated ######]`);
        return state;
      }

      // Traditional path: Remove highlights, parse DOM, take screenshots
      console.log('📷 Using traditional mode - taking screenshots and highlighting elements');
      await this.removeHighlights();

      // Get clickable elements
      const domService = new DOMService(page);
      const content = await domService.getClickableElements(
        this.config.highlightElements,
        focusElement,
        this.config.viewportExpansion
      );
      // Got clickable elements

      // Take screenshot
      const screenshot = await this.takeScreenshot();

      // Get scroll info
      const [pixelsAbove, pixelsBelow] = await this._getScrollInfo(page);

      // Get tabs info
      const tabs = await this._getTabsInfo();

      // Create and return the browser state
      const state = new BrowserState(
        page.url(),
        await page.title(),
        tabs,
        screenshot,
        pixelsAbove,
        pixelsBelow,
        [], // browserErrors
        content.elementTree,
        content.rootElement,
        content.selectorMap
      );
      // BrowserState created

      // Store the current state for future reference
      this.currentState = state;

      // Explicitly update the session's cachedState here (this is critical for selector map access)
      const session = await this.getSession();
      session.cachedState = state;
      return state;
    } catch (error) {
      console.error(`[BrowserContext._updateState] Failed to update state:`, error);
      // Return last known good state if available
      if (this.currentState) {
        return this.currentState;
      }
      throw error;
    }
  }

  /**
   * Get the current session information
   * In Python this returns the actual session object, not a serialized dictionary
   */
  async getSession(): Promise<BrowserSession> {
    return this.session;
  }

  /**
   * Removes all highlight overlays and labels created by the highlightElement function
   * Exact match to Python implementation's remove_highlights method
   */
  async removeHighlights(): Promise<void> {
    try {
      const page = await this.getCurrentPage();

      // About to evaluate highlight removal
      await page.evaluate(() => {
        try {
          // Remove the highlight container and all its contents
          const container = document.getElementById('playwright-highlight-container');
          if (container) {
            container.remove();
          }

          // Remove highlight attributes from elements
          const highlightedElements = document.querySelectorAll(
            '[browser-user-highlight-id^="playwright-highlight-"]'
          );
          highlightedElements.forEach(el => {
            el.removeAttribute('browser-user-highlight-id');
          });
        } catch (e) {
          console.error('Failed to remove highlights:', e);
        }
      });
      // Highlight removal evaluation completed
    } catch (error) {
      // Removed noisy debug log for removeHighlights; keep non-critical behavior
      // Don't raise the error since this is not critical functionality
    }

    // removeHighlights completed
  }

  /**
   * Internal method for getting scroll info
   * @private
   */
  async _getScrollInfo(page: Page): Promise<[number, number]> {
    try {
      const scrollInfo = await page.evaluate(
        () => {
          return {
            pixelsAbove: window.scrollY,
            pixelsBelow:
              document.documentElement.scrollHeight - window.scrollY - window.innerHeight,
          };
        },
        undefined,
        { timeout: 1000 }
      ); // 1 second timeout for error handling
      return [scrollInfo.pixelsAbove, scrollInfo.pixelsBelow];
    } catch (error) {
      console.error('Error getting scroll info:', error);
      return [0, 0];
    }
  }

  /**
   * Property to store the current state
   */
  private currentState?: BrowserState;

  /**
   * Reset the browser session
   * Call this when you don't want to kill the context but just kill the state
   * Exact match to Python implementation's reset_context method
   */
  async resetContext(): Promise<void> {
    // Close all tabs and clear cached state
    const session = await this.getSession();

    if (session.context) {
      const pages = session.context.pages();
      for (const page of pages) {
        await page.close();
      }
    }

    session.cachedState = null;
    // Reset the targetId in the context state
    delete this.state.targetId;
  }

  /**
   * Get a map of selectors for the current page
   * This retrieves the selector map from the cached state
   */
  async getSelectorMap(): Promise<SelectorMap> {
    // Get the selector map from the cached state directly from the session
    const session = await this.getSession();
    if (session.cachedState && session.cachedState.selectorMap) {
      return session.cachedState.selectorMap;
    }
    return {};
  }

  /**
   * Get a debug view of the page structure including iframes
   * Exact match to Python implementation's get_page_structure method
   */
  async getPageStructure(): Promise<string> {
    const debugScript = (): string => {
      function getPageStructureInner(
        element: Document | Element = document,
        depth: number = 0,
        maxDepth: number = 10
      ): string {
        if (depth >= maxDepth) return '';

        const indent: string = '  '.repeat(depth);
        let structure: string = '';

        // Skip certain elements that clutter the output
        const skipTags = new Set<string>(['script', 'style', 'link', 'meta', 'noscript']);

        // Add current element info if it's not the document
        if (element !== document) {
          const htmlElement = element as Element;
          const tagName: string = htmlElement.tagName.toLowerCase();

          // Skip uninteresting elements
          if (skipTags.has(tagName)) return '';

          const id: string = htmlElement.id ? '#' + htmlElement.id : '';
          const classes: string =
            htmlElement.className && typeof htmlElement.className === 'string'
              ? '.' +
                htmlElement.className
                  .split(' ')
                  .filter((c: string) => c)
                  .join('.')
              : '';

          // Get additional useful attributes
          const attrs: string[] = [];
          const roleAttr: string | null = htmlElement.getAttribute('role');
          if (roleAttr) attrs.push('role="' + roleAttr + '"');

          const ariaLabelAttr: string | null = htmlElement.getAttribute('aria-label');
          if (ariaLabelAttr) attrs.push('aria-label="' + ariaLabelAttr + '"');

          const typeAttr: string | null = htmlElement.getAttribute('type');
          if (typeAttr) attrs.push('type="' + typeAttr + '"');

          const nameAttr: string | null = htmlElement.getAttribute('name');
          if (nameAttr) attrs.push('name="' + nameAttr + '"');

          const srcAttr: string | null = htmlElement.getAttribute('src');
          if (srcAttr) {
            const src: string = srcAttr;
            attrs.push('src="' + src.substring(0, 50) + (src.length > 50 ? '...' : '') + '"');
          }

          // Add element info
          structure +=
            indent +
            tagName +
            id +
            classes +
            (attrs.length ? ' [' + attrs.join(', ') + ']' : '') +
            '\\n';

          // Handle iframes specially
          if (tagName === 'iframe') {
            try {
              const iframeElement = htmlElement as HTMLIFrameElement;
              const iframeDoc: Document | null =
                iframeElement.contentDocument || iframeElement.contentWindow?.document || null;
              if (iframeDoc) {
                structure += indent + '  --- IFRAME CONTENT ---\\n';
                structure += getPageStructureInner(iframeDoc, depth + 1, maxDepth);
                structure += indent + '  --- END IFRAME ---\\n';
              } else {
                structure += indent + '  [Cannot access iframe content - likely cross-origin]\\n';
              }
            } catch (e: unknown) {
              const errorMessage: string = e instanceof Error ? e.message : String(e);
              structure += indent + '  [Cannot access iframe: ' + errorMessage + ']\\n';
            }
            // Skip child processing as we handled it specially
            return structure;
          }
        } else {
          // Document node
          structure += indent + 'document [URL: ' + document.location.href + ']\\n';
        }

        // Process child elements
        const children: HTMLCollection = element.children;
        for (let i = 0; i < children.length; i++) {
          const child: Element = children[i];
          structure += getPageStructureInner(child, depth + 1, maxDepth);
        }

        return structure;
      }

      return getPageStructureInner();
    };

    const page = await this.getCurrentPage();
    return await page.evaluate(debugScript);
  }

  /**
   * Get a DOM element by its index in the selector map
   * Exact match to Python implementation's get_dom_element_by_index method
   */
  async getDomElementByIndex(index: number | string): Promise<DOMElementNode> {
    const indexKey = String(index);
    const selectorMap = await this.getSelectorMap();

    if (!(indexKey in selectorMap)) {
      throw new Error(`Element index ${index} does not exist in selector map`);
    }

    // Direct match to Python implementation - returns element descriptor directly
    return selectorMap[indexKey];
  }

  /**
   * Get an element handle by its index in the selector map
   * Exact match to Python implementation's get_element_by_index method
   */
  async getElementByIndex(index: number | string): Promise<ElementHandle | null> {
    const selectorMap = await this.getSelectorMap();
    const indexKey = String(index);
    const elementHandle = await this.getLocateElement(selectorMap[indexKey]);
    return elementHandle;
  }

  /**
   * Helper function to get tag name from any ElementNode type
   */
  private static _getTagName(element: ElementNode): string {
    if (!element) {
      return 'unknown';
    }
    if ('tag' in element && element.tag) {
      return element.tag;
    }
    if ('tag_name' in element && element.tag_name) {
      return element.tag_name;
    }
    return 'unknown';
  }

  /**
   * Click on a DOM element node
   * Exact match to Python implementation's _click_element_node
   */
  async _clickElementNode(elementNode: ElementNode): Promise<string | null> {
    const page = await this.getCurrentPage();

    try {
      // Get element using getLocateElement (equivalent to Python's get_locate_element)
      const elementHandle = await this.getLocateElement(elementNode);

      if (!elementHandle) {
        throw new Error(
          `Element: ${JSON.stringify({
            tagName: BrowserContext._getTagName(elementNode),
            xpath: elementNode.xpath,
          })} not found`
        );
      }

      // Define a perform_click function just like in the Python implementation
      const performClick = async (clickFunc: () => Promise<void>): Promise<string | null> => {
        if (this.config.saveDownloadsPath) {
          try {
            // Cordyceps Chrome extension download handling
            // Use Cordyceps page.onDownload() instead of Playwright's waitForEvent
            let downloadDetected = false;
            let downloadPath: string | null = null;

            // Set up download listener for Cordyceps
            const downloadDisposable = page.onDownload(async download => {
              downloadDetected = true;

              // Get the suggested filename and save the file
              const suggestedFilename = download.suggestedFilename();

              // Get unique filename to avoid conflicts
              const uniqueFilename = await this._getUniqueFilename(
                this.config.saveDownloadsPath!,
                suggestedFilename
              );

              // In Chrome extension environment, downloads are handled by Chrome
              // We get the download path from the Chrome downloads API
              downloadPath = await download.path();

              // If we have a specific save path configured, try to save there
              if (this.config.saveDownloadsPath && downloadPath) {
                try {
                  // Create target path using simple string concatenation (Chrome extension compatible)
                  const separator = this.config.saveDownloadsPath.endsWith('/') ? '' : '/';
                  const targetPath = `${this.config.saveDownloadsPath}${separator}${uniqueFilename}`;
                  await download.saveAs(targetPath);
                  downloadPath = targetPath;
                } catch (saveError) {
                  // If saveAs fails in Chrome extension, use the default download path
                  console.warn(
                    'Could not save to custom path, using default download location:',
                    saveError
                  );
                }
              }
            });

            // Perform the click
            await clickFunc();

            // Wait a short time to see if download was triggered
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Clean up the download listener
            downloadDisposable.dispose();

            if (downloadDetected && downloadPath) {
              return downloadPath;
            }

            // If no download detected, proceed with normal navigation handling
            await page.waitForLoadState();
            await this._checkAndHandleNavigation(page);
            return null;
          } catch (e) {
            // Handle errors in Chrome extension environment
            if (e instanceof Error) {
              // Check for common Chrome extension errors
              if (e.message.includes('timeout') || e.message.includes('download')) {
                await page.waitForLoadState();
                await this._checkAndHandleNavigation(page);
                return null;
              }
            }
            throw e;
          }
        } else {
          // Standard click logic if no download is expected
          await clickFunc();

          // Wait for load state - this is critical and matches Python exactly
          await page.waitForLoadState();

          // Check and handle navigation
          await this._checkAndHandleNavigation(page);
        }
        return null;
      };

      // Try direct click as per Python implementation
      try {
        return await performClick(() => elementHandle.click({ timeout: 1500 }));
      } catch (standardError) {
        // If URL not allowed error, rethrow it
        if (standardError instanceof Error && standardError.message.includes('URL not allowed')) {
          throw standardError;
        }

        // If standard clicks fail, try JavaScript click as fallback (Python approach)
        try {
          return await performClick(() => elementHandle.click());
        } catch (jsClickErr) {
          // If URL not allowed error, rethrow it
          if (jsClickErr instanceof Error && jsClickErr.message.includes('URL not allowed')) {
            throw jsClickErr;
          }
          throw new Error(`Failed to click element: ${jsClickErr}`);
        }
      }
    } catch (e) {
      // Special handling for URL not allowed, to match Python's URLNotAllowedError
      if (e instanceof Error && e.message.includes('URL not allowed')) {
        throw e;
      }
      throw new Error(
        `Failed to click element: ${JSON.stringify({
          tagName: BrowserContext._getTagName(elementNode),
          xpath: elementNode.xpath,
        })}. Error: ${e}`
      );
    }
  }

  /**
   * Helper function to get parent from any ElementNode type
   */
  private static _getParent(element: ElementNode): ElementNode | null {
    if ('parent' in element && element.parent) {
      return element.parent;
    }
    return null;
  }

  /**
   * Helper function to get highlight index from any ElementNode type
   */
  private static _getHighlightIndex(element: ElementNode): number | undefined {
    if ('highlightIndex' in element) {
      return element.highlightIndex;
    }
    if ('highlight_index' in element) {
      return element.highlight_index;
    }
    return undefined;
  }

  /**
   * Helper function to convert ElementNode to ElementForSelector for CSS generation
   */
  private static _toElementForSelector(element: ElementNode): ElementForSelector {
    const result: ElementForSelector = {
      xpath: element.xpath || '',
      tag_name: BrowserContext._getTagName(element),
      highlight_index: BrowserContext._getHighlightIndex(element),
      attributes: element.attributes,
    };
    return result;
  }

  async getLocateElement(element: ElementNode): Promise<ElementHandle | null> {
    // Starting getLocateElement()

    if (!element) {
      // Element is null/undefined
      return null;
    }

    // Element metadata available for debugging

    // Start with getting the main frame from the page
    const page = await this.getCurrentPage();

    // Check if this is a real Cordyceps Page object
    let currentFrame: Frame | FrameLocator;
    if (typeof page.mainFrame === 'function') {
      currentFrame = page.mainFrame();
    } else {
      // This is likely a test mock - try to use it as a Frame-like object
      if ('waitForSelector' in page && typeof page.waitForSelector === 'function') {
        currentFrame = page as unknown as Frame;
      } else if ('frameLocator' in page && typeof page.frameLocator === 'function') {
        // Test mock has frameLocator - we can work with this for simple cases
        currentFrame = page as unknown as Frame;
      } else if ('elementHandle' in page && typeof page.elementHandle === 'function') {
        // Test mock has only elementHandle - use it directly as a Frame-like object
        currentFrame = page as unknown as Frame;
      } else {
        throw new Error(
          'Invalid Page object: missing mainFrame() method and required element methods'
        );
      }
    }

    // Start with the target element and collect all parents
    const parents: ElementNode[] = [];
    let current = element;
    let parent = BrowserContext._getParent(current);
    // Collecting parents chain

    while (parent) {
      // Found parent in chain
      parents.push(parent);
      current = parent;
      parent = BrowserContext._getParent(current);
    }

    // Total parents found logged

    // Reverse the parents list to process from top to bottom
    parents.reverse();
    // Parents reversed for top-to-bottom processing

    // Process all iframe parents in sequence
    const iframes = parents.filter(item => BrowserContext._getTagName(item) === 'iframe');

    for (let i = 0; i < iframes.length; i++) {
      const parent = iframes[i];
      const cssSelector = BrowserContext._enhancedCssSelectorForElement(
        BrowserContext._toElementForSelector(parent),
        true // Use true as default for includeDynamicAttributes
      );
      // Follow Cordyceps pattern: get iframe element, then get its contentFrame()
      // This is the correct approach for nested iframe navigation
      let iframeElement: ElementHandle | null = null;

      // Handle Frame, FrameLocator, and test mock cases
      if ('waitForSelector' in currentFrame && typeof currentFrame.waitForSelector === 'function') {
        // currentFrame is a Frame
        // Create iframe element using executeWithProgress to get proper Progress object
        iframeElement = await executeWithProgress(
          async progress => {
            return await (currentFrame as Frame).waitForSelector(progress, cssSelector, false, {
              strict: true,
            });
          },
          { timeout: 30000 }
        );
      } else if ('locator' in currentFrame && typeof currentFrame.locator === 'function') {
        // currentFrame is a FrameLocator
        const locator = (currentFrame as unknown as FrameLocator).locator(cssSelector);
        iframeElement = await locator.elementHandle();
      } else if (
        'frameLocator' in currentFrame &&
        typeof currentFrame.frameLocator === 'function' &&
        'elementHandle' in currentFrame &&
        typeof currentFrame.elementHandle === 'function'
      ) {
        // This is likely a test mock with frameLocator and elementHandle methods
        // For test mocks, we'll use frameLocator for navigation instead of contentFrame
        currentFrame = (
          currentFrame as unknown as { frameLocator: (selector: string) => FrameLocator }
        ).frameLocator(cssSelector);
        continue; // Skip the contentFrame logic for test mocks
      } else {
        throw new Error(
          `Unsupported frame type for iframe navigation: ${currentFrame.constructor.name}`
        );
      }

      if (!iframeElement) {
        throw new Error(`Could not find iframe element with selector: ${cssSelector}`);
      }

      // Found iframe element, getting contentFrame...

      // Get the actual Frame from the iframe element (this is the key insight from frameSelectors.ts)
      const contentFrame = await iframeElement.contentFrame();

      if (!contentFrame) {
        iframeElement.dispose(); // Clean up
        throw new Error(`Iframe element did not resolve to a content frame: ${cssSelector}`);
      }

      // Clean up the iframe element handle
      iframeElement.dispose();

      // Update currentFrame to the actual Frame object
      currentFrame = contentFrame;
    }

    const cssSelector = BrowserContext._enhancedCssSelectorForElement(
      BrowserContext._toElementForSelector(element),
      true // Use true as default for includeDynamicAttributes
    );
    // Generated final CSS selector

    try {
      // Current frame type before element location

      // Check object type by examining available methods
      // Priority: Frame (has waitForSelector) > FrameLocator (has locator) > TestMock (has elementHandle only)
      const hasLocatorMethod =
        'locator' in currentFrame && typeof currentFrame.locator === 'function';
      const hasElementHandleMethod =
        'elementHandle' in currentFrame && typeof currentFrame.elementHandle === 'function';
      const hasWaitForSelectorMethod =
        'waitForSelector' in currentFrame && typeof currentFrame.waitForSelector === 'function';

      // Determine frame-like object type
      const isRealFrame = hasWaitForSelectorMethod;
      const isFrameLocator = hasLocatorMethod && !hasWaitForSelectorMethod;
      const isTestMock = hasElementHandleMethod && !hasWaitForSelectorMethod && !hasLocatorMethod;

      if (isTestMock) {
        // Using test mock elementHandle path
        // This is a test mock with only elementHandle method
        try {
          // Calling elementHandle with selector
          const elementHandle = await (
            currentFrame as unknown as {
              elementHandle: (selector: string) => Promise<ElementHandle | null>;
            }
          ).elementHandle(cssSelector);

          if (elementHandle) {
            // Element handle obtained successfully via test mock
            return elementHandle;
          } else {
            // Element handle is null via test mock - element not found
            return null;
          }
        } catch (mockError) {
          console.error(`[BrowserContext.getLocateElement] Test mock error:`, mockError);
          return null;
        }
      } else if (isRealFrame) {
        // Using real Frame path
        // We're in a real Cordyceps Frame - use waitForSelector
        try {
          // Getting element handle with selector
          // Frame details available via currentFrame

          const elementHandle = await executeWithProgress(
            async progress => {
              return await (currentFrame as Frame).waitForSelector(progress, cssSelector, false, {
                strict: true,
              });
            },
            { timeout: 30000 }
          );

          if (elementHandle) {
            try {
              // Try to scroll into view if hidden - matches Python implementation
              await elementHandle.scrollIntoViewIfNeeded();
            } catch (scrollError) {
              // Ignore scroll errors
            }

            return elementHandle;
          }
          return null;
        } catch (frameSelectorError) {
          console.error(
            `[BrowserContext.getLocateElement] Frame waitForSelector error:`,
            frameSelectorError
          );
          return null;
        }
      } else if (isFrameLocator) {
        // We're in a frame locator
        try {
          const locator = (currentFrame as unknown as FrameLocator).locator(cssSelector);
          // Use the FrameLocator's locator method followed by elementHandle
          const elementHandle = await locator.elementHandle();

          if (elementHandle) {
            return elementHandle;
          } else {
            return null;
          }
        } catch (locatorError) {
          console.error(`[BrowserContext.getLocateElement] FrameLocator error:`, locatorError);
          return null;
        }
      } else {
        // Unsupported frame type
        const frameType = currentFrame.constructor.name;
        const availableMethods = Object.getOwnPropertyNames(currentFrame).filter(
          name => typeof (currentFrame as unknown as Record<string, unknown>)[name] === 'function'
        );
        console.error(`[BrowserContext.getLocateElement] Unsupported frame type: ${frameType}`);
        console.error(`[BrowserContext.getLocateElement] Available methods:`, availableMethods);
        throw new Error(
          `Unsupported frame type for element location: ${frameType}. ` +
            `Available methods: ${availableMethods.join(', ')}`
        );
      }
    } catch (error) {
      console.error(`[BrowserContext.getLocateElement] General error:`, error);
      return null;
    }
  }

  /**
   * Input text into a DOM element node
   * Exact match to Python implementation's _input_text_element_node
   */
  async _inputTextElementNode(elementNode: ElementNode, text: string): Promise<void> {
    // Starting _inputTextElementNode()

    try {
      // Get the element handle
      const elementHandle = await this.getLocateElement(elementNode);

      if (!elementHandle) {
        const highlightIndex = BrowserContext._getHighlightIndex(elementNode);
        const xpath = elementNode?.xpath ?? 'n/a';
        throw new Error(`Element not found: xpath: ${xpath}, index: ${highlightIndex ?? 'n/a'}`);
      }
      // Element handle obtained successfully

      // Ensure element is ready for input
      try {
        if (typeof elementHandle.scrollIntoViewIfNeeded === 'function') {
          await elementHandle.scrollIntoViewIfNeeded({ timeout: 1000 });
        }
      } catch (e) {
        // Silently continue if scroll operation fails
      }

      // Get element properties to determine input method using Cordyceps API
      // Getting element properties...

      let tagName = 'input'; // Default fallback
      let isContentEditable = null;
      let readonly = null;
      let disabled = false;

      try {
        // Try to get element properties, but handle test mocks gracefully
        if (typeof elementHandle.getTagName === 'function') {
          tagName = (await elementHandle.getTagName()).toLowerCase();
        } else {
          // getTagName not available, using default
        }

        if (typeof elementHandle.getAttribute === 'function') {
          isContentEditable = await elementHandle.getAttribute('contenteditable');
          readonly = await elementHandle.getAttribute('readonly');
        } else {
          // getAttribute not available, using defaults
        }

        if (typeof elementHandle.isDisabled === 'function') {
          disabled = await elementHandle.isDisabled();
        } else {
          // isDisabled not available, using default
        }
      } catch (propertyError) {
        // Error getting element properties (using defaults)
      }

      const isEditableElement = isContentEditable === 'true' || isContentEditable === '';
      const isReadonly = readonly !== null;

      // Use appropriate input method based on element properties
      if ((isEditableElement || tagName === 'input') && !(isReadonly || disabled)) {
        // For content-editable elements, clear existing content and type new text
        if (typeof elementHandle.setTextContent === 'function') {
          await elementHandle.setTextContent('');
        }

        if (typeof elementHandle.type === 'function') {
          await elementHandle.type(text, { delay: 5 });
        } else {
          if (typeof elementHandle.fill === 'function') {
            await elementHandle.fill(text);
          } else {
            throw new Error('Neither type nor fill methods available on element handle');
          }
        }
      } else {
        // For regular input elements, use fill method
        if (typeof elementHandle.fill === 'function') {
          await elementHandle.fill(text);
        } else {
          if (typeof elementHandle.type === 'function') {
            await elementHandle.type(text, { delay: 5 });
          } else {
            throw new Error('Neither fill nor type methods available on element handle');
          }
        }
      }
    } catch (error) {
      // If it's already an element not found error, preserve the original message
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }

      // For other errors, provide a generic failure message with context
      const highlightIndex = BrowserContext._getHighlightIndex(elementNode);
      const xpath = elementNode?.xpath ?? 'n/a';
      throw new Error(
        `Failed to input text into element (index: ${highlightIndex || 'unknown'}, xpath: ${xpath}): ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a unique filename using UUID to avoid conflicts
   * Chrome extension compatible version without Node.js dependencies
   */
  async _getUniqueFilename(directory: string, filename: string): Promise<string> {
    // Split filename into base and extension using built-in string methods
    const lastDotIndex = filename.lastIndexOf('.');
    const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

    const base = hasExtension ? filename.substring(0, lastDotIndex) : filename;
    const ext = hasExtension ? filename.substring(lastDotIndex) : '';

    // Use UUID to ensure uniqueness in Chrome extension environment
    const uuid = generateUuid();
    const shortUuid = uuid.substring(0, 8); // Use first 8 characters for shorter filename

    // Create a unique filename with UUID component
    const newFilename = `${base}_${shortUuid}${ext}`;

    return newFilename;
  }

  /**
   * Check if current page URL is allowed and handle if not
   * Exactly matches the Python implementation's _check_and_handle_navigation method
   */
  async _checkAndHandleNavigation(page: Page): Promise<void> {
    const url = page.url() || '';
    if (!this._isUrlAllowed(url)) {
      console.warn(`Navigation to non-allowed URL detected: ${url}`);
      try {
        await this.goBack();
      } catch (e) {
        console.error(`Failed to go back after detecting non-allowed URL: ${e}`);
      }
      throw new Error(`Navigation to non-allowed URL: ${url}`);
    }
  }

  /**
   * Navigate back in browser history
   * Exact match to Python implementation's go_back method
   */
  async goBack(): Promise<void> {
    const page = await this.getCurrentPage();
    try {
      // 10 ms timeout
      await page.goBack({ timeout: 200, waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait a bit to ensure navigation

      // We might want to add this back in later: await this._waitForPageAndFramesLoad({ timeoutOverwrite: 1 });
    } catch (e: unknown) {
      // Continue even if it's not fully loaded, because we wait later for the page to load
    }
  }

  /**
   * Navigate forward in browser history
   * Exact match to Python implementation's go_forward method
   */
  async goForward(): Promise<void> {
    const page = await this.getCurrentPage();
    try {
      await page.goForward({ timeout: 200, waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait a bit to ensure navigation
      // We might want to add this back in later: await this._waitForPageAndFramesLoad({ timeoutOverwrite: 1 });
    } catch (e: unknown) {
      // Continue even if it's not fully loaded, because we wait later for the page to load
    }
  }

  // Navigation Helpers
  async navigateTo(url: string): Promise<void> {
    this.safeGoto(url, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Create a new tab and optionally navigate to a URL
   * Chrome extension-compatible version of Python implementation's create_new_tab method
   */
  async createNewTab(url?: string): Promise<void> {
    if (url && !this._isUrlAllowed(url)) {
      throw new Error(`Cannot create new tab with non-allowed URL: ${url}`);
    }

    // Ensure we're in an active state
    if (this.session.state !== BrowserContextState.ACTIVE) {
      await this.enter();
    }

    // Create new page using BrowserWindow's newPage method
    const newPage = await this.browserWindow.newPage();

    // Update our pages array to include the new page
    if (!this.pages.includes(newPage)) {
      this.pages.push(newPage);
    }

    if (url) {
      // For user-provided URLs, do full navigation and load detection
      await newPage.goto(url, { waitUntil: 'load' });
      await this._waitForPageAndFramesLoad({ timeoutOverwrite: 1 });

      // Update state for navigated tabs
      try {
        await this.getState();
      } catch (error) {
        console.warn('Failed to update state after creating new tab:', error);
      }
    } else {
      // For new tab (no URL), just wait for basic readiness without full load
      // Chrome new tab pages have complex iframe hierarchies that can hang
      try {
        console.log('Creating new tab without URL - using simplified load detection');
        await Promise.race([
          newPage.waitForLoadState('domcontentloaded', { timeout: 5000 }),
          new Promise<void>(resolve => setTimeout(resolve, 3000)), // Max 3s wait
        ]);
        console.log('New tab basic load completed or timed out gracefully');
      } catch (error) {
        console.warn('New tab basic load failed, continuing anyway:', error);
      }

      // Skip state update for new tab pages to avoid chrome://newtab/ URL validation issues
      console.log(
        'Skipping state update for new tab without URL to avoid chrome:// URL validation'
      );
    }
  }

  /**
   * Switch to a specific tab by its page_id
   * Chrome extension implementation - uses Cordyceps Page.bringToFront() API
   */
  async switchToTab(pageId: number): Promise<void> {
    console.log(`[BrowserContext.switchToTab ######]`, {
      requestedPageId: pageId,
    });
    // Ensure we're in an active state
    if (this.session.state !== BrowserContextState.ACTIVE) {
      console.log(`[BrowserContext.switchToTab.entering ######]`);
      await this.enter();
    }

    console.log(`[BrowserContext.switchToTab.validation ######]`, {
      pageId,
      pagesLength: this.pages.length,
      validRange: `0-${this.pages.length - 1}`,
    });
    // Validate pageId is within bounds
    if (pageId < 0 || pageId >= this.pages.length) {
      console.log(`[BrowserContext.switchToTab.invalid_pageId ######]`, {
        pageId,
        pagesLength: this.pages.length,
      });
      throw new Error(
        `No tab found with page_id: ${pageId}. Available pages: 0-${this.pages.length - 1}`
      );
    }

    const page = this.pages[pageId];
    console.log(`[BrowserContext.switchToTab.page_found ######]`, {
      pageId,
      tabId: page.tabId,
      url: page.url(),
    });

    // Check if the tab's URL is allowed before switching
    const pageUrl = page.url();
    console.log(`[BrowserContext.switchToTab.url_check ######]`, {
      pageUrl,
      isAllowed: this._isUrlAllowed(pageUrl),
    });
    if (pageUrl && !this._isUrlAllowed(pageUrl)) {
      console.log(`[BrowserContext.switchToTab.url_not_allowed ######]`, {
        pageUrl,
      });
      throw new Error(`Cannot switch to tab with non-allowed URL: ${pageUrl}`);
    }

    try {
      console.log(`[BrowserContext.switchToTab.bring_to_front ######]`, {
        tabId: page.tabId,
      });
      // Use Cordyceps Page.bringToFront() API instead of direct Chrome tabs API
      await page.bringToFront();
      console.log(`[BrowserContext.switchToTab.brought_to_front ######]`);

      // Wait for the page to be ready after switching
      // Use timeout protection for Chrome internal pages
      if (pageUrl?.startsWith('chrome://') || pageUrl?.startsWith('chrome-untrusted://')) {
        console.log(
          `Switching to Chrome internal page (${pageUrl}) - using simplified load detection`
        );
        console.log(`[BrowserContext.switchToTab.chrome_page ######]`, {
          pageUrl,
        });
        try {
          await Promise.race([
            page.waitForLoadState('domcontentloaded', { timeout: 3000 }),
            new Promise<void>(resolve => setTimeout(resolve, 2000)), // Max 2s wait
          ]);
          console.log(`[BrowserContext.switchToTab.chrome_page_loaded ######]`);
        } catch (error) {
          console.log(`[BrowserContext.switchToTab.chrome_load_error ######]`, {
            error: String(error),
          });
          console.warn(
            'Chrome internal page load check failed after switch, continuing anyway:',
            error
          );
        }
      } else {
        console.log(`[BrowserContext.switchToTab.regular_page_wait ######]`, {
          pageUrl,
        });
        // For regular pages, wait for load state
        await page.waitForLoadState('load', { timeout: 10000 });
        console.log(`[BrowserContext.switchToTab.regular_page_loaded ######]`);
      }

      console.log(`Successfully switched to tab ${pageId} (tabId: ${page.tabId})`);
      console.log(`[BrowserContext.switchToTab.success ######]`, {
        pageId,
        tabId: page.tabId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[BrowserContext.switchToTab.error ######]`, {
        pageId,
        tabId: page?.tabId,
        error: errorMessage,
      });
      console.error(`Failed to switch to tab ${pageId}:`, errorMessage);
      throw new Error(`Failed to switch to tab ${pageId}: ${errorMessage}`);
    }
  }

  /**
   * Close the current tab
   * Chrome extension-compatible version that works with Cordyceps system
   */
  async closeCurrentTab(): Promise<void> {
    // Ensure we're in an active state
    if (this.session.state !== BrowserContextState.ACTIVE) {
      await this.enter();
    }

    const page = await this.getCurrentPage();
    const tabId = page.tabId;

    console.log(`Closing current tab (tabId: ${tabId})`);

    try {
      // Count tabs before closing for validation
      const allTabsBefore = await chrome.tabs.query({ windowId: this.browserWindow.windowId });
      const browserWindowPagesBefore = this.browserWindow.pages();

      console.log(
        `Before close: ${allTabsBefore.length} total tabs, ${browserWindowPagesBefore.length} BrowserWindow pages`
      );

      // Close the Cordyceps Page - this now handles both cleanup and Chrome tab removal
      await page.close();

      // Wait for the tab removal to be processed by the system
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get remaining pages from BrowserWindow (source of truth after cleanup)
      const remainingPages = this.browserWindow.pages();
      const allTabsAfter = await chrome.tabs.query({ windowId: this.browserWindow.windowId });

      console.log(
        `After close: ${allTabsAfter.length} total tabs, ${remainingPages.length} BrowserWindow pages`
      );

      // Update our pages array first before any other operations
      this.pages = remainingPages;

      if (remainingPages.length > 0) {
        // Switch to the first available tab
        const firstPage = remainingPages[0];
        console.log(
          `Switching to first available tab (tabId: ${firstPage.tabId}) after closing current tab`
        );

        // Use chrome.tabs.update to activate the tab
        await chrome.tabs.update(firstPage.tabId, { active: true });

        // Also call getCurrentPage to ensure proper state management
        await this.getCurrentPage();
      } else {
        // No tabs left - the browser context should be closed
        console.log(`No tabs remaining after closing current tab`);
        this.pages = [];
        await this.close();
      }

      // Log final state for debugging
      console.log(`closeCurrentTab completed: ${this.pages.length} pages remaining`);
      console.log(
        'Final pages array:',
        this.pages.map(p => ({ tabId: p.tabId, url: p.url() }))
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to close current tab:`, errorMessage);
      throw new Error(`Failed to close current tab: ${errorMessage}`);
    }
  }

  /**
   * Get the current page HTML content
   * Exact match to Python implementation's get_page_html method
   */
  async getPageHtml(): Promise<string> {
    const page = await this.getCurrentPage();
    return await page.content();
  }

  /**
   * Execute JavaScript code on the page
   * Exact match to Python implementation's execute_javascript method
   * Typed to forward generics and optional argument/options to Page.evaluate
   */
  async executeJavaScript<R, Arg = void>(
    script: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number }
  ): Promise<R> {
    const page = await this.getCurrentPage();
    return await page.evaluate<R, Arg>(script, arg as Arg, options);
  }

  /**
   * Refresh the current page
   * Exact match to Python implementation's refresh_page method
   */
  async refreshPage(): Promise<void> {
    const page = await this.getCurrentPage();
    await page.reload();
    await page.waitForLoadState();
  }

  /**
   * Scroll to the bottom of the page
   */
  async scrollToBottom(): Promise<void> {
    try {
      const page = await this.getCurrentPage();
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      console.info('Scrolled to bottom of page');
    } catch (e: unknown) {
      console.error('Error scrolling to bottom:', e);
    }
  }

  /**
   * Scroll to the top of the page
   */
  async scrollToTop(): Promise<void> {
    try {
      const page = await this.getCurrentPage();
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      console.info('Scrolled to top of page');
    } catch (e: unknown) {
      console.error('Error scrolling to top:', e);
    }
  }

  /**
   * Reinitialize the current page for recovery purposes
   * Chrome extension-compatible version that refreshes the page and clears cached state
   */
  async reinitializePage(): Promise<void> {
    try {
      const page = await this.getCurrentPage();
      const url = page.url();
      console.info('Reinitializing page for recovery, current URL:', url);

      // Clear any cached state
      this.currentState = undefined;
      const session = await this.getSession();
      session.cachedState = null;

      // Remove any highlights before refresh
      await this.removeHighlights();

      // Refresh the page to reinitialize DOM state
      await page.reload({ waitUntil: 'networkidle' });

      // Wait for page to be fully loaded
      await this._waitForPageAndFramesLoad({ timeoutOverwrite: 2 });

      console.info('Page reinitialized successfully');
    } catch (e: unknown) {
      console.error('Error reinitializing page:', e);
      throw new Error(`Failed to reinitialize page: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Check if element or its children are file uploaders
   * Exact match to Python implementation's is_file_uploader method
   */
  async isFileUploader(
    element: ElementNode | null,
    maxDepth: number = 3,
    currentDepth: number = 0
  ): Promise<boolean> {
    // Check if element is valid
    if (!element) {
      return false;
    }

    // Check if we've exceeded the maximum depth
    if (currentDepth > maxDepth) {
      return false;
    }

    // Get tag name from different element types
    let tagName: string;
    if ('tagName' in element && typeof element.tagName === 'string') {
      // DOMElementNode class instance
      tagName = element.tagName;
    } else if ('tag' in element && typeof element.tag === 'string') {
      // ElementNodeDict or DOMElementNode interface
      tagName = element.tag;
    } else if ('tag_name' in element && typeof element.tag_name === 'string') {
      // ElementForSelector
      tagName = element.tag_name;
    } else {
      return false;
    }

    // Check current element
    let isUploader = false;

    // Check for file input attributes
    if (tagName === 'input') {
      const attributes = 'attributes' in element ? element.attributes : {};
      isUploader = attributes?.type === 'file' || attributes?.accept !== undefined;
    }

    if (isUploader) {
      return true;
    }

    // Recursively check children (only if we haven't reached max depth)
    if ('children' in element && element.children && currentDepth < maxDepth) {
      for (const child of element.children) {
        if (child) {
          if (await this.isFileUploader(child, maxDepth, currentDepth + 1)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Take a snapshot of the current page for AI processing
   * Delegates to the page's snapshotForAI method
   */
  async snapshotForAI(options?: { progress?: Progress }): Promise<string> {
    const page = await this.getCurrentPage();
    return await page.snapshotForAI(options);
  }

  /**
   * Build a selector map from AI snapshot ARIA references
   * Parses snapshot content to extract [ref=e123] references and creates minimal DOM elements
   */
  private _buildSelectorMapFromSnapshot(snapshot: string): SelectorMap {
    const selectorMap: SelectorMap = {};

    // Regular expression to match ARIA references like [ref=e123] or [ref=f1e5]
    const ariaRefRegex = /\[ref=([ef]\d+e?\d*)\]/g;

    let match;
    while ((match = ariaRefRegex.exec(snapshot)) !== null) {
      const fullRef = match[1]; // e.g., "e123" or "f1e5"

      // Extract the numeric part for the selector map key
      let numericIndex: string;

      if (fullRef.startsWith('e')) {
        // Simple element reference: e123 -> 123
        numericIndex = fullRef.substring(1);
      } else if (fullRef.startsWith('f')) {
        // Frame element reference: f1e5 -> 5 (element ID within frame)
        const frameMatch = fullRef.match(/f\d+e(\d+)/);
        if (frameMatch) {
          numericIndex = frameMatch[1];
        } else {
          continue; // Skip invalid frame references
        }
      } else {
        continue; // Skip unknown reference formats
      }

      // Don't create duplicate entries
      if (numericIndex in selectorMap) {
        continue;
      }

      // Create a minimal DOM element node for this ARIA reference
      // The key is to use the aria-ref selector format that cordyceps understands
      const minimalElement: DOMElementNode = new DOMElementNode(
        'element', // tag - we don't know the actual tag
        `aria-ref=${fullRef}`, // xpath - use ARIA reference as selector that cordyceps can resolve
        {}, // attributes - empty object
        [], // children
        false, // isVisible
        true, // isInteractive - mark as interactive since it has an ARIA ref
        false, // isTopElement
        false, // isInViewport
        false, // hasShadowRoot
        parseInt(numericIndex), // highlightIndex - use the numeric index
        undefined, // parent
        undefined, // viewportInfo
        null, // pageCoordinates
        null // viewportCoordinates
      );

      // Add to selector map using numeric index as key
      selectorMap[numericIndex] = minimalElement;
    }

    return selectorMap;
  }
}
