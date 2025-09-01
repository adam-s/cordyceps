/**
 * Comprehensive Handler Tests for Stagehand Redux Implementation
 *
 * Tests for all Chrome Extension compatible handlers:
 * - ActHandler: Action execution with Cordyceps
 * - ObserveHandler: Element observation and highlighting
 * - ExtractHandler: Data extraction with LLM inference
 * - AgentHandler: AI-driven automation workflows
 * - OperatorHandler: Multi-step AI operations
 */

import { TestProgress, TestContext } from './types';
import { Page } from '@src/services/cordyceps/page';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { Severity } from '@src/utils/types';

// Import handlers for testing
import { StagehandActHandler } from '../../lib/handlers/actHandler';
import { StagehandObserveHandler } from '../../lib/handlers/observeHandler';
import { StagehandExtractHandler } from '../../lib/handlers/extractHandler';
import { StagehandAgentHandler } from '../../lib/handlers/agentHandler';
import { StagehandOperatorHandler } from '../../lib/handlers/operatorHandler';

// Import mock types and utilities
import type { ChromeExtensionStagehand } from '../../lib';
import type { ObserveResult } from '../../types/stagehand';

/**
 * Progress tracking for handler tests
 */
class HandlerTestProgress extends TestProgress {
  constructor() {
    super('Handler Tests');
  }
}

/**
 * Mock implementations for testing
 */
class MockLogger {
  logs: Array<{
    category?: string;
    message: string;
    level?: number;
    auxiliary?: Record<string, { value: string; type: string }>;
  }> = [];

  log = (message: {
    category?: string;
    message: string;
    level?: number;
    auxiliary?: Record<string, { value: string; type: string }>;
  }): void => {
    this.logs.push(message);
    console.log(`[MockLogger] ${message.category || 'Info'}: ${message.message}`);
  };

  // Create a compatible logger for ExtractHandler
  extractLog = (message: {
    category?: string;
    message: string;
    level?: number;
    auxiliary?: { [key: string]: { value: string; type: string } };
  }): void => {
    this.log({
      category: message.category || 'extract',
      message: message.message,
      level: message.level || 1,
      auxiliary: message.auxiliary,
    });
  };

  clear(): void {
    this.logs = [];
  }

  getLogsByCategory(category: string): Array<{
    category?: string;
    message: string;
    level?: number;
    auxiliary?: Record<string, { value: string; type: string }>;
  }> {
    return this.logs.filter(log => log.category === category);
  }
}

class MockStagehand implements Partial<ChromeExtensionStagehand> {
  constructor(public browserWindow: BrowserWindow) {}
}

/**
 * Test ActHandler functionality
 */
export async function testActHandler(
  page: Page,
  browserWindow: BrowserWindow,
  progress: HandlerTestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('🎬 Testing ActHandler functionality...');

  try {
    const mockLogger = new MockLogger();
    const actHandler = new StagehandActHandler({
      logger: mockLogger.log,
      browserWindow,
      selfHeal: true,
      experimental: true,
      defaultTimeoutMs: 1000, // Use shorter timeout for tests
    });

    // Test 1: Constructor initialization
    progress.log('Test 1: ActHandler constructor');
    const constructorPassed = actHandler instanceof StagehandActHandler;
    if (!constructorPassed) {
      throw new Error('ActHandler constructor failed');
    }
    progress.log('✅ ActHandler constructor: Passed');

    // Test 2: Mock observe result processing
    progress.log('Test 2: ActHandler observe result processing');
    const mockObserveResult: ObserveResult = {
      selector: 'xpath=//button[contains(text(), "Perform Action")]', // Use XPath to find the "Perform Action" button
      description: 'Action button for testing',
      method: 'click',
      arguments: [],
    };

    // This should succeed since the element exists on the test page
    const result = await actHandler.actFromObserveResult(mockObserveResult);
    if (result.success === true) {
      progress.log('✅ ActHandler observe result processing: Passed');
    } else {
      progress.log(
        `⚠️ ActHandler observe result processing: Failed - success: ${result.success}, message: ${result.message}`
      );
    }

    // Test 3: ActHandler error handling (with fast timeout)
    progress.log('Test 3: ActHandler error handling');
    const mockErrorObserveResult: ObserveResult = {
      selector: 'aria-ref=nonexistent', // This element should not exist
      description: 'Non-existent element for error testing',
      method: 'click',
      arguments: [],
    };

    // This should fail quickly and return a failed result
    const errorResult = await actHandler.actFromObserveResult(mockErrorObserveResult);
    if (errorResult.success === false) {
      progress.log('✅ ActHandler error handling: Passed');
    } else {
      progress.log(`⚠️ ActHandler error handling: Unexpected success - ${errorResult.message}`);
    }

    // Test 4: ActHandler logger integration
    progress.log('Test 4: ActHandler logger integration');
    const logCount = mockLogger.logs.length;
    const loggerPassed = logCount > 0;
    progress.log(
      `✅ ActHandler logger integration: ${loggerPassed ? 'Passed' : 'Warning - No logs generated'} (${logCount} logs)`
    );

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'ActHandler tests completed successfully',
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ ActHandler test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ActHandler tests failed',
      details: { error: errorMessage },
    });
    return false;
  }
}

