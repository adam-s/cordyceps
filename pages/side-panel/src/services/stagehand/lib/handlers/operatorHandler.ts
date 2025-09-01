/**
 * Chrome Extension compatible OperatorHandler using Cordyceps engine
 *
 * This Redux implementation replaces Playwright dependencies with Cordyceps APIs
 * and provides comprehensive AI-driven browser automation capabilities within
 * Chrome extension security constraints.
 */

import { z } from 'zod';
import { AgentAction, AgentExecuteOptions, AgentResult } from '../../types/agent';
import { LogLine, LogLevel } from '../../types/log';
import {
  OperatorResponse,
  operatorResponseSchema,
  OperatorSummary,
  operatorSummarySchema,
} from '../../types/operator';
import { ChatMessage, LLMClient } from '../llm/LLMClient';
import { buildOperatorSystemPrompt } from '../prompt';
import { ChromeExtensionStagehand } from '../index';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
// Note: Progress is imported as type, we'll use BrowserWindow for page access
import type { Progress } from '@src/services/cordyceps/core/progress';
import { ObserveResult } from '../../types/stagehand';
import { StagehandError, StagehandMissingArgumentError } from '../../types/stagehandErrors';

// Import Redux handlers for delegation
import { StagehandObserveHandler } from './observeHandler';
import { StagehandExtractHandler } from './extractHandler';
import { StagehandActHandler } from './actHandler';

/**
 * Chrome Extension compatible OperatorHandler using Cordyceps engine
 *
 * This Redux implementation coordinates AI-driven browser automation by:
 * - Taking screenshots for AI visual analysis
 * - Executing multi-step automation workflows
 * - Managing action history and state
 * - Delegating browser interactions to Cordyceps-based handlers
 */
export class StagehandOperatorHandler {
  private readonly stagehand: ChromeExtensionStagehand;
  private readonly logger: (message: LogLine) => void;
  private readonly llmClient: LLMClient;
  private readonly browserWindow: BrowserWindow;
  private readonly observeHandler: StagehandObserveHandler;
  private readonly extractHandler: StagehandExtractHandler;
  private readonly actHandler: StagehandActHandler;
  private messages: ChatMessage[];

  constructor(
    stagehand: ChromeExtensionStagehand,
    logger: (message: LogLine) => void,
    llmClient: LLMClient,
    browserWindow: BrowserWindow
  ) {
    console.log(`[StagehandOperatorHandler.constructor] initializing ######`);
    this.stagehand = stagehand;
    this.logger = logger;
    this.llmClient = llmClient;
    this.browserWindow = browserWindow;
    this.messages = [];

    // Initialize handlers for delegation
    console.log(`[StagehandOperatorHandler.constructor] initializing sub-handlers ######`);
    this.observeHandler = new StagehandObserveHandler({
      stagehand,
      logger: message =>
        logger({
          category: message.category,
          message: message.message,
          level: message.level as LogLevel | undefined,
          auxiliary: message.auxiliary as LogLine['auxiliary'],
        }),
      browserWindow,
      experimental: false,
    });

    this.extractHandler = new StagehandExtractHandler({
      stagehand,
      logger: message =>
        logger({
          category: message.category,
          message: message.message,
          level: message.level as LogLevel | undefined,
          auxiliary: message.auxiliary as LogLine['auxiliary'],
        }),
      browserWindow,
      experimental: false,
    });

    this.actHandler = new StagehandActHandler({
      logger: message =>
        logger({
          category: message.category,
          message: message.message,
          level: message.level as LogLevel | undefined,
          auxiliary: message.auxiliary as LogLine['auxiliary'],
        }),
      browserWindow,
      selfHeal: true,
      experimental: false,
    });
    console.log(`[StagehandOperatorHandler.constructor] initialization complete ######`);
  }

