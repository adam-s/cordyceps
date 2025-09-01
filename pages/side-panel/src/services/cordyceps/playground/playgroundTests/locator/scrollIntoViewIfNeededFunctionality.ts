import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

export async function testScrollIntoViewIfNeededFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting scrollIntoViewIfNeeded functionality tests',
    });

    // Test 1: ElementHandle scrollIntoViewIfNeeded
    progress.log('Test 1: Testing ElementHandle.scrollIntoViewIfNeeded()');
    try {
      // Get an element that might be out of view - try the body first
      const bodyHandle = await page.locator('body').elementHandle();

      if (bodyHandle) {
        await bodyHandle.scrollIntoViewIfNeeded({ timeout: 5000 });
        progress.log('ElementHandle scrollIntoViewIfNeeded completed successfully');

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 1 passed: ElementHandle scrollIntoViewIfNeeded works',
        });

        // Clean up the handle
        bodyHandle.dispose();
      } else {
        throw new Error('Test 1 failed: Could not get element handle for body');
      }
    } catch (error) {
      progress.log(`Test 1 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 1 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 2: Locator scrollIntoViewIfNeeded
    progress.log('Test 2: Testing Locator.scrollIntoViewIfNeeded()');
    try {
      // Use a simple, reliable selector - try to find any button or form element
      const bodyLocator = page.locator('body');
      await bodyLocator.scrollIntoViewIfNeeded({ timeout: 5000 });

      progress.log('Locator scrollIntoViewIfNeeded completed successfully');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Locator scrollIntoViewIfNeeded works',
      });
    } catch (error) {
      progress.log(`Test 2 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 2 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 3: Test with different timeout values
    progress.log('Test 3: Testing scrollIntoViewIfNeeded with custom timeout');
    try {
      const testLocator = page.locator('body');

      // Test with a shorter timeout
      await testLocator.scrollIntoViewIfNeeded({ timeout: 2000 });

      progress.log('Custom timeout scrollIntoViewIfNeeded completed successfully');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: scrollIntoViewIfNeeded with custom timeout works',
      });
    } catch (error) {
      progress.log(`Test 3 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 3 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 4: Test with multiple elements if available
    progress.log('Test 4: Testing scrollIntoViewIfNeeded with different selectors');
    try {
      // Try common selectors that might exist on the page
      const selectors = ['body', 'html', 'div', '*'];
      let successCount = 0;

      for (const selector of selectors) {
        try {
          const locator = page.locator(selector).first(); // Use first() to avoid multiple matches
          await locator.scrollIntoViewIfNeeded({ timeout: 3000 });
          successCount++;
          progress.log(`Successfully scrolled element with selector: ${selector}`);
        } catch (selectorError) {
          progress.log(
            `Selector ${selector} failed: ${selectorError instanceof Error ? selectorError.message : String(selectorError)}`,
          );
          // Continue with other selectors
        }
      }

      if (successCount > 0) {
        progress.log(`Successfully tested ${successCount} out of ${selectors.length} selectors`);
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 4 passed: scrollIntoViewIfNeeded works with multiple selectors',
          details: { successCount, totalSelectors: selectors.length },
        });
      } else {
        throw new Error('Test 4 failed: No selectors worked');
      }
    } catch (error) {
      progress.log(`Test 4 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 4 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 5: Test default timeout behavior
    progress.log('Test 5: Testing scrollIntoViewIfNeeded with default timeout');
    try {
      const defaultLocator = page.locator('body');

      // Test with no options (should use default timeout)
      await defaultLocator.scrollIntoViewIfNeeded();

      progress.log('Default timeout scrollIntoViewIfNeeded completed successfully');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: scrollIntoViewIfNeeded with default timeout works',
      });
    } catch (error) {
      progress.log(`Test 5 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 5 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ScrollIntoViewIfNeeded functionality tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`ScrollIntoViewIfNeeded functionality test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ScrollIntoViewIfNeeded functionality tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}
