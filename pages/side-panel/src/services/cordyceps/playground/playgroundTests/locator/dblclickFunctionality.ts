import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testDblclickFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting dblclick() functionality tests',
    });

    // Test 1: Basic double click on a button
    progress.log('Test 1: Basic double click on button (#action-button)');
    const actionButtonLocator = page.locator('#action-button');

    await actionButtonLocator.dblclick();
    progress.log('Successfully double-clicked the action button');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: Basic button double click successful',
    });

    // Test 2: Double click with options
    progress.log('Test 2: Double click with options on button (#log-button)');
    const logButtonLocator = page.locator('#log-button');

    await logButtonLocator.dblclick({
      position: { x: 15, y: 15 },
      delay: 50,
      force: true,
    });
    progress.log('Successfully double-clicked the log button with options');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: Double click with options successful',
    });

    // Test 3: Page-level double click methods
    progress.log('Test 3: Testing page-level dblclick() methods');

    // Use page.dblclick() directly
    await page.dblclick('#toggle-button');
    progress.log('Successfully used page.dblclick() method');

    await page.dblclick('#action-button', {
      timeout: 15000,
    });
    progress.log('Successfully used page.dblclick() with options');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Page-level dblclick methods work',
    });

    // Test 4: Frame-level double click
    progress.log('Test 4: Testing frame-level dblclick() method');
    const mainFrame = page.mainFrame();

    await mainFrame.dblclick('#log-button', {
      timeout: 10000,
    });
    progress.log('Successfully used frame.dblclick() method');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Frame-level dblclick method works',
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All dblclick() functionality tests completed successfully',
      details: {
        testsCompleted: [
          'Basic Locator.dblclick() on action button',
          'Locator.dblclick() with position, delay, and force options',
          'Page.dblclick() and Page.dblclick() with options',
          'Frame.dblclick() with timeout option',
        ],
      },
    });
  } catch (error) {
    const errorMessage = `Double click functionality test failed: ${error instanceof Error ? error.message : String(error)}`;
    progress.log(errorMessage);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: errorMessage,
    });
    throw new Error(errorMessage);
  }
}
