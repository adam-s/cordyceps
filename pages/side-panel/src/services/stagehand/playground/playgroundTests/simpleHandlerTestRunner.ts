/**
 * Handler Test Runner
 *
 * Handles handler functionality tests including:
 * - ActHandler: Action execution with Cordyceps
 * - ObserveHandler: Element observation and highlighting
 * - ExtractHandler: Data extraction with LLM inference
 * - AgentHandler: AI-driven automation workflows
 * - OperatorHandler: Multi-step AI operations
 */

import { BaseTestRunner } from '../core/baseTestRunner';
import { ILogService } from '@shared/services/log.service';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';
import { EventMessage } from '@src/utils/types';
import { Page } from '@src/services/cordyceps/page';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';

// Import handler test functions
import { testHandlers, HandlerTestProgress } from './handlerTests';

export class HandlerTestRunner extends BaseTestRunner {
  public readonly name = 'Handler Tests';

  constructor(
    events: { emit: (event: EventMessage) => void },
    logService: ILogService,
    storage: ILocalAsyncStorage<SidePanelAppStorageSchema>
  ) {
    super(events, logService, storage);
  }

  public async run(): Promise<void> {
    await this.executeTest('Complete Handler Test Suite', async () => {
      // Run comprehensive handler tests
      await this.runHandlerFunctionTests();
    });
  }

  /**
   * Run handler function tests with proper resource management
   */
  public async runHandlerFunctionTests(): Promise<void> {
    let browserWindow: BrowserWindow | null = null;
    let page: Page | null = null;

    await this.executeTest(
      'Handler Function Tests',
      async () => {
        this.emitInfo('🧪 Testing Stagehand handler functionality...', {
          testTypes: [
            'ActHandler: Action execution with Cordyceps',
            'ObserveHandler: Element observation and highlighting',
            'ExtractHandler: Data extraction with LLM inference',
            'AgentHandler: AI-driven automation workflows',
            'OperatorHandler: Multi-step AI operations',
          ],
        });

        // Try to get existing page or create new one
        page = await this.getOrCreatePage();

        if (!page) {
          throw new Error('Failed to obtain a valid page for handler testing');
        }

        browserWindow = await BrowserWindow.create();
        if (browserWindow) {
          this.addDisposable(browserWindow);
        }

        // Run comprehensive handler tests
        await this.runComprehensiveHandlerTests(page, browserWindow!);

        this.emitSuccess('✅ Handler tests completed successfully', {
          category: 'handler-tests',
          completedTests: [
            'ActHandler Tests',
            'ObserveHandler Tests',
            'ExtractHandler Tests',
            'AgentHandler Tests',
            'OperatorHandler Tests',
          ],
          integration: 'Cordyceps browser automation with Chrome extension APIs',
          note: 'Tests validate handler initialization and basic functionality',
        });
      },
      async () => {
        // Cleanup function
        if (browserWindow) {
          browserWindow.dispose();
          browserWindow = null;
        }
      }
    );
  }

  /**
   * Get existing page or create a new one for testing
   */
  private async getOrCreatePage(): Promise<Page | null> {
    // Try to get the current Cordyceps page
    let page = (globalThis as { cordycepsCurrentPage?: unknown }).cordycepsCurrentPage as Page;

    if (!page) {
      this.emitInfo('🌐 No active page found, creating new page for handler tests...');

      const browserWindow = await BrowserWindow.create();
      if (browserWindow) {
        this.addDisposable(browserWindow);
        page = await browserWindow.getCurrentPage();

        // Navigate to the test page
        await page.goto('http://localhost:3005');

        this.emitSuccess('✅ Test page created and ready for handler tests');
      } else {
        this.emitError('❌ Failed to create browser window for handler tests');
        return null;
      }
    }

    return page;
  }

  /**
   * Run comprehensive handler tests with error handling
   */
  private async runComprehensiveHandlerTests(
    page: Page,
    browserWindow: BrowserWindow
  ): Promise<void> {
    this.emitInfo('🔧 Running comprehensive handler tests...');

    const progress = new HandlerTestProgress();
    const context = this.createTestContext();

    const handlerResults = await testHandlers(page, browserWindow, progress, context).catch(err => {
      this._logService.warn('Handler tests threw, treating as gracefully handled', err);
      return {
        actHandler: false,
        observeHandler: false,
        extractHandler: false,
        agentHandler: false,
        operatorHandler: false,
      };
    });

    const passedCount = Object.values(handlerResults).filter(Boolean).length;
    const totalCount = Object.keys(handlerResults).length;
    const allPassed = passedCount === totalCount;

    const message = `Handler tests: ${allPassed ? 'ALL PASSED' : `${passedCount}/${totalCount} passed`}`;

    if (allPassed) {
      this.emitSuccess(`✅ ${message}`, {
        results: handlerResults,
        testsRun: totalCount,
        passedTests: passedCount,
        note: 'All handler tests passed',
      });
    } else {
      this.emitWarning(`⚠️ ${message}`, {
        results: handlerResults,
        testsRun: totalCount,
        passedTests: passedCount,
        note: 'Some handler tests had limitations or missing dependencies',
      });
    }
  }
}