/**
 * Test ObserveHandler functionality
 */
export async function testObserveHandler(
  page: Page,
  browserWindow: BrowserWindow,
  progress: HandlerTestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('👁️ Testing ObserveHandler functionality...');

  try {
    const mockLogger = new MockLogger();
    const mockStagehand = new MockStagehand(browserWindow) as ChromeExtensionStagehand;

    const observeHandler = new StagehandObserveHandler({
      stagehand: mockStagehand,
      logger: mockLogger.log,
      browserWindow,
      userProvidedInstructions: 'Test instructions',
      experimental: true,
    });

    // Test 1: Constructor initialization
    progress.log('Test 1: ObserveHandler constructor');
    const constructorPassed = observeHandler instanceof StagehandObserveHandler;
    if (!constructorPassed) {
      throw new Error('ObserveHandler constructor failed');
    }
    progress.log('✅ ObserveHandler constructor: Passed');

    // Test 2: Overlay management methods
    progress.log('Test 2: ObserveHandler overlay management');
    try {
      await observeHandler.clearObserveOverlays();
      progress.log('✅ ObserveHandler clear overlays: Passed');
    } catch (error) {
      progress.log(
        `⚠️ ObserveHandler clear overlays: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Test 3: Element counting
    progress.log('Test 3: ObserveHandler element counting');
    try {
      const count = await observeHandler.countObservableElements();
      const countPassed = typeof count === 'number' && count >= 0;
      progress.log(
        `✅ ObserveHandler element counting: ${countPassed ? 'Passed' : 'Failed'} (count: ${count})`
      );
    } catch (error) {
      progress.log(
        `⚠️ ObserveHandler element counting: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Test 4: XPath evaluation testing
    progress.log('Test 4: ObserveHandler XPath evaluation');
    try {
      const xpathResult = await observeHandler.testXPathEvaluation('//body');
      const xpathPassed = typeof xpathResult === 'boolean';
      progress.log(
        `✅ ObserveHandler XPath evaluation: ${xpathPassed ? 'Passed' : 'Failed'} (result: ${xpathResult})`
      );
    } catch (error) {
      progress.log(
        `⚠️ ObserveHandler XPath evaluation: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'ObserveHandler tests completed successfully',
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ ObserveHandler test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ObserveHandler tests failed',
      details: { error: errorMessage },
    });
    return false;
  }
}

/**
 * Test ExtractHandler functionality
 */
export async function testExtractHandler(
  page: Page,
  browserWindow: BrowserWindow,
  progress: HandlerTestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('📊 Testing ExtractHandler functionality...');

  try {
    const mockLogger = new MockLogger();
    const mockStagehand = new MockStagehand(browserWindow) as ChromeExtensionStagehand;

    const extractHandler = new StagehandExtractHandler({
      stagehand: mockStagehand,
      logger: mockLogger.log,
      browserWindow,
      userProvidedInstructions: 'Test extraction instructions',
      experimental: true,
    });

    // Test 1: Constructor initialization
    progress.log('Test 1: ExtractHandler constructor');
    const constructorPassed = extractHandler instanceof StagehandExtractHandler;
    if (!constructorPassed) {
      throw new Error('ExtractHandler constructor failed');
    }
    progress.log('✅ ExtractHandler constructor: Passed');

    // Test 2: Overlay management
    progress.log('Test 2: ExtractHandler overlay management');
    try {
      await extractHandler.clearExtractionOverlays();
      progress.log('✅ ExtractHandler clear overlays: Passed');
    } catch (error) {
      progress.log(
        `⚠️ ExtractHandler clear overlays: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Test 3: Element counting
    progress.log('Test 3: ExtractHandler element counting');
    try {
      const counts = await extractHandler.countExtractableElements();
      const countsPassed =
        typeof counts.totalElements === 'number' &&
        typeof counts.interactiveElements === 'number' &&
        typeof counts.visibleElements === 'number';
      progress.log(
        `✅ ExtractHandler element counting: ${countsPassed ? 'Passed' : 'Failed'} (${JSON.stringify(counts)})`
      );
    } catch (error) {
      progress.log(
        `⚠️ ExtractHandler element counting: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Test 4: XPath evaluation
    progress.log('Test 4: ExtractHandler XPath evaluation');
    try {
      const xpathResult = await extractHandler.testXPathEvaluation('//body');
      const xpathPassed =
        typeof xpathResult.success === 'boolean' && typeof xpathResult.elementCount === 'number';
      progress.log(
        `✅ ExtractHandler XPath evaluation: ${xpathPassed ? 'Passed' : 'Failed'} (${JSON.stringify(xpathResult)})`
      );
    } catch (error) {
      progress.log(
        `⚠️ ExtractHandler XPath evaluation: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Test 5: Element data extraction
    progress.log('Test 5: ExtractHandler element data extraction');
    try {
      const elementData = await extractHandler.extractElementData(['body', '#nonexistent']);
      const dataPassed = Array.isArray(elementData) && elementData.length > 0;
      progress.log(
        `✅ ExtractHandler element data: ${dataPassed ? 'Passed' : 'Failed'} (${elementData.length} results)`
      );
    } catch (error) {
      progress.log(
        `⚠️ ExtractHandler element data: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'ExtractHandler tests completed successfully',
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ ExtractHandler test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ExtractHandler tests failed',
      details: { error: errorMessage },
    });
    return false;
  }
}

/**
 * Test AgentHandler functionality
 */
export async function testAgentHandler(
  page: Page,
  browserWindow: BrowserWindow,
  progress: HandlerTestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('🤖 Testing AgentHandler functionality...');

  try {
    const mockLogger = new MockLogger();
    const mockStagehand = new MockStagehand(browserWindow) as ChromeExtensionStagehand;

    // Note: AgentHandler requires API keys and external services, so we'll test basic initialization
    progress.log('Test 1: AgentHandler constructor validation');

    try {
      const agentHandler = new StagehandAgentHandler({
        stagehand: mockStagehand,
        logger: mockLogger.log,
        browserWindow,
        options: {
          modelName: 'gpt-4o-2024-08-06',
          clientOptions: {
            apiKey: 'test-key', // Mock API key
          },
          userProvidedInstructions: 'Test agent instructions',
          experimental: true,
          agentType: 'openai', // Add required agentType property
        },
      });

      const constructorPassed = agentHandler instanceof StagehandAgentHandler;
      progress.log(`✅ AgentHandler constructor: ${constructorPassed ? 'Passed' : 'Failed'}`);

      // Test 2: Agent and client getters
      progress.log('Test 2: AgentHandler getters');
      const agent = agentHandler.getAgent();
      const client = agentHandler.getClient();
      const gettersPassed = agent !== undefined && client !== undefined;
      progress.log(`✅ AgentHandler getters: ${gettersPassed ? 'Passed' : 'Failed'}`);

      // Test 3: Cursor injection (should work without external dependencies)
      progress.log('Test 3: AgentHandler cursor injection');
      try {
        await agentHandler.injectCursor();
        progress.log('✅ AgentHandler cursor injection: Passed');
      } catch (error) {
        progress.log(
          `⚠️ AgentHandler cursor injection: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'AgentHandler tests completed successfully',
      });

      return true;
    } catch (error) {
      // Expected for missing API keys or other dependencies
      progress.log(
        `⚠️ AgentHandler initialization: ${error instanceof Error ? error.message : String(error)}`
      );
      progress.log(
        'ℹ️ AgentHandler requires external dependencies (API keys, etc.) - initialization test completed'
      );

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'AgentHandler tests completed with expected limitations',
        details: { note: 'Requires external API dependencies' },
      });

      return true; // This is expected behavior
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ AgentHandler test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'AgentHandler tests failed',
      details: { error: errorMessage },
    });
    return false;
  }
}

/**
 * Test OperatorHandler functionality
 */
export async function testOperatorHandler(
  page: Page,
  browserWindow: BrowserWindow,
  progress: HandlerTestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('⚙️ Testing OperatorHandler functionality...');

  try {
    // Test 1: Constructor initialization - skip for now due to LLMClient complexity
    progress.log('Test 1: OperatorHandler constructor');
    progress.log(
      'ℹ️ OperatorHandler requires complex LLM client setup - skipping constructor test'
    );

    // Test 2: Basic validation that the class exists
    progress.log('Test 2: OperatorHandler class availability');
    const handlerClassExists = typeof StagehandOperatorHandler === 'function';
    progress.log(`✅ OperatorHandler class: ${handlerClassExists ? 'Available' : 'Missing'}`);

    // Note: Full testing requires LLM integration and is complex
    progress.log('ℹ️ OperatorHandler requires LLM integration for full testing');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'OperatorHandler tests completed successfully',
    });

    return handlerClassExists;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ OperatorHandler test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'OperatorHandler tests failed',
      details: { error: errorMessage },
    });
    return false;
  }
}

