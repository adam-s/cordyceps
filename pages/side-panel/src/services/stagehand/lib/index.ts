import { BrowserWindow } from '../../cordyceps/browserWindow';
import { Page } from '../../cordyceps/page';
import { LogLine } from '../types/log';
import { AvailableModel, ClientOptions } from '../types/model';
import { LLMClient } from './llm/LLMClient';
import { LLMProvider } from './llm/LLMProvider';
import { StagehandLogger } from './logger';
import {
  StagehandMetrics,
  StagehandFunctionName,
  HistoryEntry,
  ActOptions,
  ActResult,
  ObserveOptions,
  ObserveResult,
  ExtractOptions,
  ExtractResult,
} from '../types/stagehand';
import { AgentOptions, AgentExecuteOptions, AgentResult, AgentAction } from '../types/agent';
import { z } from 'zod/v3';
import { executeWithProgress } from '../../cordyceps/core/progress';
import type { Locator } from '../../cordyceps/locator';
import { StagehandActHandler } from './handlers/actHandler';
import { StagehandExtractHandler } from './handlers/extractHandler';
import { StagehandObserveHandler } from './handlers/observeHandler';

/**
 * Simple wrapper for Cordyceps Page to provide Stagehand-compatible interface
 */
class ChromeExtensionStagehandPage {
  private actHandler: StagehandActHandler | null = null;
  private extractHandler: StagehandExtractHandler | null = null;
  private observeHandler: StagehandObserveHandler | null = null;

  constructor(
    public readonly page: Page,
    private readonly stagehand: ChromeExtensionStagehand,
    private readonly llmClient: LLMClient,
    private readonly userProvidedInstructions?: string
  ) {}

  async init(): Promise<ChromeExtensionStagehandPage> {
    // Initialize handlers with the Cordyceps browser window

    this.actHandler = new StagehandActHandler({
      logger: this.stagehand.logger,
      browserWindow: this.stagehand.browserWindow,
      selfHeal: this.stagehand.selfHeal,
      experimental: this.stagehand.experimental,
    });

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

    this.observeHandler = new StagehandObserveHandler({
      stagehand: this.stagehand,
      logger: this.stagehand.logger,
      browserWindow: this.stagehand.browserWindow,
      userProvidedInstructions: this.userProvidedInstructions,
      experimental: this.stagehand.experimental,
    });

    return this;
  }