  /**
   * Create a simple progress object for screenshots
   */
  private createProgress(): Progress {
    console.log(`[StagehandOperatorHandler.createProgress] creating progress object ######`);
    return {
      log: (_message: string) => {
        // Simple logging - could be enhanced
        console.log(`[StagehandOperatorHandler.createProgress.log] message=${_message} ######`);
      },
      cleanupWhenAborted: (_cleanup: (error?: Error) => void) => {
        // No-op for simplicity
        console.log(`[StagehandOperatorHandler.createProgress.cleanupWhenAborted] called ######`);
      },
      race: <T>(promise: Promise<T> | Promise<T>[]): Promise<T> => {
        console.log(`[StagehandOperatorHandler.createProgress.race] called ######`);
        if (Array.isArray(promise)) {
          return Promise.race(promise);
        }
        return promise;
      },
      raceWithCleanup: <T>(promise: Promise<T>, _cleanup: (result: T) => void): Promise<T> => {
        console.log(`[StagehandOperatorHandler.createProgress.raceWithCleanup] called ######`);
        return promise;
      },
      wait: (timeoutMs: number): Promise<void> => {
        console.log(`[StagehandOperatorHandler.createProgress.wait] timeoutMs=${timeoutMs} ######`);
        return new Promise(resolve => setTimeout(resolve, timeoutMs));
      },
      abort: (_error: Error): void => {
        // No-op for simplicity
        console.log(
          `[StagehandOperatorHandler.createProgress.abort] error=${_error?.message} ######`
        );
      },
    };
  }

  public async execute(instructionOrOptions: string | AgentExecuteOptions): Promise<AgentResult> {
    console.log(
      `[StagehandOperatorHandler.execute] starting execution with instructionOrOptions=${JSON.stringify(
        instructionOrOptions
      )} ######`
    );
    const options =
      typeof instructionOrOptions === 'string'
        ? { instruction: instructionOrOptions }
        : instructionOrOptions;

    this.messages = [buildOperatorSystemPrompt(options.instruction)];
    let completed = false;
    let currentStep = 0;
    const maxSteps = options.maxSteps || 10;
    const actions: AgentAction[] = [];

    console.log(`[StagehandOperatorHandler.execute] starting loop: maxSteps=${maxSteps} ######`);
    while (!completed && currentStep < maxSteps) {
      try {
        console.log(
          `[StagehandOperatorHandler.execute] loop step=${currentStep} completed=${completed} ######`
        );
        const page = await this.browserWindow.getCurrentPage();
        if (!page) {
          console.error(`[StagehandOperatorHandler.execute] No active page found ######`);
          throw new StagehandError('No active page available in extension context');
        }

        const url = await page.url();
        console.log(`[StagehandOperatorHandler.execute] current page url=${url} ######`);

        if (!url || url === 'about:blank') {
          console.log(
            `[StagehandOperatorHandler.execute] page is blank, pushing initial message ######`
          );
          this.messages.push({
            role: 'user',
            content: [
              {
                type: 'text',
                text: "No page is currently loaded. The first step should be a 'goto' action to navigate to a URL.",
              },
            ],
          });
        } else {
          console.log(`[StagehandOperatorHandler.execute] taking screenshot ######`);
          const progress = this.createProgress();
          const screenshot = await page.screenshot(progress, {
            type: 'png',
            fullPage: false,
          });

          const base64Image = screenshot.toString('base64');
          console.log(
            `[StagehandOperatorHandler.execute] screenshot taken, base64 length=${base64Image.length} ######`
          );

          let messageText = `Here is a screenshot of the current page (URL: ${url}):`;

          const previousActionsSummary = actions
            .map(action => {
              let result: string = '';
              if (action.type === 'act') {
                const args = action.playwrightArguments as ObserveResult;
                result = `Performed a "${args.method}" action ${
                  args.arguments && args.arguments.length > 0
                    ? `with arguments: ${args.arguments.map(arg => `"${arg}"`).join(', ')}`
                    : ''
                } on "${args.description}"`;
              } else if (action.type === 'extract') {
                result = `Extracted data: ${action.extractionResult}`;
              }
              return `[${action.type}] ${action.reasoning}. Result: ${result}`;
            })
            .join('\n');

          messageText = `Previous actions were: ${previousActionsSummary}\n\n${messageText}`;
          console.log(
            `[StagehandOperatorHandler.execute] constructed message text with previous actions ######`
          );

          this.messages.push({
            role: 'user',
            content: [
              {
                type: 'text',
                text: messageText,
              },
              this.llmClient.type === 'anthropic'
                ? {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: 'image/png',
                      data: base64Image,
                    },
                    text: 'the screenshot of the current page',
                  }
                : {
                    type: 'image_url',
                    image_url: { url: `data:image/png;base64,${base64Image}` },
                  },
            ],
          });
          console.log(`[StagehandOperatorHandler.execute] pushed message with screenshot ######`);
        }

        const result = await this.getNextStep(currentStep);
        console.log(
          `[StagehandOperatorHandler.execute] got next step result=${JSON.stringify(result)} ######`
        );

        if (result.method === 'close') {
          completed = true;
          console.log(
            `[StagehandOperatorHandler.execute] task marked as completed by 'close' action ######`
          );
        }

        let playwrightArguments: ObserveResult | undefined;
        if (result.method === 'act') {
          console.log(
            `[StagehandOperatorHandler.execute] 'act' method detected, calling observeHandler ######`
          );
          const observeResults = await this.observeHandler.observe({
            instruction: result.parameters || '',
            llmClient: this.llmClient,
            requestId: `operator-act-${currentStep}`,
            fromAct: true,
          });
          playwrightArguments = observeResults[0];
          console.log(
            `[StagehandOperatorHandler.execute] observeHandler returned arguments=${JSON.stringify(
              playwrightArguments
            )} ######`
          );
        }
        let extractionResult: unknown | undefined;
        if (result.method === 'extract') {
          console.log(
            `[StagehandOperatorHandler.execute] 'extract' method detected, calling extractHandler ######`
          );
          if (result.parameters === null || result.parameters === undefined) {
            const extractionResultObj = await this.extractHandler.extract();
            extractionResult = extractionResultObj.page_text;
          } else {
            extractionResult = await this.extractHandler.extract({
              instruction: result.parameters,
            });
          }
          console.log(
            `[StagehandOperatorHandler.execute] extractHandler returned result=${JSON.stringify(
              extractionResult
            )} ######`
          );
        }

        await this.executeAction(result, playwrightArguments, extractionResult);
        console.log(`[StagehandOperatorHandler.execute] action executed ######`);

        actions.push({
          type: result.method,
          reasoning: result.reasoning,
          taskCompleted: result.taskComplete,
          parameters: result.parameters,
          playwrightArguments,
          extractionResult,
        });
        console.log(`[StagehandOperatorHandler.execute] action pushed to history ######`);

        currentStep++;
      } catch (error) {
        console.error(
          `[StagehandOperatorHandler.execute] error in execution loop: ${
            error instanceof Error ? error.message : String(error)
          } ######`
        );
        if (error instanceof Error && error.message.includes('Extension context invalidated')) {
          this.logger({
            category: 'error',
            message: 'Extension context invalidated during operator execution',
            level: 1,
          });
          // Handle extension lifecycle gracefully
          break;
        }
        throw error;
      }
    }

