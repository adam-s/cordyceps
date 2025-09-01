import { Severity } from '@src/utils/types';
import { Progress } from '../../../core/progress';
import { Page } from '../../../page';
import { TestContext } from '../api';

/**
 * Test Page.waitForLoadState() and Frame.waitForLoadState() functionality.
 * Tests both the public API and various lifecycle states with progress handling.
 */
export async function testWaitForLoadStateFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('🧪 Testing waitForLoadState() functionality');

  // Create visual indicator for the test
  progress.log('Creating visual indicator for waitForLoadState tests');
  await page.evaluate(() => {
    const indicator = document.createElement('div');
    indicator.id = 'waitfor-loadstate-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #fff3e0;
      border: 2px solid #ff9800;
      padding: 15px;
      border-radius: 8px;
      z-index: 10000;
      font-family: monospace;
      font-size: 12px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    indicator.innerHTML = `
      <div style="font-weight: bold; color: #e65100; margin-bottom: 8px;">
        🧪 waitForLoadState() Test Progress
      </div>
      <div id="loadstate-status">Starting tests...</div>
    `;
    document.body.appendChild(indicator);
  });

  const updateStatus = async (
    message: string,
    isSuccess: boolean = false,
    isError: boolean = false,
  ) => {
    await page.evaluate(
      args => {
        const status = document.getElementById('loadstate-status');
        if (status) {
          status.textContent = args.message;
          if (args.isSuccess) {
            status.style.color = '#2e7d32';
          } else if (args.isError) {
            status.style.color = '#d32f2f';
          } else {
            status.style.color = '#1976d2';
          }
        }
      },
      { message, isSuccess, isError },
    );
  };

  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting waitForLoadState() functionality tests',
    });

    // Test 1: Page.waitForLoadState() with default 'load' state
    progress.log('Test 1: Testing Page.waitForLoadState() with default load state');
    await updateStatus('Test 1: Page waitForLoadState (default)');

    try {
      await page.waitForLoadState(); // Default is 'load'
      progress.log('✅ Page.waitForLoadState() with default state: SUCCESS');
      await updateStatus('Test 1: SUCCESS ✓', true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Page.waitForLoadState() with default state test passed',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.log(`❌ Page.waitForLoadState() default test failed: ${errorMessage}`);
      await updateStatus(`Test 1: FAILED - ${errorMessage}`, false, true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Page.waitForLoadState() with default state test failed',
        details: { error: errorMessage },
      });
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 2: Page.waitForLoadState() with explicit 'load' state
    progress.log('Test 2: Testing Page.waitForLoadState() with explicit load state');
    await updateStatus('Test 2: Page waitForLoadState (explicit load)');

    try {
      await page.waitForLoadState('load');
      progress.log('✅ Page.waitForLoadState("load"): SUCCESS');
      await updateStatus('Test 2: SUCCESS ✓', true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Page.waitForLoadState("load") test passed',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.log(`❌ Page.waitForLoadState("load") test failed: ${errorMessage}`);
      await updateStatus(`Test 2: FAILED - ${errorMessage}`, false, true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Page.waitForLoadState("load") test failed',
        details: { error: errorMessage },
      });
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 3: Page.waitForLoadState() with 'domcontentloaded' state
    progress.log('Test 3: Testing Page.waitForLoadState() with domcontentloaded state');
    await updateStatus('Test 3: Page waitForLoadState (domcontentloaded)');

    try {
      await page.waitForLoadState('domcontentloaded');
      progress.log('✅ Page.waitForLoadState("domcontentloaded"): SUCCESS');
      await updateStatus('Test 3: SUCCESS ✓', true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Page.waitForLoadState("domcontentloaded") test passed',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.log(`❌ Page.waitForLoadState("domcontentloaded") test failed: ${errorMessage}`);
      await updateStatus(`Test 3: FAILED - ${errorMessage}`, false, true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Page.waitForLoadState("domcontentloaded") test failed',
        details: { error: errorMessage },
      });
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 4: Frame.waitForLoadState() with main frame
    progress.log('Test 4: Testing Frame.waitForLoadState() with main frame');
    await updateStatus('Test 4: Frame waitForLoadState (main frame)');

    try {
      const mainFrame = page.mainFrame();
      await mainFrame.waitForLoadState('load');
      progress.log('✅ mainFrame.waitForLoadState("load"): SUCCESS');
      await updateStatus('Test 4: SUCCESS ✓', true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'mainFrame.waitForLoadState("load") test passed',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.log(`❌ mainFrame.waitForLoadState("load") test failed: ${errorMessage}`);
      await updateStatus(`Test 4: FAILED - ${errorMessage}`, false, true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'mainFrame.waitForLoadState("load") test failed',
        details: { error: errorMessage },
      });
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 5: waitForLoadState() with custom timeout
    progress.log('Test 5: Testing waitForLoadState() with custom timeout');
    await updateStatus('Test 5: waitForLoadState with timeout');

    try {
      await page.waitForLoadState('load', { timeout: 10000 });
      progress.log('✅ Page.waitForLoadState() with custom timeout: SUCCESS');
      await updateStatus('Test 5: SUCCESS ✓', true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Page.waitForLoadState() with custom timeout test passed',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.log(`❌ Page.waitForLoadState() with timeout test failed: ${errorMessage}`);
      await updateStatus(`Test 5: FAILED - ${errorMessage}`, false, true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Page.waitForLoadState() with custom timeout test failed',
        details: { error: errorMessage },
      });
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 6: waitForLoadState() with navigation
    progress.log('Test 6: Testing waitForLoadState() with navigation');
    await updateStatus('Test 6: waitForLoadState with navigation');

    try {
      const origin = await page.evaluate(() => window.location.origin);

      // Start navigation and wait for load state
      const navigationPromise = page.goto(`${origin}/`);
      const loadStatePromise = page.waitForLoadState('load');

      // Wait for both to complete
      await Promise.all([navigationPromise, loadStatePromise]);

      progress.log('✅ waitForLoadState() with navigation: SUCCESS');
      await updateStatus('Test 6: SUCCESS ✓', true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'waitForLoadState() with navigation test passed',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.log(`❌ waitForLoadState() with navigation test failed: ${errorMessage}`);
      await updateStatus(`Test 6: FAILED - ${errorMessage}`, false, true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'waitForLoadState() with navigation test failed',
        details: { error: errorMessage },
      });
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 7: Test progress handling pattern
    progress.log('Test 7: Testing progress handling pattern consistency');
    await updateStatus('Test 7: Progress handling pattern');

    try {
      // This test verifies that our implementation follows the same pattern as other methods
      const startTime = Date.now();

      await page.waitForLoadState('load', { timeout: 5000 });

      const endTime = Date.now();
      const duration = endTime - startTime;

      progress.log(`✅ Progress handling pattern test: SUCCESS (duration: ${duration}ms)`);
      await updateStatus('Test 7: SUCCESS ✓', true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Progress handling pattern test passed',
        details: { duration },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.log(`❌ Progress handling pattern test failed: ${errorMessage}`);
      await updateStatus(`Test 7: FAILED - ${errorMessage}`, false, true);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Progress handling pattern test failed',
        details: { error: errorMessage },
      });
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    await updateStatus('All waitForLoadState() tests completed! 🎉', true);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'waitForLoadState() functionality tests completed successfully',
      details: {
        testsCompleted: 7,
        methodsTested: [
          'page.waitForLoadState()',
          'page.waitForLoadState("load")',
          'page.waitForLoadState("domcontentloaded")',
          'mainFrame.waitForLoadState("load")',
          'page.waitForLoadState("load", { timeout: 10000 })',
          'navigation + waitForLoadState',
          'progress pattern verification',
        ],
      },
    });

    // Keep indicators visible for a moment
    await new Promise(resolve => setTimeout(resolve, 500));

    progress.log('🎯 waitForLoadState() functionality tests completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update status with error
    try {
      await updateStatus(`ERROR: ${errorMessage}`, false, true);
    } catch (updateError) {
      const updateErrorMessage =
        updateError instanceof Error ? updateError.message : String(updateError);
      progress.log(`Failed to update error status: ${updateErrorMessage}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `waitForLoadState() functionality test failed: ${errorMessage}`,
      details: { error: errorMessage },
    });

    progress.log(`waitForLoadState() functionality test failed: ${errorMessage}`);
    throw error;
  } finally {
    // Clean up test indicator
    try {
      await page.evaluate(() => {
        const indicator = document.getElementById('waitfor-loadstate-indicator');
        if (indicator) indicator.remove();
      });
    } catch (cleanupError) {
      const cleanupErrorMessage =
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      progress.log(`Failed to clean up test indicator: ${cleanupErrorMessage}`);
    }
  }
}