  /**
   * Perform an action on the page using AI
   */
  async act(actionOrOptions: string | ActOptions | ObserveResult): Promise<ActResult> {
    if (!this.actHandler || !this.observeHandler) {
      throw new Error('ChromeExtensionStagehandPage not initialized. Call init() first.');
    }

    this.stagehand.log({
      category: 'act',
      message: 'Executing action using ChromeExtensionStagehandPage',
      level: 1,
      auxiliary: {
        action: {
          value: typeof actionOrOptions === 'string' ? actionOrOptions : 'object',
          type: 'string',
        },
      },
    });

    try {
      // If it's an ObserveResult, use actFromObserveResult
      if (typeof actionOrOptions === 'object' && 'selector' in actionOrOptions) {
        return await this.actHandler.actFromObserveResult(actionOrOptions);
      }

      // Convert string to ActOptions if needed
      const actOptions: ActOptions =
        typeof actionOrOptions === 'string' ? { action: actionOrOptions } : actionOrOptions;

      // Generate a request ID for tracking
      const requestId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return await this.actHandler.observeAct(
        actOptions,
        this.observeHandler,
        this.llmClient,
        requestId
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.stagehand.log({
        category: 'act',
        message: `Failed to execute action: ${errorMessage}`,
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      return {
        success: false,
        message: errorMessage,
        action: typeof actionOrOptions === 'string' ? actionOrOptions : 'unknown',
      };
    }
  }

  /**
   * Observe elements on the page using AI
   */
  async observe(instructionOrOptions?: string | ObserveOptions): Promise<ObserveResult[]> {
    if (!this.observeHandler) {
      throw new Error('ChromeExtensionStagehandPage not initialized. Call init() first.');
    }

    this.stagehand.log({
      category: 'observe',
      message: 'Observing page using ChromeExtensionStagehandPage',
      level: 1,
      auxiliary: {
        instruction: {
          value: typeof instructionOrOptions === 'string' ? instructionOrOptions : 'object',
          type: 'string',
        },
      },
    });

    try {
      // Generate a request ID for tracking
      const requestId = `observe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Extract instruction and options
      let instruction: string;
      let options: Partial<ObserveOptions> = {};

      if (typeof instructionOrOptions === 'string') {
        instruction = instructionOrOptions;
      } else if (
        instructionOrOptions &&
        'instruction' in instructionOrOptions &&
        instructionOrOptions.instruction
      ) {
        instruction = instructionOrOptions.instruction;
        options = instructionOrOptions;
      } else {
        instruction = 'Find elements that can be used for any future actions in the page.';
      }

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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.stagehand.log({
        category: 'observe',
        message: `Failed to observe page: ${errorMessage}`,
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      // Return empty array on error
      return [];
    }
  }

  /**
   * Extract data from the page using AI
   */
  async extract<T extends z.AnyZodObject>(options?: ExtractOptions<T>): Promise<ExtractResult<T>> {
    if (!this.extractHandler) {
      throw new Error('ChromeExtensionStagehandPage not initialized. Call init() first.');
    }

    this.stagehand.log({
      category: 'extract',
      message: 'Extracting data from page using ChromeExtensionStagehandPage',
      level: 1,
    });

    try {
      // Call extractHandler.extract with individual parameters to avoid type compatibility issues
      if (!options) {
        return await this.extractHandler.extract();
      }

      return await this.extractHandler.extract({
        instruction: options.instruction,
        schema: options.schema,
        domSettleTimeoutMs: options.domSettleTimeoutMs,
        useTextExtract: options.useTextExtract,
        selector: options.selector,
        iframes: options.iframes,
        llmClient: this.stagehand.llmClient,
      } as Parameters<typeof this.extractHandler.extract>[0]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.stagehand.log({
        category: 'extract',
        message: `Failed to extract data from page: ${errorMessage}`,
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      throw error; // Re-throw since extract should fail if it can't extract
    }
  }

  async dispose(): Promise<void> {
    // Clean up overlays if they exist
    if (this.extractHandler) {
      try {
        await this.extractHandler.clearExtractionOverlays();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    if (this.observeHandler) {
      try {
        await this.observeHandler.clearObserveOverlays();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Reset handlers
    this.actHandler = null;
    this.extractHandler = null;
    this.observeHandler = null;
  }
}

/**
 * Chrome Extension specific constructor parameters for Stagehand
 * Removes Node.js/Playwright dependencies and browser launching options
 */
export interface ChromeExtensionStagehandParams {
  /**
   * The model to use for Stagehand AI operations
   * @default 'openai/gpt-4o-mini'
   */
  modelName?: AvailableModel;

  /**
   * The parameters to use for the LLM client
   * Useful for parameterizing LLM API Keys
   */
  modelClientOptions?: ClientOptions;

  /**
   * Customize the Stagehand system prompt
   */
  systemPrompt?: string;

  /**
   * The verbosity of the Stagehand logger
   * 0 - No logs, 1 - Only errors, 2 - All logs
   * @default 0
   */
  verbose?: 0 | 1 | 2;

  /**
   * Enable caching of LLM responses
   * @default false
   */
  enableCaching?: boolean;

  /**
   * The timeout to use for the DOM to settle
   * @default 30000
   */
  domSettleTimeoutMs?: number;

  /**
   * Custom logger function for Stagehand
   */
  logger?: (logLine: LogLine) => void;

  /**
   * Enable self-healing when actions fail
   * @default false
   */
  selfHeal?: boolean;

  /**
   * Enable experimental features
   * @default false
   */
  experimental?: boolean;

  /**
   * Provided LLM provider instance
   */
  llmProvider?: LLMProvider;

  /**
   * Provided LLM client instance
   */
  llmClient?: LLMClient;
}

/**
 * Chrome Extension initialization result
 * Simplified version without browser session details
 */
export interface ChromeExtensionInitResult {
  /**
   * Whether initialization was successful
   */
  success: boolean;

  /**
   * Current page URL after initialization
   */
  currentUrl?: string;

  /**
   * Any error message if initialization failed
   */
  error?: string;
}

/**
 * Chrome Extension compatible Stagehand implementation
 *
 * This version removes all Node.js/Playwright dependencies and browser launching logic.
 * It integrates with the existing Cordyceps system for browser automation within
 * the Chrome extension environment.
 *
 * Key differences from the full Stagehand:
 * - No browser launching or context management
 * - Uses BrowserWindow from Cordyceps instead of Playwright context
 * - No file system operations (uses chrome.storage instead)
 * - No Browserbase integration
 * - Simplified initialization that connects to existing browser
 */
export class ChromeExtensionStagehand {
  // Core browser integration
  private _browserWindow: BrowserWindow | null = null;
  private _currentPage: ChromeExtensionStagehandPage | null = null;

  // LLM and AI functionality (keep - this is the valuable part)
  public llmProvider: LLMProvider;
  public llmClient: LLMClient;
  private _modelName: AvailableModel;
  private _modelClientOptions: ClientOptions;
  public readonly userProvidedInstructions?: string;

  // State management and metrics (keep - essential for debugging)
  public stagehandMetrics: StagehandMetrics = {
    actPromptTokens: 0,
    actCompletionTokens: 0,
    actInferenceTimeMs: 0,
    extractPromptTokens: 0,
    extractCompletionTokens: 0,
    extractInferenceTimeMs: 0,
    observePromptTokens: 0,
    observeCompletionTokens: 0,
    observeInferenceTimeMs: 0,
    agentPromptTokens: 0,
    agentCompletionTokens: 0,
    agentInferenceTimeMs: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalInferenceTimeMs: 0,
  };

  private _history: Array<HistoryEntry> = [];

  // Configuration options
  private _stagehandLogger: StagehandLogger;
  public verbose: 0 | 1 | 2;
  public enableCaching: boolean;
  public readonly domSettleTimeoutMs: number;
  public readonly selfHeal: boolean;
  public readonly experimental: boolean;

  // State tracking
  private _isInitialized: boolean = false;
  private _isClosed: boolean = false;

  constructor(params: ChromeExtensionStagehandParams = {}) {
    console.log(
      `[ChromeExtensionStagehand.constructor] Initializing with params: ${JSON.stringify(params)} ######`
    );
    // Set default configuration
    this._modelName = params.modelName ?? 'openai/gpt-4o-mini';
    this._modelClientOptions = params.modelClientOptions ?? {};
    this.userProvidedInstructions = params.systemPrompt;
    this.verbose = params.verbose ?? 0;
    this.enableCaching = params.enableCaching ?? false;
    this.domSettleTimeoutMs = params.domSettleTimeoutMs ?? 30_000;
    this.selfHeal = params.selfHeal ?? false;
    this.experimental = params.experimental ?? false;

    console.log(`[ChromeExtensionStagehand.constructor] Initializing logger ######`);
    // Initialize logger for Chrome extension (no Pino, no file system)
    this._stagehandLogger = new StagehandLogger(
      {
        pretty: true,
        usePino: false, // Never use Pino in Chrome extension
      },
      params.logger
    );
    this._stagehandLogger.setVerbosity(this.verbose);

    console.log(
      `[ChromeExtensionStagehand.constructor] Initializing LLM provider and client ######`
    );
    // Initialize LLM provider and client
    this.llmProvider = params.llmProvider || new LLMProvider(this.logger, this.enableCaching);

    // Sanitize client options to match expected type (filter out null values)
    const sanitizedClientOptions = this._sanitizeClientOptions(this._modelClientOptions);
    this.llmClient =
      params.llmClient || this.llmProvider.getClient(this._modelName, sanitizedClientOptions);

    if (this.experimental) {
      console.log(`[ChromeExtensionStagehand.constructor] Experimental mode enabled ######`);
      this._stagehandLogger.warn(
        'Experimental mode is enabled. This is a beta feature and may break at any time.'
      );
    }
    console.log(`[ChromeExtensionStagehand.constructor] Constructor completed ######`);
  }

  /**
   * Initialize the Chrome extension Stagehand with an existing BrowserWindow
   *
   * Unlike the full Stagehand which launches a browser, this connects to
   * the existing browser context provided by the Cordyceps system.
   */
  async init(browserWindow?: BrowserWindow): Promise<ChromeExtensionInitResult> {
    console.log(
      `[ChromeExtensionStagehand.init] Starting initialization with browserWindow: ${browserWindow} ######`
    );
    if (this._isInitialized) {
      console.log(`[ChromeExtensionStagehand.init] Already initialized, returning early ######`);
      this.log({
        category: 'init',
        message: 'ChromeExtensionStagehand already initialized',
        level: 1,
      });
      return {
        success: true,
        currentUrl: this._currentPage?.page?.url(),
      };
    }

    try {
      this.log({
        category: 'init',
        message: 'Starting ChromeExtensionStagehand initialization...',
        level: 1,
      });

      console.log(`[ChromeExtensionStagehand.init] Setting up BrowserWindow ######`);
      // Use provided BrowserWindow or create a new one
      this._browserWindow = browserWindow || (await BrowserWindow.create());

      this.log({
        category: 'init',
        message: 'BrowserWindow ready, getting current page...',
        level: 2,
      });

      console.log(
        `[ChromeExtensionStagehand.init] Getting current page from browser window ######`
      );
      // Get the current page from the browser window
      const cordycepsPage = await this._browserWindow.getCurrentPage();

      this.log({
        category: 'init',
        message: 'Current page obtained, creating StagehandPage wrapper...',
        level: 2,
        auxiliary: {
          pageUrl: { value: cordycepsPage.url(), type: 'string' },
        },
      });

      console.log(
        `[ChromeExtensionStagehand.init] Creating StagehandPage wrapper for: ${cordycepsPage.url()} ######`
      );
      // Wrap the Cordyceps page with our enhanced StagehandPage
      this._currentPage = new ChromeExtensionStagehandPage(
        cordycepsPage,
        this,
        this.llmClient,
        this.userProvidedInstructions
      );

      this.log({
        category: 'init',
        message: 'StagehandPage wrapper created, setting initialization flag...',
        level: 2,
      });

      console.log(
        `[ChromeExtensionStagehand.init] Setting initialization flag before page initialization ######`
      );
      // Set initialization flag BEFORE initializing the page wrapper to avoid circular dependency
      this._isInitialized = true;

      console.log(`[ChromeExtensionStagehand.init] Initializing StagehandPage wrapper ######`);
      // Initialize the page wrapper
      await this._currentPage.init();

      this.log({
        category: 'init',
        message: 'StagehandPage initialized successfully',
        level: 2,
      });

      const currentUrl = cordycepsPage.url();

      this.log({
        category: 'init',
        message: 'ChromeExtensionStagehand initialized successfully',
        level: 1,
        auxiliary: {
          currentUrl: { value: currentUrl, type: 'string' },
          modelName: { value: this._modelName, type: 'string' },
          experimental: { value: String(this.experimental), type: 'boolean' },
        },
      });

      console.log(`[ChromeExtensionStagehand.init] Initialization completed successfully ######`);
      return {
        success: true,
        currentUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(
        `[ChromeExtensionStagehand.init] ERROR: Initialization failed ${errorMessage} ######`
      );

      this.log({
        category: 'init',
        message: 'Failed to initialize ChromeExtensionStagehand',
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
          stack: { value: error instanceof Error ? error.stack || '' : '', type: 'string' },
        },
      });

      console.log(`[ChromeExtensionStagehand.init] Resetting initialization state ######`);
      // Reset initialization state on failure
      this._isInitialized = false;
      this._currentPage = null;
      this._browserWindow = null;

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the current page instance
   * Provides compatibility with the original Stagehand API
   */
  public get page(): Page {
    console.log(
      `[ChromeExtensionStagehand.page] Getting page, initialized: ${this._isInitialized}, currentPage exists: ${!!this._currentPage} ######`
    );
    if (!this._isInitialized || !this._currentPage) {
      console.log(
        `[ChromeExtensionStagehand.page] ERROR: Not initialized or no current page ######`
      );
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    console.log(
      `[ChromeExtensionStagehand.page] Returning page: ${this._currentPage.page.url()} ######`
    );
    return this._currentPage.page;
  }

  /**
   * Get the enhanced StagehandPage instance with act/observe/extract methods
   */
  public get stagehandPage(): ChromeExtensionStagehandPage {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return this._currentPage;
  }

  /**
   * Get the action history
   */
  public get history(): ReadonlyArray<HistoryEntry> {
    return Object.freeze([...this._history]);
  }

  /**
   * Get current metrics
   */
  public get metrics(): StagehandMetrics {
    return { ...this.stagehandMetrics };
  }

  /**
   * Check if the instance has been closed
   */
  public get isClosed(): boolean {
    return this._isClosed;
  }

  /**
   * Check if the instance is initialized
   */
  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Get the browser window for handlers
   */
  public get browserWindow(): BrowserWindow {
    if (!this._isInitialized || !this._browserWindow) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return this._browserWindow;
  }

  /**
   * Get the logger function
   */
  public get logger(): (logLine: LogLine) => void {
    return (logLine: LogLine) => {
      this.log(logLine);
    };
  }

  /**
   * Update performance metrics for LLM operations
   */
  public updateMetrics(
    functionName: StagehandFunctionName,
    promptTokens: number,
    completionTokens: number,
    inferenceTimeMs: number
  ): void {
    switch (functionName) {
      case StagehandFunctionName.ACT:
        this.stagehandMetrics.actPromptTokens += promptTokens;
        this.stagehandMetrics.actCompletionTokens += completionTokens;
        this.stagehandMetrics.actInferenceTimeMs += inferenceTimeMs;
        break;

      case StagehandFunctionName.EXTRACT:
        this.stagehandMetrics.extractPromptTokens += promptTokens;
        this.stagehandMetrics.extractCompletionTokens += completionTokens;
        this.stagehandMetrics.extractInferenceTimeMs += inferenceTimeMs;
        break;

      case StagehandFunctionName.OBSERVE:
        this.stagehandMetrics.observePromptTokens += promptTokens;
        this.stagehandMetrics.observeCompletionTokens += completionTokens;
        this.stagehandMetrics.observeInferenceTimeMs += inferenceTimeMs;
        break;

      case StagehandFunctionName.AGENT:
        this.stagehandMetrics.agentPromptTokens += promptTokens;
        this.stagehandMetrics.agentCompletionTokens += completionTokens;
        this.stagehandMetrics.agentInferenceTimeMs += inferenceTimeMs;
        break;
    }

    this._updateTotalMetrics(promptTokens, completionTokens, inferenceTimeMs);
  }

  /**
   * Add an entry to the action history
   */
  public addToHistory(method: HistoryEntry['method'], parameters: unknown, result?: unknown): void {
    this._history.push({
      method,
      parameters,
      result: result ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Create an agent instance that can execute AI-powered instructions
   * This is one of the most valuable features from the original Stagehand
   */
  agent(options?: AgentOptions): {
    execute: (instructionOrOptions: string | AgentExecuteOptions) => Promise<AgentResult>;
  } {
    return {
      execute: async (instructionOrOptions: string | AgentExecuteOptions) => {
        if (!this._isInitialized) {
          throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
        }

        // Convert string instruction to options object
        const executeOptions: AgentExecuteOptions =
          typeof instructionOrOptions === 'string'
            ? { instruction: instructionOrOptions }
            : instructionOrOptions;

        // Merge with agent config
        const finalOptions = {
          ...executeOptions,
          ...(options || {}),
        };

        return await this._executeAgentInstruction(finalOptions);
      },
    };
  }

  /**
   * Log a message using the Stagehand logger
   */
  log(logObj: LogLine): void {
    logObj.level = logObj.level ?? 1;
    // Add console.log for debugging - but only for important messages (level 0 or 1)
    if (logObj.level <= 1) {
      console.log(`[ChromeExtensionStagehand.log] ${logObj.category}: ${logObj.message} ######`);
    }
    this._stagehandLogger.log(logObj);
  }

  /**
   * Navigate to a URL using the current page
   * This is a common operation that should be easy to access
   */
  async goto(
    url: string,
    options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }
  ): Promise<void> {
    console.log(
      `[ChromeExtensionStagehand.goto] Navigating to: ${url} with options: ${JSON.stringify(options)} ######`
    );
    if (!this._isInitialized || !this._currentPage) {
      console.log(`[ChromeExtensionStagehand.goto] ERROR: Not initialized ######`);
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'navigation',
      message: `Navigating to: ${url}`,
      level: 1,
      auxiliary: {
        url: { value: url, type: 'string' },
        options: { value: JSON.stringify(options || {}), type: 'object' },
      },
    });

    try {
      console.log(`[ChromeExtensionStagehand.goto] Calling page.goto ######`);
      // Use Cordyceps page.goto method
      await this._currentPage.page.goto(url, options);

      console.log(`[ChromeExtensionStagehand.goto] Adding to history ######`);
      this.addToHistory('navigate', { url, options }, { success: true });

      this.log({
        category: 'navigation',
        message: `Successfully navigated to: ${url}`,
        level: 1,
      });
      console.log(`[ChromeExtensionStagehand.goto] Navigation completed successfully ######`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(
        `[ChromeExtensionStagehand.goto] ERROR: Navigation failed ${errorMessage} ######`
      );

      this.addToHistory('navigate', { url, options }, { success: false, error: errorMessage });

      this.log({
        category: 'navigation',
        message: `Failed to navigate to: ${url}`,
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      throw error;
    }
  }

  /**
   * Get the current URL of the page
   */
  get currentUrl(): string {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return this._currentPage.page.url();
  }

  /**
   * Get the current page title
   */
  async getTitle(): Promise<string> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return await this._currentPage.page.title();
  }

  /**
   * Wait for a selector to appear on the page
   * This is a common operation useful for page automation
   */
  async waitForSelector(selector: string, options?: { timeout?: number }): Promise<void> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'wait',
      message: `Waiting for selector: ${selector}`,
      level: 2,
      auxiliary: {
        selector: { value: selector, type: 'string' },
        timeout: { value: String(options?.timeout || this.domSettleTimeoutMs), type: 'string' },
      },
    });

    // Use Cordyceps locator.waitFor() method instead of page.waitForSelector()
    const locator = this._currentPage.page.locator(selector);
    await locator.waitFor({
      timeout: options?.timeout || this.domSettleTimeoutMs,
    });
  }

  /**
   * Get a locator for a CSS selector
   * This provides access to the full Cordyceps locator API
   */
  locator(selector: string): Locator {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return this._currentPage.page.locator(selector);
  }

  /**
   * Take a screenshot of the current page
   * Useful for debugging and visual verification
   */
  async screenshot(options?: { fullPage?: boolean; quality?: number }): Promise<Buffer> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'screenshot',
      message: 'Taking screenshot',
      level: 2,
      auxiliary: {
        fullPage: { value: String(options?.fullPage || false), type: 'boolean' },
        quality: { value: String(options?.quality || 80), type: 'string' },
      },
    });

    // Use Cordyceps screenshot method with progress
    return await executeWithProgress(async progress => {
      return await this._currentPage!.page.screenshot(progress, {
        fullPage: options?.fullPage,
        quality: options?.quality,
      });
    });
  }

  /**
   * Evaluate JavaScript in the page context
   * Provides access to DOM manipulation and data extraction
   */
  async evaluate<T>(pageFunction: () => T): Promise<T> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'evaluate',
      message: 'Evaluating JavaScript in page context',
      level: 2,
      auxiliary: {
        function: { value: pageFunction.toString(), type: 'string' },
      },
    });

    // Use Cordyceps main frame evaluate method
    return await this._currentPage.page.mainFrame().evaluate(pageFunction);
  }

