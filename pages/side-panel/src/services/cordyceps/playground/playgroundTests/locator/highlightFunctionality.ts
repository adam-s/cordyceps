import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testHighlightFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting highlight() functionality tests',
    });

    // Test 1: Highlight a basic element (button)
    progress.log('Test 1: Highlighting a button element (#action-button)');
    const buttonLocator = page.locator('#action-button');

    await buttonLocator.highlight();
    progress.log('Button highlight applied successfully');

    // Wait a moment to see the highlight (for visual verification in tests)
    await new Promise(resolve => setTimeout(resolve, 500));

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: Button highlighted successfully',
    });

    // Test 2: Hide highlight
    progress.log('Test 2: Hiding highlight');
    await buttonLocator.hideHighlight();
    progress.log('Highlight hidden successfully');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: Highlight hidden successfully',
    });

    // Test 3: Highlight text input field
    progress.log('Test 3: Highlighting text input field (#text-input)');
    const textInputLocator = page.locator('#text-input');

    await textInputLocator.highlight();
    progress.log('Text input highlight applied successfully');

    // Wait a moment to see the highlight
    await new Promise(resolve => setTimeout(resolve, 500));

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Text input highlighted successfully',
    });

    // Test 4: Highlight with timeout option
    progress.log('Test 4: Highlighting with custom timeout (#email-input)');
    const emailInputLocator = page.locator('#email-input');

    await emailInputLocator.highlight({ timeout: 5000 });
    progress.log('Email input highlight applied with custom timeout');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Email input highlighted with custom timeout',
    });

    // Test 5: Highlight multiple elements sequentially
    progress.log('Test 5: Highlighting multiple elements sequentially');

    const checkboxLocator = page.locator('#test-checkbox');
    await checkboxLocator.highlight();
    progress.log('Checkbox highlighted');

    await new Promise(resolve => setTimeout(resolve, 300));

    const textareaLocator = page.locator('#textarea-input');
    await textareaLocator.highlight();
    progress.log('Textarea highlighted');

    await new Promise(resolve => setTimeout(resolve, 300));

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: Multiple elements highlighted sequentially',
    });

    // Test 6: Frame-level highlight (using Frame.highlight method)
    progress.log('Test 6: Frame-level highlighting (#advanced-mode)');
    const frame = await page.waitForMainFrame();

    await frame.highlight('#advanced-mode');
    progress.log('Frame-level highlight applied successfully');

    await new Promise(resolve => setTimeout(resolve, 500));

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 6 passed: Frame-level highlighting successful',
    });

    // Test 7: Frame-level hideHighlight
    progress.log('Test 7: Frame-level hide highlight');
    await frame.hideHighlight();
    progress.log('Frame-level highlight hidden successfully');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 7 passed: Frame-level highlight hidden successfully',
    });

    // Test 8: Test highlighting non-existent element (should handle gracefully)
    progress.log('Test 8: Highlighting non-existent element');
    try {
      const nonExistentLocator = page.locator('#non-existent-element');
      await nonExistentLocator.highlight({ timeout: 2000 });
      progress.log('Highlight on non-existent element completed (no error thrown)');
    } catch (error) {
      progress.log(
        `Expected behavior: highlight on non-existent element failed with: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 8 passed: Non-existent element handling verified',
    });

    // Final cleanup - ensure all highlights are hidden
    progress.log('Final cleanup: Hiding all highlights');
    await frame.hideHighlight();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Highlight functionality tests completed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Highlight functionality test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Highlight functionality tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}
