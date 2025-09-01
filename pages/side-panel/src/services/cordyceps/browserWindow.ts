import { Disposable } from 'vs/base/common/lifecycle';
import { Progress, ProgressController } from './core/progress';
import { Page } from './page';
import { Session } from './session';

const windowId = () =>
  new Promise<number>(resolve => chrome.windows.getCurrent(window => resolve(window.id!)));

export class BrowserWindow extends Disposable {
  private _pages = new Map<number, Page>();
  private _processedCommittedDocuments: Set<string> = new Set();
  private _activeTabId: number | undefined;
  readonly windowId: number;
  readonly session: Session;

  private constructor(windowId: number) {
    super();
    this.windowId = windowId;
    this.session = this._register(new Session(windowId));
  }

  dispose(): void {
    for (const p of this._pages.values()) p.dispose();
    this._pages.clear();
    super.dispose();
  }

  static async create(): Promise<BrowserWindow> {
    const id = await windowId();
    const browserWindow = new BrowserWindow(id);
    await browserWindow._initialize();
    return browserWindow;
  }

  private async _initialize(): Promise<void> {
    const tabs = await chrome.tabs.query({ windowId: this.windowId });

    // Find and set the active tab
    const activeTab = tabs.find(tab => tab.active);
    if (activeTab?.id) {
      this._activeTabId = activeTab.id;
    }

    for (const tab of tabs) {
      if (tab.id) {
        const page = this._createPage(tab.id);
        // After creating the page, fetch all its frames.
        await this._fetchAllFramesForTab(page);
      }
    }

    // Register session event listeners
    this._register(
      this.session.onCommitted(details => {
        this._handleNavigationCommitted(details);
      })
    );

    // Translate lifecycle events to frames
    this._register(
      this.session.onCompleted(d => {
        const page = this._pages.get(d.tabId);
        if (!page) return;

        // Get the specific frame or use main frame as fallback only if it exists
        let frame = page.frameManager.frame(d.frameId);
        if (!frame) {
          try {
            frame = page.frameManager.mainFrame();
          } catch (error) {
            return;
          }
        }

        frame._onLifecycleEvent('load');
        // Relay page-level load for consumers
        page._fireLoad(frame);
      })
    );
    this._register(
      this.session.onDOMContentLoaded(d => {
        const page = this._pages.get(d.tabId);
        if (!page) return;

        // Get the specific frame or use main frame as fallback only if it exists
        let frame = page.frameManager.frame(d.frameId);
        if (!frame) {
          try {
            frame = page.frameManager.mainFrame();
          } catch (error) {
            return;
          }
        }

        frame._onLifecycleEvent('domcontentloaded');
        // Relay page-level domcontentloaded for consumers
        page._fireDomContentLoaded(frame);
      })
    );
    // Commit handling is performed inside _handleMainFrameNavigation/_handleSubframeNavigation after frames are ensured
    this._register(
      this.session.onBeforeNavigate(d => {
        // Signal that a navigation was requested. This helps barriers/waiters kick in early.
        const page = this._pages.get(d.tabId);
        if (!page) return;
        page.frameManager.frameRequestedNavigation(d.frameId, undefined);
      })
    );
    this._register(
      this.session.onErrorOccurred(d => {
        const page = this._pages.get(d.tabId);
        if (!page) return;
        // Abort pending navigation for this frame if any.
        page.frameManager.frameAbortedNavigation(d.frameId, d.error);
      })
    );

    this._register(
      this.session.onTabRemoved(({ tabId }) => {
        // Clear active tab cache if the removed tab was the active one
        if (this._activeTabId === tabId) {
          this._activeTabId = undefined;
        }

        const page = this._pages.get(tabId);
        if (page) {
          page.dispose();
          this._pages.delete(tabId);
        }
        // Clean up dedupe keys for this tab to prevent memory growth
        const prefix = `${tabId}:`;
        for (const key of this._processedCommittedDocuments) {
          if (key.startsWith(prefix)) this._processedCommittedDocuments.delete(key);
        }
      })
    );

    // Listen for new tab creation
    this._register(
      this.session.onTabCreated(tab => {
        if (this._store.isDisposed) {
          return;
        }
        if (tab.windowId === this.windowId && tab.id) {
          this._createPage(tab.id);
          // New tabs start with just a main frame, let navigation events handle the rest
        }
      })
    );

    // Listen for tab activation changes
    this._register(
      this.session.onTabActivated(activeInfo => {
        if (activeInfo.windowId === this.windowId) {
          this._activeTabId = activeInfo.tabId;
        }
      })
    );

    // Same-document navigations should trigger internal navigation
    this._register(
      this.session.onHistoryStateUpdated(d => {
        const page = this._pages.get(d.tabId);
        if (!page) return;

        // Get the specific frame or use main frame as fallback only if it exists
        let frame = page.frameManager.frame(d.frameId);
        if (!frame) {
          try {
            frame = page.frameManager.mainFrame();
          } catch (error) {
            return;
          }
        }
        frame.setUrl(d.url);
        frame._fireInternalNavigation(d.url, '', undefined, undefined, true);
      })
    );
    this._register(
      this.session.onReferenceFragmentUpdated(d => {
        const page = this._pages.get(d.tabId);
        if (!page) return;

        // Get the specific frame or use main frame as fallback only if it exists
        let frame = page.frameManager.frame(d.frameId);
        if (!frame) {
          try {
            frame = page.frameManager.mainFrame();
          } catch (error) {
            return;
          }
        }
        frame.setUrl(d.url);
        frame._fireInternalNavigation(d.url, '', undefined, undefined, true);
      })
    );
  }

