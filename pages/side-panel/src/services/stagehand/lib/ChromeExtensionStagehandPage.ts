import { Page } from '../../cordyceps/page';
import { LLMClient } from './llm/LLMClient';
import { ChromeExtensionStagehand } from './index';
import { NavigateOptionsWithProgress } from '../../cordyceps/utilities/types';
import {
  ActOptions,
  ActResult,
  ObserveOptions,
  ObserveResult,
  ExtractOptions,
  ExtractResult,
} from '../types/stagehand';
import { StagehandActHandler } from './handlers/actHandler';
import { StagehandExtractHandler } from './handlers/extractHandler';
import { StagehandObserveHandler } from './handlers/observeHandler';
import { z } from 'zod/v3';
import {
  StagehandError,
  StagehandNotInitializedError,
  MissingLLMConfigurationError,
  HandlerNotInitializedError,
  StagehandDefaultError,
} from '../types/stagehandErrors';

// Define a simple extract schema for when none is provided
const defaultExtractSchema = z.object({
  data: z.any(),
});

/**
 * Extended window interface for Stagehand script injection
 */
declare global {
  interface Window {
    __stagehandInjected?: boolean;
    __stagehandHelpers?: {
      getElementText: (element: Element) => string;
      isElementVisible: (element: Element) => boolean;
      highlightElement: (element: Element, color?: string) => void;
      removeHighlights: () => void;
    };
  }
}

/**
 * Clear visual overlays from the page
 */
async function clearOverlays(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const overlays = document.querySelectorAll('[data-stagehand-overlay]');
      overlays.forEach(overlay => overlay.remove());
    });
  } catch (error) {
    // Silently fail if overlay clearing fails
    console.warn('Failed to clear overlays:', error);
  }
}

/**
 * Enhanced page interface that combines Cordyceps Page with Stagehand AI methods
 * This creates the same API surface as the original Stagehand which combined Playwright + AI
 */
export interface EnhancedCordycepsPage extends Page {
  act(actionOrOptions: string | ActOptions | ObserveResult): Promise<ActResult>;
  extract<T extends z.AnyZodObject = typeof defaultExtractSchema>(
    instructionOrOptions?: string | ExtractOptions<T>
  ): Promise<ExtractResult<T>>;
  observe(instructionOrOptions?: string | ObserveOptions): Promise<ObserveResult[]>;
}

/**
 * Chrome Extension compatible StagehandPage implementation
 *
 * This version removes all Playwright/Node.js dependencies and adapts to use
 * the Cordyceps browser automation system within a Chrome extension context.
 *
 * Key differences from the full StagehandPage:
 * - No CDP session management (Cordyceps handles browser communication)
 * - Uses Cordyceps Page proxy system instead of Playwright
 * - No Playwright selector engine registration
 * - Simplified script injection using Cordyceps
 * - Simplified network monitoring using Cordyceps load states
 * - No Browserbase-specific features (captcha handling, etc.)
 */
export class ChromeExtensionStagehandPage {
  // Core browser integration
  private rawPage: Page;
  private _enhancedPage!: EnhancedCordycepsPage;

  // Parent Stagehand instance
  private stagehand: ChromeExtensionStagehand;

  // AI/LLM functionality (keep - this is the valuable part)
  private actHandler?: StagehandActHandler;
  private extractHandler?: StagehandExtractHandler;
  private observeHandler?: StagehandObserveHandler;
  private llmClient: LLMClient;
  private userProvidedInstructions?: string;

  // State tracking
  private initialized: boolean = false;

  constructor(
    page: Page,
    stagehand: ChromeExtensionStagehand,
    llmClient: LLMClient,
    userProvidedInstructions?: string
  ) {
    console.log(
      `[ChromeExtensionStagehandPage.constructor] Initializing with page: ${page.url()} ######`
    );
    this.rawPage = page;
    this.stagehand = stagehand;
    this.llmClient = llmClient;
    this.userProvidedInstructions = userProvidedInstructions;

    console.log(`[ChromeExtensionStagehandPage.constructor] Creating enhanced page proxy ######`);
    // Create the enhanced page proxy that combines Cordyceps Page + Stagehand AI methods
    this.createEnhancedPageProxy();
    console.log(`[ChromeExtensionStagehandPage.constructor] Constructor completed ######`);
  }

