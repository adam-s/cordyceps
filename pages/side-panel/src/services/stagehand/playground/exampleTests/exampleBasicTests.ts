/**
 * Example Basic Tests - Live Integration Test
 *
 * This test performs the exact same steps as example.ts but within our testing configuration.
 * It uses a real OpenAI LLM agent for live integration testing.
 */

import { TestProgress, TestContext } from '../playgroundTests/types';
import { Severity } from '@src/utils/types';
import { ChromeExtensionStagehand } from '../../lib/index';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';

/**
 * Run the exact same steps as example.ts with live OpenAI integration
 */
export async function testExampleBasicSteps(context: TestContext): Promise<void> {
  const progress = new TestProgress('Example Basic Tests');

  try {
    progress.log('Starting example.ts live integration test...');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting example.ts live integration test with OpenAI...',
      details: {
        testType: 'Live Integration Test',
        example: 'example.ts',
        llm: 'OpenAI GPT-4o-mini',
      },
    });

    // Create browser window for testing
    const browserWindow = await BrowserWindow.create();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🌐 Browser window created successfully',
      details: {
        windowId: browserWindow.windowId,
      },
    });

    // Get OpenAI API key from context (passed from service)
    const apiKey = context.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not found in context. Please configure it in the settings.');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🔑 OpenAI API key received from service context',
      details: {
        keyLength: apiKey.length,
        source: 'service-context',
      },
    });

    // Create Stagehand instance with OpenAI LLM
    const stagehand = new ChromeExtensionStagehand({
      modelName: 'openai/gpt-4o-mini',
      modelClientOptions: {
        apiKey: apiKey,
      },
      verbose: 2,
      enableCaching: false,
      experimental: true,
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🤖 ChromeExtensionStagehand instance created',
    });

    // Initialize Stagehand with browser window
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🔧 Initializing Stagehand with browser window...',
    });

    const initResult = await stagehand.init(browserWindow);

    if (!initResult.success) {
      throw new Error(`Stagehand initialization failed: ${initResult.error}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Stagehand initialized successfully',
      details: {
        currentUrl: initResult.currentUrl,
        isInitialized: stagehand.isInitialized,
      },
    });
    // Perform the exact steps from example.ts:
    // 1. Navigate to https://docs.stagehand.dev
    progress.log('Step 1: Navigating to https://docs.stagehand.dev...');

    await stagehand.goto('https://docs.stagehand.dev');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Navigation completed',
      details: {
        url: 'https://docs.stagehand.dev',
        currentUrl: stagehand.currentUrl,
      },
    });
    // 2. Use AI to click the quickstart button
    progress.log('Step 2: Using AI to click the quickstart button...');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🤖 About to call stagehand.stagehandPage.act...',
      details: {
        hasStagehandPage: !!stagehand.stagehandPage,
        currentUrl: stagehand.currentUrl,
      },
    });

    const actResult = await stagehand.stagehandPage.act('click the quickstart button');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ AI action completed successfully',
      details: {
        action: 'click the quickstart button',
        result: actResult,
        finalUrl: stagehand.currentUrl,
      },
    });

    // Clean up
    await stagehand.close();
    browserWindow.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Example basic test completed successfully',
      details: {
        category: 'live-integration-test',
        example: 'example.ts',
        completedSteps: ['Navigate to https://docs.stagehand.dev', 'AI click on quickstart button'],
        integration: 'OpenAI GPT-4o-mini with Cordyceps',
      },
    });

    progress.log('Example basic test completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Example basic test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Example basic test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}
