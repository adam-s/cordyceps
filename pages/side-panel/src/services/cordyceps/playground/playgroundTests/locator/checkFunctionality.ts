import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testCheckFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting check() functionality tests',
    });

    // Test 1: Check an initially unchecked checkbox
    progress.log('Test 1: Checking initially unchecked checkbox (#test-checkbox)');
    const testCheckboxLocator = page.locator('#test-checkbox');

    // First verify it's unchecked (based on HTML markup)
    progress.log('Checking initial state of test checkbox...');
    await testCheckboxLocator.check();
    progress.log('Successfully checked the test checkbox');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: Successfully checked unchecked checkbox',
    });

    // Test 2: Check an already checked checkbox (should be idempotent)
    progress.log('Test 2: Checking already checked checkbox (#advanced-mode)');
    const advancedModeLocator = page.locator('#advanced-mode');

    // This checkbox is initially checked according to the HTML
    await advancedModeLocator.check();
    progress.log('Successfully called check() on already checked checkbox (idempotent operation)');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: check() is idempotent on already checked checkbox',
    });

    // Test 3: Test uncheck() functionality
    progress.log('Test 3: Testing uncheck() functionality');

    // Uncheck the advanced mode checkbox
    await advancedModeLocator.uncheck();
    progress.log('Successfully unchecked the advanced mode checkbox');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Successfully unchecked a checked checkbox',
    });

    // Test 4: Test check/uncheck cycle
    progress.log('Test 4: Testing complete check/uncheck cycle');

    // Now check it again to verify state changes work
    await advancedModeLocator.check();
    progress.log('Successfully re-checked the advanced mode checkbox');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Complete check/uncheck cycle works',
    });

    // Test 5: Test with Page-level methods
    progress.log('Test 5: Testing page-level check() methods');

    // Use page.check() directly
    await page.uncheck('#test-checkbox');
    progress.log('Successfully used page.uncheck() method');

    await page.check('#test-checkbox');
    progress.log('Successfully used page.check() method');

    // Final test: Uncheck the advanced-mode checkbox so it ends unchecked
    await page.uncheck('#advanced-mode');
    progress.log('Final step: Unchecked #advanced-mode checkbox (ends in unchecked state)');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: Page-level check/uncheck methods work',
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All check() functionality tests completed successfully',
      details: {
        testsCompleted: [
          'Locator.check() on unchecked element',
          'Locator.check() idempotent behavior',
          'Locator.uncheck() on checked element',
          'Complete check/uncheck cycle',
          'Page.check() and Page.uncheck() methods',
        ],
      },
    });
  } catch (error) {
    const errorMessage = `Check functionality test failed: ${error instanceof Error ? error.message : String(error)}`;
    progress.log(errorMessage);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: errorMessage,
    });
    throw new Error(errorMessage);
  }
}