  private async _handleNavigationCommitted(
    details: chrome.webNavigation.WebNavigationTransitionCallbackDetails
  ): Promise<void> {
    try {
      // Check if this BrowserWindow has been disposed
      if (this._store.isDisposed) {
        return;
      }

      // Check if the tab belongs to this window
      const tab = await chrome.tabs.get(details.tabId);
      if (tab.windowId !== this.windowId) {
        return;
      }

      // De-duplication guard: when documentId is available, only handle a commit once per (tab, frame, document)
      if (details.documentId) {
        const key = `${details.tabId}:${details.frameId}:${details.documentId}`;
        if (this._processedCommittedDocuments.has(key)) {
          return;
        }
        this._processedCommittedDocuments.add(key);
      }

      if (details.frameId === 0) {
        // Main frame navigation - create or update page
        await this._handleMainFrameNavigation(details.tabId);
        const page = this._pages.get(details.tabId);
        if (page) {
          try {
            const main = page.frameManager.mainFrame();
            const newDoc = details.documentId ? { documentId: details.documentId } : undefined;
            // Emit internal navigation to unblock waiters
            main._fireInternalNavigation(
              details.url,
              '',
              newDoc ? { documentId: newDoc.documentId, request: undefined } : undefined,
              undefined,
              true
            );
            // Invalidate previous execution context; new one will be created when content script loads
            main._onNewDocumentCommitted('Main frame committed new document');
            page.frameNavigatedToNewDocument(main);
          } catch (error) {
            console.warn(`Main frame not ready for tab ${details.tabId} after navigation:`, error);
            // The main frame will be processed when it's properly attached
          }
        }
      } else {
        // Subframe navigation - handle frame attachment for existing page
        await this._handleSubframeNavigation(details.tabId, details.frameId, details.url);
        const page = this._pages.get(details.tabId);
        if (page) {
          const frame = page.frameManager.frame(details.frameId);
          if (frame) {
            const newDoc = details.documentId ? { documentId: details.documentId } : undefined;
            frame._fireInternalNavigation(
              details.url,
              '',
              newDoc ? { documentId: newDoc.documentId, request: undefined } : undefined,
              undefined,
              true
            );
            // Invalidate subframe execution context on commit as well
            frame._onNewDocumentCommitted('Subframe committed new document');
            page.frameNavigatedToNewDocument(frame);
          }
        }
      }
    } catch (error) {
      // Tab may not exist anymore, ignore
      console.warn(`Failed to get tab ${details.tabId}:`, error);
    }
  }

