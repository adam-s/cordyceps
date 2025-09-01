/**
 * Chrome Extension compatible AgentHandler using Cordyceps engine
 *
 * This Redux implementation replaces Playwright dependencies with Cordyceps APIs
 * and provides comprehensive agent execution capabilities within Chrome extension
 * security constraints.
 */

import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { ChromeExtensionStagehand } from '../index';
import { LogLine } from '../../types/log';
import { Progress } from '@src/services/cordyceps/core/progress';
import {
  AgentExecuteOptions,
  AgentAction,
  AgentResult,
  AgentHandlerOptions,
  ActionExecutionResult,
} from '../../types/agent';
import { StagehandFunctionName } from '../../types/stagehand';
import { AgentProvider } from '../agent/AgentProvider';
import { StagehandAgent } from '../agent/StagehandAgent';
import { AgentClient } from '../agent/AgentClient';
import { mapKeyToPlaywright } from '../agent/utils/cuaKeyMapping';

// Import content script functions
import {
  scrollByFunction,
  checkElementExistsFunction,
  injectCursorAndHighlightFunction,
  updateCursorPositionFunction,
  animateClickFunction,
} from './agentHandlerUtils';

export class StagehandAgentHandler {
  private readonly stagehand: ChromeExtensionStagehand;
  private readonly logger: (logLine: LogLine) => void;
  private readonly browserWindow: BrowserWindow;
  private readonly options: AgentHandlerOptions;

  private agent: StagehandAgent;
  private provider: AgentProvider;
  private agentClient: AgentClient;

  constructor({
    stagehand,
    logger,
    browserWindow,
    options,
  }: {
    stagehand: ChromeExtensionStagehand;
    logger: (logLine: LogLine) => void;
    browserWindow: BrowserWindow;
    options: AgentHandlerOptions;
  }) {
    this.stagehand = stagehand;
    this.logger = logger;
    this.browserWindow = browserWindow;
    this.options = options;

    // Initialize the provider
    this.provider = new AgentProvider(logger);

    // Create client first
    const client = this.provider.getClient(
      options.modelName,
      options.clientOptions || {},
      options.userProvidedInstructions,
      options.experimental
    );

    // Store the client
    this.agentClient = client;

    // Set up common functionality for any client type
    this.setupAgentClient();

    // Create agent with the client
    this.agent = new StagehandAgent(client, logger);
  }

  /**
   * Execute a task with the agent
   */
  public async execute(optionsOrInstruction: AgentExecuteOptions | string): Promise<AgentResult> {
    const options =
      typeof optionsOrInstruction === 'string'
        ? { instruction: optionsOrInstruction }
        : optionsOrInstruction;

    // Redirect to Google if the URL is empty or about:blank
    const page = await this.browserWindow.getCurrentPage();
    const currentUrl = page.url();
    if (!currentUrl || currentUrl === 'about:blank') {
      this.logger({
        category: 'agent',
        message: `Page URL is empty or about:blank. Redirecting to www.google.com...`,
        level: 0,
      });
      await page.goto('https://www.google.com');
    }

    this.logger({
      category: 'agent',
      message: `Executing agent task: ${options.instruction}`,
      level: 1,
    });

    // Inject cursor for visual feedback
    try {
      await this.injectCursor();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger({
        category: 'agent',
        message: `Warning: Failed to inject cursor: ${errorMessage}. Continuing with execution.`,
        level: 1,
      });
      // Continue execution even if cursor injection fails
    }

    // Take initial screenshot if needed
    if (options.autoScreenshot !== false) {
      try {
        await this.captureAndSendScreenshot();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger({
          category: 'agent',
          message: `Warning: Failed to take initial screenshot: ${errorMessage}. Continuing with execution.`,
          level: 1,
        });
        // Continue execution even if screenshot fails
      }
    }

    // Execute the task
    const result = await this.agent.execute(optionsOrInstruction);
    if (result.usage) {
      this.stagehand.updateMetrics(
        StagehandFunctionName.AGENT,
        result.usage.input_tokens,
        result.usage.output_tokens,
        result.usage.inference_time_ms
      );
    }

    return result;
  }

  /**
   * Get the underlying agent instance
   */
  public getAgent(): StagehandAgent {
    return this.agent;
  }

  /**
   * Get the agent client instance
   */
  public getClient(): AgentClient {
    return this.agentClient;
  }

  /**
   * Create a simple progress object for screenshots
   */
  private createProgress(): Progress {
    return {
      log: (_message: string) => {
        // Simple logging - could be enhanced
      },
      cleanupWhenAborted: (_cleanup: (error?: Error) => void) => {
        // No-op for simplicity
      },
      race: <T>(promise: Promise<T> | Promise<T>[]): Promise<T> => {
        if (Array.isArray(promise)) {
          return Promise.race(promise);
        }
        return promise;
      },
      raceWithCleanup: <T>(promise: Promise<T>, _cleanup: (result: T) => void): Promise<T> => {
        return promise;
      },
      wait: (timeoutMs: number): Promise<void> => {
        return new Promise(resolve => setTimeout(resolve, timeoutMs));
      },
      abort: (_error: Error) => {
        // No-op for simplicity
      },
    };
  }