  /**
   * Create a proxy that enhances the Cordyceps Page with Stagehand AI methods
   * This mimics the original Playwright proxy pattern but for Cordyceps
   */
  private createEnhancedPageProxy(): void {
    console.log(
      `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Creating enhanced page proxy ######`
    );
    this._enhancedPage = new Proxy(this.rawPage, {
      get: (target: Page, prop: string | symbol) => {
        console.log(
          `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Proxy get called for property: ${String(prop)} ######`
        );
        // Special handling for Stagehand AI methods before initialization
        if (!this.initialized && (prop === 'act' || prop === 'extract' || prop === 'observe')) {
          console.log(
            `[ChromeExtensionStagehandPage.createEnhancedPageProxy] ERROR: Method ${String(prop)} called before initialization ######`
          );
          throw new StagehandNotInitializedError(
            'ChromeExtensionStagehandPage not initialized. Call init() first.'
          );
        }

        // Handle Stagehand AI methods
        if (prop === 'act') {
          console.log(
            `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Returning act method ######`
          );
          return this.act.bind(this);
        }
        if (prop === 'extract') {
          console.log(
            `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Returning extract method ######`
          );
          return this.extract.bind(this);
        }
        if (prop === 'observe') {
          console.log(
            `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Returning observe method ######`
          );
          return this.observe.bind(this);
        }

        // Handle special method interception for script injection
        if (
          prop === 'evaluate' ||
          prop === 'evaluateHandle' ||
          prop === '$eval' ||
          prop === '$$eval'
        ) {
          console.log(
            `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Intercepting ${String(prop)} method for script injection ######`
          );
          return async (...args: unknown[]) => {
            console.log(
              `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Ensuring Stagehand script before ${String(prop)} ######`
            );
            await this.ensureStagehandScript();
            console.log(
              `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Calling original ${String(prop)} method ######`
            );
            return (target[prop as keyof Page] as (...args: unknown[]) => unknown).apply(
              target,
              args
            );
          };
        }

        // Handle goto specially to clear overlays and inject scripts
        if (prop === 'goto') {
          console.log(
            `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Intercepting goto method ######`
          );
          return async (url: string, options?: NavigateOptionsWithProgress) => {
            console.log(
              `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Navigating to: ${url} ######`
            );
            // Clear overlays before navigation
            await clearOverlays(target).catch(() => {
              console.log(
                `[ChromeExtensionStagehandPage.createEnhancedPageProxy] WARNING: Failed to clear overlays before navigation ######`
              );
              // Ignore errors when clearing overlays
            });

            console.log(
              `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Performing navigation ######`
            );
            // Perform navigation with proper typing
            const result = await target.goto(url, options);

            console.log(
              `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Injecting scripts after navigation ######`
            );
            // Inject scripts after navigation
            await this.ensureStagehandScript().catch(() => {
              console.log(
                `[ChromeExtensionStagehandPage.createEnhancedPageProxy] WARNING: Failed to inject scripts after navigation ######`
              );
              // Ignore script injection errors for now
            });

            console.log(
              `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Navigation and script injection completed ######`
            );
            return result;
          };
        }

        // For all other properties and methods, delegate to the original page
        console.log(
          `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Delegating property ${String(prop)} to original page ######`
        );
        const value = target[prop as keyof Page];

        // If it's a function, bind it to the original target
        if (typeof value === 'function') {
          console.log(
            `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Binding function ${String(prop)} to target ######`
          );
          return value.bind(target);
        }

        console.log(
          `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Returning property ${String(prop)} value ######`
        );
        return value;
      },
    }) as EnhancedCordycepsPage;
    console.log(
      `[ChromeExtensionStagehandPage.createEnhancedPageProxy] Enhanced page proxy created successfully ######`
    );
  }

