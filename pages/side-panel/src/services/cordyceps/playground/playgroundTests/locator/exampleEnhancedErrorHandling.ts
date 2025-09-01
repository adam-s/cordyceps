import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';
import { executeTestWithErrorHandling, assertTestCondition, handleTestError } from './testUtils';

/**
 * Example of enhanced test method using the new error handling utilities
 * This shows how to use the Chrome extension optimized error handling
 */
export async function testExampleWithEnhancedErrorHandling(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting example test with enhanced error handling',
    });

    // Example 1: Using executeTestWithErrorHandling wrapper
    await executeTestWithErrorHandling(
      'getAttribute test',
      async () => {
        const button = page.locator('#action-button');
        const buttonType = await button.getAttribute('type');

        assertTestCondition(
          buttonType === 'button',
          'Button should have type="button"',
          'getAttribute test',
          buttonType,
          'button',
        );

        return buttonType;
      },
      progress,
      context,
      { selector: '#action-button', attribute: 'type' },
    );

    // Example 2: Manual error handling with enhanced context
    try {
      progress.log('Testing hover functionality with enhanced error context');
      const actionButton = page.locator('#action-button');
      await actionButton.hover();

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Hover test passed with enhanced error handling',
      });
    } catch (error) {
      // Use the enhanced error handler
      handleTestError(error, 'Hover functionality test', progress, context);

      // Throw with additional context specific to this test
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';

      throw new Error(
        `Hover functionality test failed: ${errorMessage}\n` +
          `Test context: Testing hover on #action-button\n` +
          `Chrome extension environment: ${globalThis.chrome ? 'Available' : 'Not available'}\n` +
          `Stack trace: ${errorStack}`,
      );
    }

    // Example 3: Using assertion utility with Chrome extension context
    const visibleButton = page.locator('#action-button');
    const isVisible = await visibleButton.isVisible();

    assertTestCondition(
      isVisible === true,
      'Action button should be visible in Chrome extension context',
      'Visibility test',
      isVisible,
      true,
    );

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Enhanced error handling example test completed',
    });
  } catch (error) {
    // Main error handler with Chrome extension specific context
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
    const errorType = error instanceof Error ? error.constructor.name : typeof error;

    // Log comprehensive error information for Chrome extension debugging
    progress.log(`Enhanced error handling example test failed: ${errorMessage}`);
    progress.log(`Error type: ${errorType}`);
    progress.log(`Error stack trace: ${errorStack}`);
    progress.log(
      `Chrome extension context: ${JSON.stringify({
        chromeAvailable: !!globalThis.chrome,
        location: globalThis.location?.href,
        userAgent: globalThis.navigator?.userAgent,
        timestamp: new Date().toISOString(),
      })}`,
    );

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Enhanced error handling example test failed',
      details: {
        error: errorMessage,
        stack: errorStack,
        errorType,
        testContext: 'Example test with enhanced Chrome extension error handling',
        chromeExtensionContext: {
          chromeAvailable: !!globalThis.chrome,
          location: globalThis.location?.href,
          userAgent: globalThis.navigator?.userAgent,
        },
      },
    });

    throw error;
  }
}