  /**
   * Capture screenshot and send to agent
   */
  public async captureAndSendScreenshot(): Promise<unknown> {
    this.logger({
      category: 'agent',
      message: 'Taking screenshot and sending to agent',
      level: 1,
    });

    try {
      const page = await this.browserWindow.getCurrentPage();

      // Take screenshot of the current page using Cordyceps
      const screenshot = await page.screenshot(this.createProgress(), {
        type: 'png',
        fullPage: false,
      });

      // Convert to base64
      const base64Image = screenshot.toString('base64');

      // Use the captureScreenshot method on the agent client
      return await this.agentClient.captureScreenshot({
        base64Image,
        currentUrl: page.url(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger({
        category: 'agent',
        message: `Error capturing screenshot: ${errorMessage}`,
        level: 0,
      });
      return null;
    }
  }

  /**
   * Inject cursor and highlight elements for visual feedback
   */
  public async injectCursor(): Promise<void> {
    try {
      const page = await this.browserWindow.getCurrentPage();

      // Define constants for cursor and highlight element IDs
      const CURSOR_ID = 'stagehand-cursor';
      const HIGHLIGHT_ID = 'stagehand-highlight';

      // Check if cursor already exists
      const cursorExists = await page.evaluate(checkElementExistsFunction, CURSOR_ID);

      if (cursorExists) {
        return;
      }

      // Inject cursor and highlight elements
      await page.evaluate(injectCursorAndHighlightFunction, {
        cursorId: CURSOR_ID,
        highlightId: HIGHLIGHT_ID,
      });

      this.logger({
        category: 'agent',
        message: 'Cursor injected for visual feedback',
        level: 1,
      });
    } catch (error) {
      this.logger({
        category: 'agent',
        message: `Failed to inject cursor: ${error}`,
        level: 0,
      });
    }
  }

  /**
   * Update cursor position on the page
   */
  public async updateCursorPosition(x: number, y: number): Promise<void> {
    try {
      const page = await this.browserWindow.getCurrentPage();
      await page.evaluate(updateCursorPositionFunction, { x, y });
    } catch {
      // Silently fail if cursor update fails
      // This is not critical functionality
    }
  }

  /**
   * Animate click at specified coordinates
   */
  public async animateClick(x: number, y: number): Promise<void> {
    try {
      const page = await this.browserWindow.getCurrentPage();
      await page.evaluate(animateClickFunction, { x, y });
    } catch {
      // Silently fail if animation fails
      // This is not critical functionality
    }
  }

  /**
   * Execute a single action on the page
   */
  public async executeAction(action: AgentAction): Promise<ActionExecutionResult> {
    try {
      const page = await this.browserWindow.getCurrentPage();

      switch (action.type) {
        case 'click': {
          const { x, y, button = 'left' } = action;
          // Update cursor position first
          await this.updateCursorPosition(x as number, y as number);
          // Animate the click
          await this.animateClick(x as number, y as number);
          // Small delay to see the animation
          await new Promise(resolve => setTimeout(resolve, 300));
          // Perform the actual click using Cordyceps
          await page.click(`body`, {
            position: { x: x as number, y: y as number },
            button: button as 'left' | 'right',
          });
          return { success: true };
        }

        case 'double_click':
        case 'doubleClick': {
          const { x, y } = action;
          // Update cursor position first
          await this.updateCursorPosition(x as number, y as number);
          // Animate the click
          await this.animateClick(x as number, y as number);
          // Small delay to see the animation
          await new Promise(resolve => setTimeout(resolve, 200));
          // Animate the second click
          await this.animateClick(x as number, y as number);
          // Small delay to see the animation
          await new Promise(resolve => setTimeout(resolve, 200));
          // Perform the actual double click using Cordyceps
          await page.dblclick(`body`, {
            position: { x: x as number, y: y as number },
          });
          return { success: true };
        }

        case 'type': {
          const { text } = action;
          // Use focused element or body for typing
          const locator = page.locator(':focus').or(page.locator('body'));
          await locator.type(text as string);
          return { success: true };
        }

        case 'keypress': {
          const { keys } = action;
          if (Array.isArray(keys)) {
            // Use focused element or body for key presses
            const locator = page.locator(':focus').or(page.locator('body'));
            for (const key of keys) {
              const mappedKey = mapKeyToPlaywright(key);
              await locator.press(mappedKey);
            }
          }
          return { success: true };
        }

        case 'scroll': {
          const { x, y, scroll_x = 0, scroll_y = 0 } = action;
          // First move to the position (simulate mouse move)
          await this.updateCursorPosition(x as number, y as number);
          // Then scroll using content script function
          await page.evaluate(scrollByFunction, {
            scrollX: scroll_x as number,
            scrollY: scroll_y as number,
          });
          return { success: true };
        }

        case 'drag': {
          const { path } = action;
          if (Array.isArray(path) && path.length >= 2) {
            const start = path[0];

            // Update cursor position for start
            await this.updateCursorPosition(start.x, start.y);

            // Use Cordyceps drag functionality
            const startLocator = page.locator(`body`);
            await startLocator.dragTo(startLocator, {
              sourcePosition: { x: start.x, y: start.y },
              targetPosition: { x: path[path.length - 1].x, y: path[path.length - 1].y },
            });

            // Update cursor position for end
            await this.updateCursorPosition(path[path.length - 1].x, path[path.length - 1].y);
          }
          return { success: true };
        }

        case 'move': {
          const { x, y } = action;
          // Update cursor position
          await this.updateCursorPosition(x as number, y as number);
          return { success: true };
        }

        case 'wait': {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { success: true };
        }

        case 'screenshot': {
          // Screenshot is handled automatically by the agent client
          // after each action, so we don't need to do anything here
          return { success: true };
        }

        case 'function': {
          const { name, arguments: args = {} } = action;

          if (name === 'goto' && typeof args === 'object' && args !== null && 'url' in args) {
            await page.goto(args.url as string);
            this.updateClientUrl();
            return { success: true };
          } else if (name === 'back') {
            await page.goBack();
            this.updateClientUrl();
            return { success: true };
          } else if (name === 'forward') {
            await page.goForward();
            this.updateClientUrl();
            return { success: true };
          } else if (name === 'reload') {
            await page.reload();
            this.updateClientUrl();
            return { success: true };
          }

          return {
            success: false,
            error: `Unsupported function: ${name}`,
          };
        }

        case 'key': {
          // Handle the 'key' action type from Anthropic
          const { text } = action;
          const playwrightKey = mapKeyToPlaywright(text as string);
          // Use focused element or body for key press
          const locator = page.locator(':focus').or(page.locator('body'));
          await locator.press(playwrightKey);
          return { success: true };
        }

        default:
          return {
            success: false,
            error: `Unsupported action type: ${(action as { type: string }).type}`,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger({
        category: 'agent',
        message: `Error executing action ${action.type}: ${errorMessage}`,
        level: 0,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Setup agent client with screenshot provider and action handler
   */
  private setupAgentClient(): void {
    // Set up screenshot provider for any client type
    this.agentClient.setScreenshotProvider(async () => {
      const page = await this.browserWindow.getCurrentPage();
      const screenshot = await page.screenshot(this.createProgress(), {
        fullPage: false,
      });
      // Convert to base64
      return screenshot.toString('base64');
    });

    // Set up action handler for any client type
    this.agentClient.setActionHandler(async action => {
      // Default delay between actions (1 second if not specified)
      const defaultDelay = 1000;
      // Use specified delay or default
      const waitBetweenActions =
        (this.options.clientOptions?.waitBetweenActions as number) || defaultDelay;

      try {
        // Try to inject cursor before each action
        try {
          await this.injectCursor();
        } catch {
          // Ignore cursor injection failures
        }

        // Add a small delay before the action for better visibility
        await new Promise(resolve => setTimeout(resolve, 500));

        // Execute the action
        await this.executeAction(action);

        // Add a delay after the action for better visibility
        await new Promise(resolve => setTimeout(resolve, waitBetweenActions));

        // After executing an action, take a screenshot
        try {
          await this.captureAndSendScreenshot();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger({
            category: 'agent',
            message: `Warning: Failed to take screenshot after action: ${errorMessage}. Continuing execution.`,
            level: 1,
          });
          // Continue execution even if screenshot fails
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger({
          category: 'agent',
          message: `Error executing action ${action.type}: ${errorMessage}`,
          level: 0,
        });
        throw error; // Re-throw the error to be handled by the caller
      }
    });

    // Update viewport and URL for any client type
    this.updateClientViewport();
    this.updateClientUrl();
  }

  /**
   * Update client viewport information
   */
  private updateClientViewport(): void {
    // Get viewport from browser window - this is a simplified approach
    // In a real implementation, you might want to get actual viewport size
    this.agentClient.setViewport(1280, 720); // Default viewport size
  }

  /**
   * Update client URL information
   */
  private async updateClientUrl(): Promise<void> {
    const page = await this.browserWindow.getCurrentPage();
    const url = page.url();
    this.agentClient.setCurrentUrl(url);
  }
}
