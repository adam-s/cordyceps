import { BrowserWindow } from '../../cordyceps/browserWindow';
import { Page } from '../../cordyceps/page';
import { ChromeExtensionStagehandPage } from './ChromeExtensionStagehandPage';
import { ChromeExtensionStagehand } from './index';

/**
 * Chrome Extension compatible StagehandContext implementation
 *
 * This version removes all Playwright dependencies and adapts to use
 * the Cordyceps browser automation system within a Chrome extension context.
 *
 * Key differences from the full StagehandContext:
 * - No CDP session management (Cordyceps handles browser communication)
 * - Uses BrowserWindow from Cordyceps instead of Playwright context
 * - No frame ID tracking (Cordyceps handles frame management)
 * - Simplified page management using chrome.tabs API
 * - No complex proxy system - direct integration with Cordyceps
 */
export class ChromeExtensionStagehandContext {
  private readonly stagehand: ChromeExtensionStagehand;
  private readonly browserWindow: BrowserWindow;
  private pageMap: WeakMap<Page, ChromeExtensionStagehandPage> = new WeakMap();
  private activeStagehandPage: ChromeExtensionStagehandPage | null = null;

  constructor(browserWindow: BrowserWindow, stagehand: ChromeExtensionStagehand) {
    console.log(
      `[ChromeExtensionStagehandContext.constructor] Initializing context with browserWindow ${browserWindow} and stagehand ${stagehand} ######`
    );
    this.stagehand = stagehand;
    this.browserWindow = browserWindow;
    console.log(
      `[ChromeExtensionStagehandContext.constructor] Context initialized successfully ######`
    );
  }

  /**
   * Initialize the context and set up page management
   */
  static async init(
    browserWindow: BrowserWindow,
    stagehand: ChromeExtensionStagehand
  ): Promise<ChromeExtensionStagehandContext> {
    console.log(
      `[ChromeExtensionStagehandContext.init] Starting initialization with browserWindow ${browserWindow} ######`
    );
    const instance = new ChromeExtensionStagehandContext(browserWindow, stagehand);

    try {
      console.log(
        `[ChromeExtensionStagehandContext.init] Getting current page from browser window ######`
      );
      // Get the current page from the browser window
      const currentPage = await browserWindow.getCurrentPage();
      console.log(
        `[ChromeExtensionStagehandContext.init] Current page retrieved: ${currentPage.url()} ######`
      );
      const stagehandPage = await instance.createStagehandPage(currentPage);
      console.log(
        `[ChromeExtensionStagehandContext.init] StagehandPage created successfully ######`
      );
      instance.setActivePage(stagehandPage);
      console.log(`[ChromeExtensionStagehandContext.init] Active page set successfully ######`);

      stagehand.log({
        category: 'context',
        message: 'ChromeExtensionStagehandContext initialized successfully',
        level: 1,
        auxiliary: {
          currentUrl: { value: currentPage.url(), type: 'string' },
        },
      });

      console.log(
        `[ChromeExtensionStagehandContext.init] Initialization completed successfully ######`
      );
      return instance;
    } catch (error) {
      console.log(
        `[ChromeExtensionStagehandContext.init] ERROR: Initialization failed ${error} ######`
      );
      const errorMessage = error instanceof Error ? error.message : String(error);
      stagehand.log({
        category: 'context',
        message: 'Failed to initialize ChromeExtensionStagehandContext',
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });
      throw error;
    }
  }

  /**
   * Get the browser window instance
   */
  public get context(): BrowserWindow {
    console.log(
      `[ChromeExtensionStagehandContext.context] Returning browser window ${this.browserWindow} ######`
    );
    return this.browserWindow;
  }

  /**
   * Create a new page (tab) in the browser
   */
  async newPage(): Promise<ChromeExtensionStagehandPage> {
    console.log(`[ChromeExtensionStagehandContext.newPage] Starting to create new page ######`);
    try {
      console.log(
        `[ChromeExtensionStagehandContext.newPage] Calling browserWindow.newPage() ######`
      );
      const page = await this.browserWindow.newPage();
      console.log(
        `[ChromeExtensionStagehandContext.newPage] New page created: ${page.url()} ######`
      );
      const stagehandPage = await this.createStagehandPage(page);
      console.log(`[ChromeExtensionStagehandContext.newPage] StagehandPage wrapper created ######`);
      this.setActivePage(stagehandPage);
      console.log(`[ChromeExtensionStagehandContext.newPage] Active page set ######`);

      this.stagehand.log({
        category: 'context',
        message: 'New page created successfully',
        level: 1,
        auxiliary: {
          url: { value: page.url(), type: 'string' },
        },
      });

      console.log(
        `[ChromeExtensionStagehandContext.newPage] New page creation completed successfully ######`
      );
      return stagehandPage;
    } catch (error) {
      console.log(
        `[ChromeExtensionStagehandContext.newPage] ERROR: Failed to create new page ${error} ######`
      );
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stagehand.log({
        category: 'context',
        message: 'Failed to create new page',
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });
      throw error;
    }
  }