  /**
   * Reload the current page
   */
  async reload(options?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  }): Promise<void> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'navigation',
      message: 'Reloading page',
      level: 1,
      auxiliary: {
        url: { value: this._currentPage.page.url(), type: 'string' },
        options: { value: JSON.stringify(options || {}), type: 'object' },
      },
    });

    try {
      await this._currentPage.page.reload(options);

      this.addToHistory('navigate', { action: 'reload', options }, { success: true });

      this.log({
        category: 'navigation',
        message: 'Page reloaded successfully',
        level: 1,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.addToHistory(
        'navigate',
        { action: 'reload', options },
        { success: false, error: errorMessage }
      );

      this.log({
        category: 'navigation',
        message: 'Failed to reload page',
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      throw error;
    }
  }

  /**
   * Clean up resources when done
   * Chrome extension version doesn't need to close browser since it's shared
   */
  async close(): Promise<void> {
    console.log(`[ChromeExtensionStagehand.close] Starting close process ######`);
    if (this._isClosed) {
      console.log(`[ChromeExtensionStagehand.close] Already closed, returning early ######`);
      return;
    }

    this.log({
      category: 'close',
      message: 'Closing ChromeExtensionStagehand',
      level: 1,
    });

    console.log(`[ChromeExtensionStagehand.close] Disposing current page ######`);
    // Clean up the page wrapper
    if (this._currentPage) {
      await this._currentPage.dispose();
    }

    console.log(`[ChromeExtensionStagehand.close] Setting closed flags ######`);
    this._isClosed = true;
    this._isInitialized = false;

    this.log({
      category: 'close',
      message: 'ChromeExtensionStagehand closed successfully',
      level: 1,
    });
    console.log(`[ChromeExtensionStagehand.close] Close process completed ######`);
  }

  // Private helper methods

  private _updateTotalMetrics(
    promptTokens: number,
    completionTokens: number,
    inferenceTimeMs: number
  ): void {
    this.stagehandMetrics.totalPromptTokens += promptTokens;
    this.stagehandMetrics.totalCompletionTokens += completionTokens;
    this.stagehandMetrics.totalInferenceTimeMs += inferenceTimeMs;
  }

  /**
   * Sanitize client options to match LLMProvider.getClient expected type
   * Filters out null values and ensures compatibility
   */
  private _sanitizeClientOptions(clientOptions: ClientOptions):
    | {
        apiKey?: string;
        baseURL?: string;
      }
    | undefined {
    if (!clientOptions || typeof clientOptions !== 'object') {
      return undefined;
    }

    const sanitized: { apiKey?: string; baseURL?: string } = {};

    // Extract apiKey if it's a string
    if ('apiKey' in clientOptions && typeof clientOptions.apiKey === 'string') {
      sanitized.apiKey = clientOptions.apiKey;
    }

    // Extract baseURL if it's a string (filter out null)
    if (
      'baseURL' in clientOptions &&
      typeof clientOptions.baseURL === 'string' &&
      clientOptions.baseURL !== null
    ) {
      sanitized.baseURL = clientOptions.baseURL;
    }

    // Return undefined if no valid options found
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private async _executeAgentInstruction(options: AgentExecuteOptions): Promise<AgentResult> {
    // Agent instruction execution using the existing act/observe/extract methods
    // This provides a high-level AI agent that can perform complex multi-step tasks

    this.log({
      category: 'agent',
      message: 'Executing agent instruction',
      level: 1,
      auxiliary: {
        instruction: { value: options.instruction || 'Unknown', type: 'string' },
      },
    });

    try {
      const startTime = Date.now();

      // Step 1: Observe the current page to understand what's available
      const observeResults = await this.stagehandPage.observe(
        `Observe the page to understand the current state and identify elements relevant to: "${options.instruction}"`
      );

      if (observeResults.length === 0) {
        return {
          success: false,
          message: 'No interactive elements found on the page',
          actions: [],
          completed: false,
        };
      }

      // Step 2: Use the first relevant element to perform the action
      const primaryElement = observeResults[0];
      const actResult = await this.stagehandPage.act(primaryElement);

      const endTime = Date.now();
      const inferenceTime = endTime - startTime;

      // Update agent metrics
      this.updateMetrics(StagehandFunctionName.AGENT, 0, 0, inferenceTime);

      // Add to history (use 'act' as the method since 'agent' is not allowed)
      this.addToHistory('act', options, {
        observations: observeResults,
        primaryAction: actResult,
      });

      // Convert ActResult to AgentAction
      const agentAction: AgentAction = {
        type: 'act',
        instruction: options.instruction,
        result: actResult,
        success: actResult.success,
      };

      return {
        success: actResult.success,
        message: actResult.success
          ? `Successfully executed agent instruction: ${options.instruction}`
          : `Failed to execute agent instruction: ${actResult.message}`,
        actions: [agentAction],
        completed: actResult.success,
        usage: {
          input_tokens: 0, // TODO: Get from LLM client if available
          output_tokens: 0, // TODO: Get from LLM client if available
          inference_time_ms: inferenceTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.log({
        category: 'agent',
        message: `Failed to execute agent instruction: ${errorMessage}`,
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      return {
        success: false,
        message: errorMessage,
        actions: [],
        completed: false,
      };
    }
  }
}

// Export everything needed for Chrome extension usage
export * from '../types/log';
export * from '../types/model';
export * from '../types/stagehand';
export * from '../types/agent';
export * from './llm/LLMClient';
export * from './llm/LLMProvider';