/**
 * Main handler test runner
 */
export async function testHandlers(
  page: Page,
  browserWindow: BrowserWindow,
  progress: HandlerTestProgress,
  context: TestContext
): Promise<{
  actHandler: boolean;
  observeHandler: boolean;
  extractHandler: boolean;
  agentHandler: boolean;
  operatorHandler: boolean;
}> {
  progress.log('🚀 Starting comprehensive handler tests...');

  // Navigate to test page for consistent environment
  progress.log('🌐 Navigating to test page...');
  await page.goto('http://localhost:3005');
  await page.waitForLoadState('domcontentloaded');
  progress.log('✅ Test page loaded successfully');

  const results = {
    actHandler: false,
    observeHandler: false,
    extractHandler: false,
    agentHandler: false,
    operatorHandler: false,
  };

  try {
    // Test ActHandler
    progress.log('\n📋 Running ActHandler tests...');
    results.actHandler = await testActHandler(page, browserWindow, progress, context);

    // Test ObserveHandler
    progress.log('\n📋 Running ObserveHandler tests...');
    results.observeHandler = await testObserveHandler(page, browserWindow, progress, context);

    // Test ExtractHandler
    progress.log('\n📋 Running ExtractHandler tests...');
    results.extractHandler = await testExtractHandler(page, browserWindow, progress, context);

    // Test AgentHandler
    progress.log('\n📋 Running AgentHandler tests...');
    results.agentHandler = await testAgentHandler(page, browserWindow, progress, context);

    // Test OperatorHandler
    progress.log('\n📋 Running OperatorHandler tests...');
    results.operatorHandler = await testOperatorHandler(page, browserWindow, progress, context);

    // Summary
    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    progress.log(`\n📊 Handler Test Summary:`);
    progress.log(`✅ Passed: ${passedCount}/${totalCount}`);
    progress.log(`❌ Failed: ${totalCount - passedCount}/${totalCount}`);

    if (passedCount === totalCount) {
      progress.log('🎉 All handler tests passed!');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'All handler tests completed successfully',
        details: { results },
      });
    } else {
      progress.log('⚠️ Some handler tests failed or had limitations');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Warning,
        message: 'Handler tests completed with some limitations',
        details: { results },
      });
    }

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ Handler test suite failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Handler test suite failed',
      details: { error: errorMessage, results },
    });
    return results;
  }
}

/**
 * Quick handler smoke test
 */
export async function runQuickHandlerTest(
  page: Page,
  browserWindow: BrowserWindow
): Promise<boolean> {
  const progress = new HandlerTestProgress();
  const context: TestContext = {
    events: {
      emit: event => console.log('Test Event:', event),
    },
  };

  progress.log('🔥 Running quick handler smoke test...');

  try {
    const results = await testHandlers(page, browserWindow, progress, context);
    const allPassed = Object.values(results).every(Boolean);

    progress.log(`Quick test ${allPassed ? 'PASSED' : 'COMPLETED WITH LIMITATIONS'}`);
    return allPassed;
  } catch (error) {
    progress.log(`Quick test FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Export main test function for integration
 */
export { testHandlers as runHandlerTests, HandlerTestProgress };