  /**
   * Get all pages (tabs) in the browser
   */
  async pages(): Promise<ChromeExtensionStagehandPage[]> {
    console.log(
      `[ChromeExtensionStagehandContext.pages] Getting all pages from browser window ######`
    );
    try {
      const cordycepsPages = this.browserWindow.pages();
      console.log(
        `[ChromeExtensionStagehandContext.pages] Found ${cordycepsPages.length} Cordyceps pages ######`
      );
      const stagehandPages: ChromeExtensionStagehandPage[] = [];

      for (const page of cordycepsPages) {
        console.log(
          `[ChromeExtensionStagehandContext.pages] Processing page: ${page.url()} ######`
        );
        // Skip pages that are closed
        if (page.isClosed()) {
          console.log(
            `[ChromeExtensionStagehandContext.pages] Skipping closed page: ${page.url()} ######`
          );
          continue;
        }

        let stagehandPage = this.pageMap.get(page);
        if (!stagehandPage) {
          console.log(
            `[ChromeExtensionStagehandContext.pages] Creating new StagehandPage for: ${page.url()} ######`
          );
          stagehandPage = await this.createStagehandPage(page);
        } else {
          console.log(
            `[ChromeExtensionStagehandContext.pages] Using existing StagehandPage for: ${page.url()} ######`
          );
        }
        stagehandPages.push(stagehandPage);
      }

      console.log(
        `[ChromeExtensionStagehandContext.pages] Returning ${stagehandPages.length} StagehandPages ######`
      );
      return stagehandPages;
    } catch (error) {
      console.log(
        `[ChromeExtensionStagehandContext.pages] ERROR: Failed to get pages ${error} ######`
      );
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stagehand.log({
        category: 'context',
        message: 'Failed to get pages',
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });
      return [];
    }
  }

  /**
   * Get or create a StagehandPage for a Cordyceps Page
   */
  public async getStagehandPage(page: Page): Promise<ChromeExtensionStagehandPage> {
    console.log(
      `[ChromeExtensionStagehandContext.getStagehandPage] Getting StagehandPage for: ${page.url()} ######`
    );
    let stagehandPage = this.pageMap.get(page);
    if (!stagehandPage) {
      console.log(
        `[ChromeExtensionStagehandContext.getStagehandPage] Creating new StagehandPage for: ${page.url()} ######`
      );
      stagehandPage = await this.createStagehandPage(page);
    } else {
      console.log(
        `[ChromeExtensionStagehandContext.getStagehandPage] Using existing StagehandPage for: ${page.url()} ######`
      );
    }
    // Update active page when getting a page
    console.log(
      `[ChromeExtensionStagehandContext.getStagehandPage] Setting as active page: ${page.url()} ######`
    );
    this.setActivePage(stagehandPage);
    console.log(
      `[ChromeExtensionStagehandContext.getStagehandPage] Returning StagehandPage for: ${page.url()} ######`
    );
    return stagehandPage;
  }

  /**
   * Set the active page
   */
  public setActivePage(page: ChromeExtensionStagehandPage): void {
    console.log(
      `[ChromeExtensionStagehandContext.setActivePage] Setting active page to: ${page.page.url()} ######`
    );
    this.activeStagehandPage = page;

    this.stagehand.log({
      category: 'context',
      message: 'Active page changed',
      level: 2,
      auxiliary: {
        url: { value: page.page.url(), type: 'string' },
      },
    });
    console.log(
      `[ChromeExtensionStagehandContext.setActivePage] Active page set successfully ######`
    );
  }

  /**
   * Get the currently active page
   */
  public getActivePage(): ChromeExtensionStagehandPage | null {
    console.log(
      `[ChromeExtensionStagehandContext.getActivePage] Returning active page: ${this.activeStagehandPage?.page.url() || 'null'} ######`
    );
    return this.activeStagehandPage;
  }