  private async _fetchAllFramesForTab(page: Page): Promise<void> {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId: page.tabId });
      if (frames) {
        // Sort frames to ensure parents are attached before children
        const sortedFrames = this._sortFramesByHierarchy(frames);

        for (const frame of sortedFrames) {
          try {
            // The parentFrameId for the main frame is -1.
            const parentFrameId = frame.parentFrameId === -1 ? null : frame.parentFrameId;
            page.frameManager.frameAttached(frame.frameId, parentFrameId, frame.url);
          } catch (frameError) {
            console.warn(
              `Failed to attach frame ${frame.frameId} with parent ${frame.parentFrameId}:`,
              frameError
            );
            // Continue processing other frames even if one fails
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to get all frames for tab ${page.tabId}:`, error);
    }
  }

  private async _handleMainFrameNavigation(tabId: number): Promise<void> {
    try {
      const page = this._createPage(tabId);
      // Main frame navigation replaces all existing frames, so clear them.
      page.frameManager.clearFrames();
      // Re-fetch all frames for the tab.
      await this._fetchAllFramesForTab(page);

      try {
        const main = page.frameManager.mainFrame();
        if (main) {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab.url) main.setUrl(tab.url);
          } catch {
            // ignore
          }
          // Reset lifecycle and notify page about new document
          main._onClearLifecycle();
        }
      } catch (error) {
        // Main frame not ready yet, will be processed when attached
      }
    } catch (error) {
      // Failed to handle main frame navigation
    }
  }

  private async _handleSubframeNavigation(
    tabId: number,
    frameId: number,
    url: string
  ): Promise<void> {
    const page = this._pages.get(tabId);
    if (!page) {
      // No page exists for this tab, which shouldn't happen for subframes
      console.warn(`No page found for tab ${tabId} when handling subframe ${frameId}`);
      return;
    }

    try {
      const frameDetails = await chrome.webNavigation.getFrame({ tabId, frameId });
      if (frameDetails) {
        const parentFrameId = frameDetails.parentFrameId === -1 ? null : frameDetails.parentFrameId;
        page.frameManager.frameAttached(frameId, parentFrameId, url);
        const frame = page.frameManager.frame(frameId);
        if (frame) {
          frame.setUrl(url);
          frame._onClearLifecycle();
          // page.frameNavigatedToNewDocument(frame); // This line is removed to avoid duplication
        }
      }
    } catch (error) {
      // Ignore common navigation errors that don't need logging
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('getFrame') && !errorMessage.includes('Frame not found')) {
        console.warn(`Failed to get frame details for tab ${tabId}, frame ${frameId}:`, error);
      }
    }
  }

  private _createPage(tabId: number): Page {
    // Check if this BrowserWindow has been disposed to prevent memory leaks
    if (this._store.isDisposed) {
      // Return a dummy page or throw an error based on your preference
      throw new Error(`Cannot create page for tab ${tabId} - BrowserWindow has been disposed`);
    }

    const existingPage = this._pages.get(tabId);
    if (existingPage) {
      return existingPage;
    }

    const page = this._register(new Page(tabId, this.session));
    this._pages.set(tabId, page);

    // The main frame is attached via _fetchAllFramesForTab or navigation events.
    // No need to attach it here manually.

    return page;
  }

  pages(): Page[] {
    return Array.from(this._pages.values());
  }

  /**
   * Get the current active page
   * Returns the page for the currently active tab in this window
   */
  async getCurrentPage(): Promise<Page> {
    // Check if this BrowserWindow has been disposed
    if (this._store.isDisposed) {
      throw new Error('Cannot get current page - BrowserWindow has been disposed');
    }

    // Use cached active tab if available, otherwise query Chrome
    let activeTabId = this._activeTabId;

    if (!activeTabId) {
      // Fallback to querying Chrome if cache is not available
      const [activeTab] = await chrome.tabs.query({
        active: true,
        windowId: this.windowId,
      });

      if (!activeTab?.id) {
        throw new Error('No active tab found in side panel context - this should never happen');
      }

      activeTabId = activeTab.id;
      this._activeTabId = activeTabId; // Update cache
    }

    // Return the page for the active tab, creating one if it doesn't exist
    let page = this._pages.get(activeTabId);
    if (!page) {
      page = this._createPage(activeTabId);
      await this._fetchAllFramesForTab(page);
    }

    return page;
  }

  /**
   * Get the currently active tab ID in this window
   * Returns cached value if available, otherwise queries Chrome
   */
  async getActiveTabId(): Promise<number> {
    // Check if this BrowserWindow has been disposed
    if (this._store.isDisposed) {
      throw new Error('Cannot get active tab ID - BrowserWindow has been disposed');
    }

    // Use cached active tab if available, otherwise query Chrome
    if (this._activeTabId) {
      return this._activeTabId;
    }

    // Fallback to querying Chrome if cache is not available
    const [activeTab] = await chrome.tabs.query({
      active: true,
      windowId: this.windowId,
    });

    if (!activeTab?.id) {
      throw new Error('No active tab found in side panel context - this should never happen');
    }

    this._activeTabId = activeTab.id; // Update cache
    return activeTab.id;
  }

  async newPage(options: { timeout?: number; progress?: Progress } = {}): Promise<Page> {
    // Check if this BrowserWindow has been disposed
    if (this._store.isDisposed) {
      throw new Error('Cannot create new page - BrowserWindow has been disposed');
    }

    const progressController = new ProgressController(options.timeout ?? 30000);

    return progressController.run(async p => {
      p.log('Creating new tab');
      const tab = await chrome.tabs.create({ windowId: this.windowId });

      if (!tab.id) {
        throw new Error('Failed to create tab: tab.id is undefined');
      }

      const page = this._createPage(tab.id);

      p.log(`Tab ${tab.id} created, waiting for main frame`);
      await page.waitForMainFrame(p);
      p.log(`Page ready with main frame attached`);

      return page;
    });
  }

  /**
   * Sort frames by hierarchy to ensure parents are attached before children.
   * Main frame (parentFrameId = -1) comes first, then children in order of dependency.
   */
  private _sortFramesByHierarchy(
    frames: chrome.webNavigation.GetAllFrameResultDetails[]
  ): chrome.webNavigation.GetAllFrameResultDetails[] {
    const frameMap = new Map<number, chrome.webNavigation.GetAllFrameResultDetails>();
    const sortedFrames: chrome.webNavigation.GetAllFrameResultDetails[] = [];
    const processed = new Set<number>();

    // Create a map for quick lookup
    for (const frame of frames) {
      frameMap.set(frame.frameId, frame);
    }

    // Helper function to recursively add frames in hierarchy order
    const addFrame = (frameId: number): void => {
      if (processed.has(frameId)) {
        return;
      }

      const frame = frameMap.get(frameId);
      if (!frame) {
        return;
      }

      // If this frame has a parent, ensure parent is processed first
      if (frame.parentFrameId !== -1) {
        addFrame(frame.parentFrameId);
      }

      if (!processed.has(frameId)) {
        sortedFrames.push(frame);
        processed.add(frameId);
      }
    };

    // Start with all frames, addFrame will handle dependencies
    for (const frame of frames) {
      addFrame(frame.frameId);
    }

    return sortedFrames;
  }
}