    console.log(`[StagehandOperatorHandler.execute] loop finished, getting summary ######`);
    const summary = await this.getSummary(options.instruction);
    console.log(`[StagehandOperatorHandler.execute] summary received: "${summary}" ######`);

    return {
      success: true,
      message: summary,
      actions,
      completed:
        actions.length > 0 ? (actions[actions.length - 1].taskCompleted as boolean) : false,
    };
  }

  private async getNextStep(currentStep: number): Promise<OperatorResponse> {
    console.log(
      `[StagehandOperatorHandler.getNextStep] getting next step for step=${currentStep} ######`
    );
    const response = await this.llmClient.createChatCompletion<OperatorResponse>({
      options: {
        messages: this.messages,
        response_model: {
          name: 'operatorResponseSchema',
          schema: operatorResponseSchema as unknown as z.ZodType<OperatorResponse>,
        },
        requestId: `operator-step-${currentStep}`,
      },
      logger: this.logger,
    });

    console.log(
      `[StagehandOperatorHandler.getNextStep] received response=${JSON.stringify(response)} ######`
    );
    return response;
  }

  private async getSummary(goal: string): Promise<string> {
    console.log(`[StagehandOperatorHandler.getSummary] getting summary for goal="${goal}" ######`);
    const response = await this.llmClient.createChatCompletion<OperatorSummary>({
      options: {
        messages: [
          ...this.messages,
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Now use the steps taken to answer the original instruction of ${goal}.`,
              },
            ],
          },
        ],
        response_model: {
          name: 'operatorSummarySchema',
          schema: operatorSummarySchema as unknown as z.ZodType<OperatorSummary>,
        },
        requestId: 'operator-summary',
      },
      logger: this.logger,
    });

    console.log(
      `[StagehandOperatorHandler.getSummary] received summary response=${JSON.stringify(
        response
      )} ######`
    );
    return response.answer;
  }

  private async executeAction(
    action: OperatorResponse,
    playwrightArguments?: ObserveResult,
    extractionResult?: unknown
  ): Promise<unknown> {
    const { method, parameters } = action;
    console.log(
      `[StagehandOperatorHandler.executeAction] executing method=${method} parameters=${JSON.stringify(
        parameters
      )} ######`
    );

    if (method === 'close') {
      console.log(
        `[StagehandOperatorHandler.executeAction] 'close' method, returning early ######`
      );
      return;
    }

    try {
      const page = await this.browserWindow.getCurrentPage();
      if (!page) {
        console.error(`[StagehandOperatorHandler.executeAction] No active page found ######`);
        throw new StagehandError('No active page available in extension context');
      }

      switch (method) {
        case 'act': {
          console.log(`[StagehandOperatorHandler.executeAction] handling 'act' method ######`);
          if (!playwrightArguments) {
            console.error(
              `[StagehandOperatorHandler.executeAction] Missing arguments for 'act' ######`
            );
            throw new StagehandMissingArgumentError(
              'No arguments provided to `act()`. ' +
                'Please ensure that all required arguments are passed in.'
            );
          }
          // Use the fully implemented actHandler to perform the action
          console.log(
            `[StagehandOperatorHandler.executeAction] calling actHandler.actFromObserveResult ######`
          );
          const actResult = await this.actHandler.actFromObserveResult(playwrightArguments);
          this.logger({
            category: 'operator',
            message: `Act operation ${actResult.success ? 'completed' : 'failed'}: ${actResult.message}`,
            level: actResult.success ? 1 : 2,
          });
          console.log(
            `[StagehandOperatorHandler.executeAction] actHandler result: success=${actResult.success}, message=${actResult.message} ######`
          );
          if (!actResult.success) {
            throw new StagehandError(`Act operation failed: ${actResult.message}`);
          }
          break;
        }
        case 'extract':
          console.log(`[StagehandOperatorHandler.executeAction] handling 'extract' method ######`);
          if (!extractionResult) {
            console.error(
              `[StagehandOperatorHandler.executeAction] Missing extractionResult for 'extract' ######`
            );
            throw new StagehandError(
              'Error in OperatorHandler: Cannot complete extraction. No extractionResult provided.'
            );
          }
          return extractionResult;
        case 'goto':
          console.log(
            `[StagehandOperatorHandler.executeAction] handling 'goto' method to url=${parameters} ######`
          );
          if (parameters) {
            await page.goto(parameters, { waitUntil: 'load' });
          }
          break;
        case 'wait':
          console.log(
            `[StagehandOperatorHandler.executeAction] handling 'wait' method for timeout=${parameters} ######`
          );
          if (parameters) {
            await page.waitForTimeout(parseInt(parameters));
          }
          break;
        case 'navback':
          console.log(`[StagehandOperatorHandler.executeAction] handling 'navback' method ######`);
          await page.goBack();
          break;
        case 'refresh':
          console.log(`[StagehandOperatorHandler.executeAction] handling 'refresh' method ######`);
          await page.reload();
          break;
        default:
          console.error(
            `[StagehandOperatorHandler.executeAction] unknown method: ${method} ######`
          );
          throw new StagehandError(
            `Error in OperatorHandler: Cannot execute unknown action: ${method}`
          );
      }

      console.log(`[StagehandOperatorHandler.executeAction] finished method=${method} ######`);
      return undefined;
    } catch (error) {
      console.error(
        `[StagehandOperatorHandler.executeAction] error during action execution: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        this.logger({
          category: 'error',
          message: `Extension context invalidated during ${method} action`,
          level: 1,
        });
        throw new StagehandError(`Action ${method} failed due to extension context invalidation`);
      }
      throw error;
    }
  }
}
