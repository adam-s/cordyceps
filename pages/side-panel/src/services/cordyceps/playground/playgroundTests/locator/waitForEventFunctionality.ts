import { Severity } from '@src/utils/types';
import { Progress } from '../../../core/progress';
import { Page } from '../../../page';
import { TestContext } from '../api';

/**
 * Test Page.waitForEvent() functionality with various events.
 * Tests both the public API and internal _waitForEvent with progress.
 */
export async function testWaitForEventFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  progress.log('🧪 Testing Page.waitForEvent() functionality');

  // Test 1: Wait for a load event
  progress.log('Test 1: Testing waitForEvent with load event');
  try {
    // Navigate to trigger a load event
    const origin = await page.evaluate(() => window.location.origin);

    // Start waiting for load event before navigation
    const loadEventPromise = page.waitForEvent('load', { timeout: 5000 });

    // Navigate to trigger the event
    await page.goto(`${origin}/`, { waitUntil: 'load' });

    // Wait for the event
    const loadEvent = await loadEventPromise;

    progress.log('✅ Load event received successfully');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'waitForEvent with load event test passed',
      details: { eventReceived: !!loadEvent },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ Load event test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'waitForEvent with load event test failed',
      details: { error: errorMessage },
    });
  }

  // Test 2: Wait for a domcontentloaded event (replacing removed request event test)
  progress.log('Test 2: Testing waitForEvent with domcontentloaded event');
  try {
    // Start waiting for domcontentloaded event
    const domContentLoadedPromise = page.waitForEvent('domcontentloaded', {
      timeout: 5000,
    });

    // Trigger a navigation to cause domcontentloaded event
    await page.goto('http://localhost:3005/');

    // Wait for the event
    const domEvent = await domContentLoadedPromise;

    progress.log('✅ DOMContentLoaded event received successfully');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'waitForEvent with domcontentloaded event test passed',
      details: { eventReceived: !!domEvent },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ DOMContentLoaded event test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'waitForEvent with domcontentloaded event test failed',
      details: { error: errorMessage },
    });
  }

  // Test 3: Test with predicate function (functional style)
  progress.log('Test 3: Testing waitForEvent with predicate function');
  try {
    // Use functional style with predicate
    const domContentLoadedPromise = page.waitForEvent('domcontentloaded', (eventArg: unknown) => {
      // Simple predicate that always returns true for testing
      return typeof eventArg === 'object' && eventArg !== null;
    });

    // Navigate to a different page to trigger domcontentloaded (avoid same-page navigation issues)
    await page.goto('http://localhost:3005/iframe1', { waitUntil: 'domcontentloaded' });

    const domEvent = await domContentLoadedPromise;

    progress.log('✅ DOMContentLoaded event with predicate received successfully');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'waitForEvent with predicate function test passed',
      details: { eventReceived: !!domEvent },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ DOMContentLoaded with predicate test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'waitForEvent with predicate function test failed',
      details: { error: errorMessage },
    });
  }

  // Test 4: Test internal _waitForEvent with progress (using domcontentloaded to avoid navigation conflicts)
  progress.log('Test 4: Testing internal _waitForEvent with progress');
  try {
    // Small delay to ensure previous navigation is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test internal API with progress controller using a safe event
    const domContentLoadedPromise = page._waitForEvent(
      'domcontentloaded',
      { timeout: 5000 },
      progress
    );

    // Navigate to trigger domcontentloaded event (use a simple navigation to avoid conflicts)
    await page.goto('http://localhost:3005/iframe2', { waitUntil: 'domcontentloaded' });

    const domEvent = await domContentLoadedPromise;

    progress.log('✅ DOMContentLoaded event with progress received successfully');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '_waitForEvent with progress test passed',
      details: { eventReceived: !!domEvent },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ DOMContentLoaded with progress test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '_waitForEvent with progress test failed',
      details: { error: errorMessage },
    });
  }

  // Test 5: Test timeout behavior
  progress.log('Test 5: Testing waitForEvent timeout behavior');
  try {
    // This should timeout since we're waiting for an event that won't occur
    await page.waitForEvent('framedetached', { timeout: 1000 });

    // If we reach here, the test failed because it should have timed out
    progress.log('❌ Timeout test failed - event unexpectedly resolved');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'waitForEvent timeout test failed - should have timed out',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Timeout') && errorMessage.includes('exceeded')) {
      progress.log('✅ Timeout behavior working correctly');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'waitForEvent timeout test passed',
        details: { expectedTimeout: true },
      });
    } else {
      progress.log(`❌ Timeout test failed with unexpected error: ${errorMessage}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'waitForEvent timeout test failed with unexpected error',
        details: { error: errorMessage },
      });
    }
  }

  // Test 6: Test unknown event error handling
  progress.log('Test 6: Testing waitForEvent with unknown event');
  try {
    await page.waitForEvent('unknownevent', { timeout: 1000 });

    // If we reach here, the test failed
    progress.log('❌ Unknown event test failed - should have thrown error');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'waitForEvent unknown event test failed - should have thrown error',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Unknown event')) {
      progress.log('✅ Unknown event error handling working correctly');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'waitForEvent unknown event test passed',
        details: { expectedError: true },
      });
    } else {
      progress.log(`❌ Unknown event test failed with unexpected error: ${errorMessage}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'waitForEvent unknown event test failed with unexpected error',
        details: { error: errorMessage },
      });
    }
  }

  progress.log('🎯 Page.waitForEvent() functionality tests completed');
}