  /**
   * Simplified script injection for Chrome extension using Cordyceps
   * Replaces the complex Playwright script injection system
   */
  private async ensureStagehandScript(): Promise<void> {
    console.log(
      `[ChromeExtensionStagehandPage.ensureStagehandScript] Starting script injection ######`
    );
    try {
      // Check if we're on a restricted URL (chrome://, about:, etc.)
      const currentUrl = this.rawPage.url();
      console.log(
        `[ChromeExtensionStagehandPage.ensureStagehandScript] Current URL: ${currentUrl} ######`
      );
      if (
        currentUrl.startsWith('chrome://') ||
        currentUrl.startsWith('about:') ||
        currentUrl.startsWith('chrome-extension://') ||
        currentUrl.startsWith('moz-extension://')
      ) {
        console.log(
          `[ChromeExtensionStagehandPage.ensureStagehandScript] Skipping injection on restricted URL ######`
        );
        this.stagehand.log({
          category: 'dom',
          message: 'Skipping script injection on restricted URL',
          level: 2,
          auxiliary: {
            url: { value: currentUrl, type: 'string' },
          },
        });
        return;
      }

      console.log(
        `[ChromeExtensionStagehandPage.ensureStagehandScript] Checking if scripts already injected ######`
      );
      // Check if our helper scripts are already injected
      const injected = await this.rawPage.evaluate(() => {
        return window.__stagehandInjected === true;
      });

      if (injected) {
        console.log(
          `[ChromeExtensionStagehandPage.ensureStagehandScript] Scripts already injected, skipping ######`
        );
        return;
      }

      console.log(
        `[ChromeExtensionStagehandPage.ensureStagehandScript] Injecting helper scripts ######`
      );
      // Inject basic helper scripts using Cordyceps evaluate
      await this.rawPage.evaluate(() => {
        // Mark as injected
        window.__stagehandInjected = true;

        // Basic helper functions for Stagehand
        window.__stagehandHelpers = {
          getElementText: (element: Element): string => {
            return element.textContent?.trim() || '';
          },

          isElementVisible: (element: Element): boolean => {
            const htmlElement = element as HTMLElement;
            const style = window.getComputedStyle(element);
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              htmlElement.offsetWidth > 0 &&
              htmlElement.offsetHeight > 0
            );
          },

          highlightElement: (element: Element, color = '#ff0000'): void => {
            const highlight = document.createElement('div');
            highlight.setAttribute('data-stagehand-overlay', 'true');
            highlight.style.position = 'absolute';
            highlight.style.border = `2px solid ${color}`;
            highlight.style.backgroundColor = `${color}20`;
            highlight.style.pointerEvents = 'none';
            highlight.style.zIndex = '999999';

            const rect = element.getBoundingClientRect();
            highlight.style.left = `${rect.left + window.scrollX}px`;
            highlight.style.top = `${rect.top + window.scrollY}px`;
            highlight.style.width = `${rect.width}px`;
            highlight.style.height = `${rect.height}px`;

            document.body.appendChild(highlight);
          },

          removeHighlights: (): void => {
            const overlays = document.querySelectorAll('[data-stagehand-overlay]');
            overlays.forEach(overlay => overlay.remove());
          },
        };
      });

      console.log(
        `[ChromeExtensionStagehandPage.ensureStagehandScript] Scripts injected successfully ######`
      );
      this.stagehand.log({
        category: 'dom',
        message: 'Stagehand helper scripts injected successfully',
        level: 2,
      });
    } catch (err) {
      console.log(
        `[ChromeExtensionStagehandPage.ensureStagehandScript] ERROR: Script injection failed ${err} ######`
      );
      this.stagehand.log({
        category: 'dom',
        message: 'Failed to inject Stagehand helper script',
        level: 1,
        auxiliary: {
          error: { value: (err as Error).message, type: 'string' },
        },
      });

      // Don't throw the error - this is expected on restricted URLs
      // Just log it and continue
      const currentUrl = this.rawPage.url();
      if (
        currentUrl.startsWith('chrome://') ||
        currentUrl.startsWith('about:') ||
        currentUrl.startsWith('chrome-extension://') ||
        currentUrl.startsWith('moz-extension://')
      ) {
        console.log(
          `[ChromeExtensionStagehandPage.ensureStagehandScript] Script injection failed on restricted URL (expected) ######`
        );
        this.stagehand.log({
          category: 'dom',
          message: 'Script injection failed on restricted URL (expected)',
          level: 2,
          auxiliary: {
            url: { value: currentUrl, type: 'string' },
          },
        });
        return; // Don't throw for restricted URLs
      }

      throw err;
    }
  }

  /**
   * Simplified DOM settling using Cordyceps load states
   * Replaces the complex CDP-based network monitoring
   */
  public async _waitForSettledDom(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this.stagehand.domSettleTimeoutMs;
    console.log(
      `[ChromeExtensionStagehandPage._waitForSettledDom] Waiting for DOM to settle, timeout: ${timeout}ms ######`
    );

    this.stagehand.log({
      category: 'dom',
      message: 'Waiting for DOM to settle',
      level: 2,
      auxiliary: {
        timeout: { value: String(timeout), type: 'string' },
      },
    });

    try {
      console.log(
        `[ChromeExtensionStagehandPage._waitForSettledDom] Waiting for domcontentloaded ######`
      );
      // First wait for basic DOM content to load
      await this.rawPage.waitForLoadState('domcontentloaded');

      console.log(
        `[ChromeExtensionStagehandPage._waitForSettledDom] Waiting for networkidle ######`
      );
      // Then wait for network to be idle (simpler than CDP monitoring)
      await this.rawPage.waitForLoadState('networkidle');

      console.log(
        `[ChromeExtensionStagehandPage._waitForSettledDom] DOM settled successfully ######`
      );
      this.stagehand.log({
        category: 'dom',
        message: 'DOM settled successfully using Cordyceps',
        level: 2,
      });
    } catch (error) {
      console.log(
        `[ChromeExtensionStagehandPage._waitForSettledDom] ERROR: DOM settling failed ${error} ######`
      );
      this.stagehand.log({
        category: 'dom',
        message: 'DOM settling timed out or failed',
        level: 1,
        auxiliary: {
          error: { value: (error as Error).message, type: 'string' },
          timeout: { value: String(timeout), type: 'string' },
        },
      });
      // Don't throw - continue with best effort
    }
  }

  /**
   * Initialize the Chrome extension StagehandPage
   * Much simpler than the Playwright version
   */
  async init(): Promise<ChromeExtensionStagehandPage> {
    console.log(
      `[ChromeExtensionStagehandPage.init] Starting initialization for page: ${this.rawPage.url()} ######`
    );
    try {
      this.stagehand.log({
        category: 'init',
        message: 'Initializing Chrome extension StagehandPage',
        level: 1,
      });

      console.log(`[ChromeExtensionStagehandPage.init] Initializing ActHandler ######`);
      // Initialize handlers with the browser window
      this.actHandler = new StagehandActHandler({
        logger: this.stagehand.logger,
        browserWindow: this.stagehand.browserWindow,
        selfHeal: this.stagehand.selfHeal,
        experimental: this.stagehand.experimental,
      });

      console.log(`[ChromeExtensionStagehandPage.init] Initializing ExtractHandler ######`);
      this.extractHandler = new StagehandExtractHandler({
        stagehand: this.stagehand,
        logger: message =>
          this.stagehand.log({
            category: message.category,
            message: message.message,
            level: (message.level === undefined ? 1 : Math.min(2, Math.max(0, message.level))) as
              | 0
              | 1
              | 2,
            auxiliary: message.auxiliary as
              | {
                  [key: string]: {
                    value: string;
                    type: 'object' | 'string' | 'html' | 'integer' | 'float' | 'boolean';
                  };
                }
              | undefined,
          }),
        browserWindow: this.stagehand.browserWindow,
        userProvidedInstructions: this.userProvidedInstructions,
        experimental: this.stagehand.experimental,
      });

      console.log(`[ChromeExtensionStagehandPage.init] Initializing ObserveHandler ######`);
      this.observeHandler = new StagehandObserveHandler({
        stagehand: this.stagehand,
        logger: this.stagehand.logger,
        browserWindow: this.stagehand.browserWindow,
        userProvidedInstructions: this.userProvidedInstructions,
        experimental: this.stagehand.experimental,
      });

      console.log(`[ChromeExtensionStagehandPage.init] Injecting helper scripts ######`);
      // Inject our helper scripts
      await this.ensureStagehandScript();

      console.log(`[ChromeExtensionStagehandPage.init] Setting initialized flag ######`);
      this.initialized = true;

      this.stagehand.log({
        category: 'init',
        message: 'Chrome extension StagehandPage initialized successfully',
        level: 1,
        auxiliary: {
          url: { value: this.rawPage.url(), type: 'string' },
        },
      });

      console.log(
        `[ChromeExtensionStagehandPage.init] Initialization completed successfully ######`
      );
      return this;
    } catch (err: unknown) {
      console.log(`[ChromeExtensionStagehandPage.init] ERROR: Initialization failed ${err} ######`);
      this.stagehand.log({
        category: 'init',
        message: 'Failed to initialize Chrome extension StagehandPage',
        level: 0,
        auxiliary: {
          error: { value: (err as Error).message, type: 'string' },
        },
      });

      if (err instanceof StagehandError) {
        throw err;
      }
      throw new StagehandDefaultError(err);
    }
  }

  /**
   * Get the underlying Cordyceps page
   * Provides compatibility with the original Stagehand API
   */
  public get page(): Page {
    console.log(
      `[ChromeExtensionStagehandPage.page] Returning raw page: ${this.rawPage.url()} ######`
    );
    return this.rawPage;
  }

  /**
   * Get the enhanced page that includes both Cordyceps methods and Stagehand AI methods
   * This is what users should primarily interact with
   */
  public get enhancedPage(): EnhancedCordycepsPage {
    console.log(
      `[ChromeExtensionStagehandPage.enhancedPage] Returning enhanced page: ${this.rawPage.url()} ######`
    );
    return this._enhancedPage;
  }

  /**
   * Perform an action on the page using AI
   * Core Stagehand functionality - adapted for Cordyceps
   */
  async act(actionOrOptions: string | ActOptions | ObserveResult): Promise<ActResult> {
    console.log(
      `[ChromeExtensionStagehandPage.act] Starting act with: ${typeof actionOrOptions === 'string' ? actionOrOptions : JSON.stringify(actionOrOptions)} ######`
    );
    try {
      if (!this.initialized) {
        console.log(`[ChromeExtensionStagehandPage.act] ERROR: Not initialized ######`);
        throw new StagehandNotInitializedError(
          'ChromeExtensionStagehandPage not initialized. Call init() first.'
        );
      }

      if (!this.actHandler || !this.observeHandler) {
        console.log(`[ChromeExtensionStagehandPage.act] ERROR: Handlers not initialized ######`);
        throw new HandlerNotInitializedError('Act or observe handler not initialized');
      }

      if (!this.llmClient) {
        console.log(`[ChromeExtensionStagehandPage.act] ERROR: LLM client not configured ######`);
        throw new MissingLLMConfigurationError();
      }

      console.log(`[ChromeExtensionStagehandPage.act] Clearing visual overlays ######`);
      // Clear any existing visual overlays
      await clearOverlays(this.page);

      // Handle ObserveResult input (direct action from observe result)
      if (
        typeof actionOrOptions === 'object' &&
        actionOrOptions !== null &&
        'selector' in actionOrOptions
      ) {
        console.log(`[ChromeExtensionStagehandPage.act] Acting from ObserveResult ######`);
        return await this.actHandler.actFromObserveResult(actionOrOptions);
      }

      console.log(`[ChromeExtensionStagehandPage.act] Converting to ActOptions ######`);
      // Convert string to ActOptions if needed
      const actOptions: ActOptions =
        typeof actionOrOptions === 'string' ? { action: actionOrOptions } : actionOrOptions;

      // Generate a request ID for tracking
      const requestId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[ChromeExtensionStagehandPage.act] Generated request ID: ${requestId} ######`);

      console.log(`[ChromeExtensionStagehandPage.act] Calling actHandler.observeAct ######`);
      return await this.actHandler.observeAct(
        actOptions,
        this.observeHandler,
        this.llmClient,
        requestId
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`[ChromeExtensionStagehandPage.act] ERROR: Action failed ${errorMessage} ######`);

      this.stagehand.log({
        category: 'act',
        message: `Failed to execute action: ${errorMessage}`,
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      if (err instanceof StagehandError) {
        throw err;
      }

      console.log(`[ChromeExtensionStagehandPage.act] Returning error result ######`);
      return {
        success: false,
        message: errorMessage,
        action: typeof actionOrOptions === 'string' ? actionOrOptions : 'unknown',
      };
    }
  }

  /**
   * Extract data from the page using AI
   * Core Stagehand functionality - adapted for Cordyceps
   */
  async extract<T extends z.AnyZodObject = typeof defaultExtractSchema>(
    instructionOrOptions?: string | ExtractOptions<T>
  ): Promise<ExtractResult<T>> {
    console.log(
      `[ChromeExtensionStagehandPage.extract] Starting extract with: ${typeof instructionOrOptions === 'string' ? instructionOrOptions : JSON.stringify(instructionOrOptions)} ######`
    );
    try {
      if (!this.initialized) {
        console.log(`[ChromeExtensionStagehandPage.extract] ERROR: Not initialized ######`);
        throw new StagehandNotInitializedError(
          'ChromeExtensionStagehandPage not initialized. Call init() first.'
        );
      }

      if (!this.extractHandler) {
        console.log(
          `[ChromeExtensionStagehandPage.extract] ERROR: Extract handler not initialized ######`
        );
        throw new HandlerNotInitializedError('Extract handler not initialized');
      }

      console.log(`[ChromeExtensionStagehandPage.extract] Converting to ExtractOptions ######`);
      const options =
        typeof instructionOrOptions === 'string'
          ? { instruction: instructionOrOptions }
          : instructionOrOptions || {};

      console.log(`[ChromeExtensionStagehandPage.extract] Calling extractHandler.extract ######`);
      // Convert ExtractOptions to the format expected by extractHandler
      const extractHandlerOptions = {
        instruction: options.instruction,
        schema: options.schema,
        domSettleTimeoutMs: options.domSettleTimeoutMs,
        useTextExtract: options.useTextExtract,
        selector: options.selector,
        iframes: options.iframes,
        llmClient: this.stagehand.llmClient,
      } as Parameters<typeof this.extractHandler.extract>[0];

      return await this.extractHandler.extract(extractHandlerOptions);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(
        `[ChromeExtensionStagehandPage.extract] ERROR: Extract failed ${errorMessage} ######`
      );

      this.stagehand.log({
        category: 'extract',
        message: `Failed to extract data: ${errorMessage}`,
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      if (err instanceof StagehandError) {
        throw err;
      }
      throw new StagehandDefaultError(err);
    }
  }

  /**
   * Observe elements on the page using AI
   * Core Stagehand functionality - adapted for Cordyceps
   */
  async observe(instructionOrOptions?: string | ObserveOptions): Promise<ObserveResult[]> {
    console.log(
      `[ChromeExtensionStagehandPage.observe] Starting observe with: ${typeof instructionOrOptions === 'string' ? instructionOrOptions : JSON.stringify(instructionOrOptions)} ######`
    );
    try {
      if (!this.initialized) {
        console.log(`[ChromeExtensionStagehandPage.observe] ERROR: Not initialized ######`);
        throw new StagehandNotInitializedError(
          'ChromeExtensionStagehandPage not initialized. Call init() first.'
        );
      }

      if (!this.observeHandler) {
        console.log(
          `[ChromeExtensionStagehandPage.observe] ERROR: Observe handler not initialized ######`
        );
        throw new HandlerNotInitializedError('Observe handler not initialized');
      }

      // Generate a request ID for tracking
      const requestId = `observe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(
        `[ChromeExtensionStagehandPage.observe] Generated request ID: ${requestId} ######`
      );

      // Extract instruction and options
      let instruction: string;
      let options: Partial<ObserveOptions> = {};

      console.log(`[ChromeExtensionStagehandPage.observe] Parsing instruction and options ######`);
      if (typeof instructionOrOptions === 'string') {
        instruction = instructionOrOptions;
        console.log(
          `[ChromeExtensionStagehandPage.observe] Using string instruction: ${instruction} ######`
        );
      } else if (
        instructionOrOptions &&
        'instruction' in instructionOrOptions &&
        instructionOrOptions.instruction
      ) {
        instruction = instructionOrOptions.instruction;
        options = instructionOrOptions;
        console.log(
          `[ChromeExtensionStagehandPage.observe] Using object instruction: ${instruction} ######`
        );
      } else {
        instruction = 'Find elements that can be used for any future actions in the page.';
        console.log(`[ChromeExtensionStagehandPage.observe] Using default instruction ######`);
      }

      console.log(`[ChromeExtensionStagehandPage.observe] Calling observeHandler.observe ######`);
      return await this.observeHandler.observe({
        instruction,
        llmClient: this.llmClient,
        requestId,
        domSettleTimeoutMs: this.stagehand.domSettleTimeoutMs,
        returnAction: options.returnAction,
        onlyVisible: options.onlyVisible,
        drawOverlay: options.drawOverlay,
        fromAct: false, // This is called from observe method, not act
        iframes: options.iframes,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(
        `[ChromeExtensionStagehandPage.observe] ERROR: Observe failed ${errorMessage} ######`
      );

      this.stagehand.log({
        category: 'observe',
        message: `Failed to observe page: ${errorMessage}`,
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      if (err instanceof StagehandError) {
        throw err;
      }

      console.log(`[ChromeExtensionStagehandPage.observe] Returning empty array on error ######`);
      // Return empty array on error for observe
      return [];
    }
  }

  /**
   * Clean up resources when the page is disposed
   */
  async dispose(): Promise<void> {
    console.log(
      `[ChromeExtensionStagehandPage.dispose] Starting disposal for page: ${this.rawPage.url()} ######`
    );
    this.stagehand.log({
      category: 'dispose',
      message: 'Disposing Chrome extension StagehandPage',
      level: 1,
    });

    console.log(`[ChromeExtensionStagehandPage.dispose] Clearing visual overlays ######`);
    // Clean up visual overlays
    await clearOverlays(this.page).catch(() => {
      console.log(
        `[ChromeExtensionStagehandPage.dispose] WARNING: Failed to clear overlays ######`
      );
      // Ignore cleanup errors
    });

    console.log(`[ChromeExtensionStagehandPage.dispose] Cleaning up extract handler ######`);
    // Clean up handlers
    if (this.extractHandler) {
      try {
        await this.extractHandler.clearExtractionOverlays();
      } catch (error) {
        console.log(
          `[ChromeExtensionStagehandPage.dispose] WARNING: Failed to clear extraction overlays ${error} ######`
        );
        // Ignore cleanup errors
      }
    }

    console.log(`[ChromeExtensionStagehandPage.dispose] Cleaning up observe handler ######`);
    if (this.observeHandler) {
      try {
        await this.observeHandler.clearObserveOverlays();
      } catch (error) {
        console.log(
          `[ChromeExtensionStagehandPage.dispose] WARNING: Failed to clear observe overlays ${error} ######`
        );
        // Ignore cleanup errors
      }
    }

    console.log(`[ChromeExtensionStagehandPage.dispose] Clearing initialization flag ######`);
    // Clear initialization flag
    this.initialized = false;

    this.stagehand.log({
      category: 'dispose',
      message: 'Chrome extension StagehandPage disposed successfully',
      level: 1,
    });
    console.log(`[ChromeExtensionStagehandPage.dispose] Disposal completed successfully ######`);
  }
}

// Export alias for compatibility with existing handlers
export { ChromeExtensionStagehandPage as StagehandPage };