  /**
   * Close a specific page
   */
  public async closePage(page: ChromeExtensionStagehandPage): Promise<void> {
    console.log(
      `[ChromeExtensionStagehandContext.closePage] Starting to close page: ${page.page.url()} ######`
    );
    try {
      console.log(
        `[ChromeExtensionStagehandContext.closePage] Disposing StagehandPage wrapper ######`
      );
      // First dispose the StagehandPage wrapper
      await page.dispose();
      console.log(`[ChromeExtensionStagehandContext.closePage] Removing page from pageMap ######`);
      this.pageMap.delete(page.page);

      // If this was the active page, clear the reference
      if (this.activeStagehandPage === page) {
        console.log(
          `[ChromeExtensionStagehandContext.closePage] Clearing active page reference ######`
        );
        this.activeStagehandPage = null;
      }

      // Actually close the browser tab to remove it from the BrowserWindow
      try {
        console.log(
          `[ChromeExtensionStagehandContext.closePage] Closing browser tab ${page.page.tabId} ######`
        );
        await chrome.tabs.remove(page.page.tabId);
        this.stagehand.log({
          category: 'context',
          message: 'Tab closed successfully',
          level: 2,
          auxiliary: {
            tabId: { value: String(page.page.tabId), type: 'string' },
          },
        });
      } catch (tabError) {
        console.log(
          `[ChromeExtensionStagehandContext.closePage] WARNING: Tab close failed ${tabError} ######`
        );
        // Tab might already be closed or inaccessible
        this.stagehand.log({
          category: 'context',
          message: 'Tab close failed but StagehandPage disposed',
          level: 1,
          auxiliary: {
            tabId: { value: String(page.page.tabId), type: 'string' },
            error: { value: String(tabError), type: 'string' },
          },
        });
      }

      this.stagehand.log({
        category: 'context',
        message: 'Page closed successfully',
        level: 1,
      });
      console.log(`[ChromeExtensionStagehandContext.closePage] Page closed successfully ######`);
    } catch (error) {
      console.log(
        `[ChromeExtensionStagehandContext.closePage] ERROR: Failed to close page ${error} ######`
      );
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stagehand.log({
        category: 'context',
        message: 'Failed to close page',
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });
      throw error;
    }
  }

  /**
   * Clean up the context and all its pages
   */
  public async dispose(): Promise<void> {
    console.log(`[ChromeExtensionStagehandContext.dispose] Starting context disposal ######`);
    try {
      console.log(`[ChromeExtensionStagehandContext.dispose] Getting all pages to dispose ######`);
      // Dispose all pages
      const pages = await this.pages();
      console.log(
        `[ChromeExtensionStagehandContext.dispose] Disposing ${pages.length} pages ######`
      );
      await Promise.all(
        pages.map(page =>
          page.dispose().catch(() => {
            console.log(
              `[ChromeExtensionStagehandContext.dispose] WARNING: Failed to dispose page ${page.page.url()} ######`
            );
            // Ignore individual page disposal errors
          })
        )
      );

      console.log(`[ChromeExtensionStagehandContext.dispose] Clearing references ######`);
      // Clear references
      this.pageMap = new WeakMap();
      this.activeStagehandPage = null;

      this.stagehand.log({
        category: 'context',
        message: 'ChromeExtensionStagehandContext disposed successfully',
        level: 1,
      });
      console.log(`[ChromeExtensionStagehandContext.dispose] Context disposed successfully ######`);
    } catch (error) {
      console.log(
        `[ChromeExtensionStagehandContext.dispose] ERROR: Failed to dispose context ${error} ######`
      );
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stagehand.log({
        category: 'context',
        message: 'Failed to dispose context',
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });
    }
  }

  /**
   * Create a StagehandPage wrapper for a Cordyceps Page
   */
  private async createStagehandPage(page: Page): Promise<ChromeExtensionStagehandPage> {
    console.log(
      `[ChromeExtensionStagehandContext.createStagehandPage] Creating StagehandPage for: ${page.url()} ######`
    );
    const stagehandPage = new ChromeExtensionStagehandPage(
      page,
      this.stagehand,
      this.stagehand.llmClient,
      this.stagehand.userProvidedInstructions
    );

    console.log(
      `[ChromeExtensionStagehandContext.createStagehandPage] Initializing StagehandPage ######`
    );
    await stagehandPage.init();
    console.log(`[ChromeExtensionStagehandContext.createStagehandPage] Adding to pageMap ######`);
    this.pageMap.set(page, stagehandPage);

    this.stagehand.log({
      category: 'context',
      message: 'StagehandPage created successfully',
      level: 2,
      auxiliary: {
        url: { value: page.url(), type: 'string' },
      },
    });

    console.log(
      `[ChromeExtensionStagehandContext.createStagehandPage] StagehandPage created successfully for: ${page.url()} ######`
    );
    return stagehandPage;
  }
}
