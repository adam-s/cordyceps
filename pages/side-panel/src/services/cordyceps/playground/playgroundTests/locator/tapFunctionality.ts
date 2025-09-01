import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testTapFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting tap() functionality tests',
    });

    // Set up event listeners to capture and verify touch/tap events
    progress.log('Setting up event listeners to capture tap events');
    await page.mainFrame().context.executeScript(() => {
      const win = window as unknown as Record<string, unknown>;

      // Initialize event counters
      win.tapEventCounts = {
        touchstart: 0,
        touchend: 0,
        click: 0,
        actionButtonTaps: 0,
        toggleButtonTaps: 0,
        logButtonTaps: 0,
      };

      // Set up event listeners for action button
      const actionButton = document.getElementById('action-button');
      if (actionButton) {
        const actionTouchStartHandler = (e: TouchEvent) => {
          console.log('TouchStart event fired on action button:', e);
          (win.tapEventCounts as Record<string, number>).touchstart++;
          (win.tapEventCounts as Record<string, number>).actionButtonTaps++;
        };
        const actionTouchEndHandler = (e: TouchEvent) => {
          console.log('TouchEnd event fired on action button:', e);
          (win.tapEventCounts as Record<string, number>).touchend++;
        };
        const actionClickHandler = (e: MouseEvent) => {
          console.log('Click event fired on action button:', e);
          (win.tapEventCounts as Record<string, number>).click++;
        };

        actionButton.addEventListener('touchstart', actionTouchStartHandler);
        actionButton.addEventListener('touchend', actionTouchEndHandler);
        actionButton.addEventListener('click', actionClickHandler);

        // Store handlers for cleanup
        win.actionTouchStartHandler = actionTouchStartHandler;
        win.actionTouchEndHandler = actionTouchEndHandler;
        win.actionClickHandler = actionClickHandler;
      }

      // Set up event listeners for toggle button
      const toggleButton = document.getElementById('toggle-button');
      if (toggleButton) {
        const toggleTouchStartHandler = (e: TouchEvent) => {
          console.log('TouchStart event fired on toggle button:', e);
          (win.tapEventCounts as Record<string, number>).touchstart++;
          (win.tapEventCounts as Record<string, number>).toggleButtonTaps++;
        };
        const toggleTouchEndHandler = (e: TouchEvent) => {
          console.log('TouchEnd event fired on toggle button:', e);
          (win.tapEventCounts as Record<string, number>).touchend++;
        };
        const toggleClickHandler = (e: MouseEvent) => {
          console.log('Click event fired on toggle button:', e);
          (win.tapEventCounts as Record<string, number>).click++;
        };

        toggleButton.addEventListener('touchstart', toggleTouchStartHandler);
        toggleButton.addEventListener('touchend', toggleTouchEndHandler);
        toggleButton.addEventListener('click', toggleClickHandler);

        // Store handlers for cleanup
        win.toggleTouchStartHandler = toggleTouchStartHandler;
        win.toggleTouchEndHandler = toggleTouchEndHandler;
        win.toggleClickHandler = toggleClickHandler;
      }

      // Set up event listeners for log button
      const logButton = document.getElementById('log-button');
      if (logButton) {
        const logTouchStartHandler = (e: TouchEvent) => {
          console.log('TouchStart event fired on log button:', e);
          (win.tapEventCounts as Record<string, number>).touchstart++;
          (win.tapEventCounts as Record<string, number>).logButtonTaps++;
        };
        const logTouchEndHandler = (e: TouchEvent) => {
          console.log('TouchEnd event fired on log button:', e);
          (win.tapEventCounts as Record<string, number>).touchend++;
        };
        const logClickHandler = (e: MouseEvent) => {
          console.log('Click event fired on log button:', e);
          (win.tapEventCounts as Record<string, number>).click++;
        };

        logButton.addEventListener('touchstart', logTouchStartHandler);
        logButton.addEventListener('touchend', logTouchEndHandler);
        logButton.addEventListener('click', logClickHandler);

        // Store handlers for cleanup
        win.logTouchStartHandler = logTouchStartHandler;
        win.logTouchEndHandler = logTouchEndHandler;
        win.logClickHandler = logClickHandler;
      }

      console.log('Event listeners set up for tap testing');
    }, 'MAIN');

    // Test 1: Basic tap on locator
    progress.log('Test 1: Basic tap on locator (#action-button)');
    const tapButtonLocator = page.locator('#action-button');
    await tapButtonLocator.tap();
    progress.log('Successfully tapped the action button via locator');

    // Verify the tap events were fired
    const test1Events = await page.mainFrame().context.executeScript(() => {
      const win = window as unknown as Record<string, unknown>;
      return win.tapEventCounts as Record<string, number>;
    }, 'MAIN');

    progress.log(`Test 1 - Events captured: ${JSON.stringify(test1Events)}`);

    if (test1Events && test1Events.actionButtonTaps >= 1) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Basic locator tap successful and verified',
        details: { eventsCaptures: test1Events },
      });
    } else {
      throw new Error(
        `Test 1 failed: Expected action button tap events, got: ${JSON.stringify(test1Events)}`
      );
    }

    // Test 2: Tap with options
    progress.log('Test 2: Tap with options on button (#action-button)');
    await tapButtonLocator.tap({
      position: { x: 10, y: 10 },
      force: true,
    });
    progress.log('Successfully tapped the action button with options');

    // Verify the tap events were fired for test 2
    const test2Events = await page.mainFrame().context.executeScript(() => {
      const win = window as unknown as Record<string, unknown>;
      return win.tapEventCounts as Record<string, number>;
    }, 'MAIN');

    progress.log(`Test 2 - Events captured: ${JSON.stringify(test2Events)}`);

    if (test2Events && test2Events.actionButtonTaps >= 2) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Tap with options successful and verified',
        details: { eventsCaptures: test2Events },
      });
    } else {
      throw new Error(
        `Test 2 failed: Expected at least 2 action button taps, got: ${JSON.stringify(test2Events)}`
      );
    }

    // Test 3: Page-level tap
    progress.log('Test 3: Testing page-level tap() method');
    await page.tap('#toggle-button');
    progress.log('Successfully used page.tap() method');

    // Verify the tap events were fired for test 3
    const test3Events = await page.mainFrame().context.executeScript(() => {
      const win = window as unknown as Record<string, unknown>;
      return win.tapEventCounts as Record<string, number>;
    }, 'MAIN');

    progress.log(`Test 3 - Events captured: ${JSON.stringify(test3Events)}`);

    if (test3Events && test3Events.toggleButtonTaps >= 1) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Page-level tap successful and verified',
        details: { eventsCaptures: test3Events },
      });
    } else {
      throw new Error(
        `Test 3 failed: Expected toggle button tap events, got: ${JSON.stringify(test3Events)}`
      );
    }

    // Test 4: Frame-level tap
    progress.log('Test 4: Testing frame-level tap() method');
    const frameForTap = page.mainFrame();
    await frameForTap.tap('#log-button');
    progress.log('Successfully used frame.tap() method');

    // Verify the tap events were fired for test 4
    const test4Events = await page.mainFrame().context.executeScript(() => {
      const win = window as unknown as Record<string, unknown>;
      return win.tapEventCounts as Record<string, number>;
    }, 'MAIN');

    progress.log(`Test 4 - Events captured: ${JSON.stringify(test4Events)}`);

    if (test4Events && test4Events.logButtonTaps >= 1) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Frame-level tap successful and verified',
        details: { eventsCaptures: test4Events },
      });
    } else {
      throw new Error(
        `Test 4 failed: Expected log button tap events, got: ${JSON.stringify(test4Events)}`
      );
    }

    // Test 5: Tap with timeout option
    progress.log('Test 5: Testing tap with timeout option');
    await page.tap('#action-button', {
      timeout: 15000,
    });
    progress.log('Successfully used tap with timeout option');

    // Verify the tap events were fired for test 5
    const test5Events = await page.mainFrame().context.executeScript(() => {
      const win = window as unknown as Record<string, unknown>;
      return win.tapEventCounts as Record<string, number>;
    }, 'MAIN');

    progress.log(`Test 5 - Events captured: ${JSON.stringify(test5Events)}`);

    if (test5Events && test5Events.actionButtonTaps >= 3) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: Tap with timeout successful and verified',
        details: { eventsCaptures: test5Events },
      });
    } else {
      throw new Error(
        `Test 5 failed: Expected at least 3 action button taps, got: ${JSON.stringify(test5Events)}`
      );
    }

    // Clean up event listeners
    progress.log('Cleaning up event listeners');
    await page.mainFrame().context.executeScript(() => {
      const win = window as unknown as Record<string, unknown>;

      // Remove action button listeners
      const actionButton = document.getElementById('action-button');
      if (actionButton && win.actionTouchStartHandler) {
        actionButton.removeEventListener(
          'touchstart',
          win.actionTouchStartHandler as EventListener
        );
        actionButton.removeEventListener('touchend', win.actionTouchEndHandler as EventListener);
        actionButton.removeEventListener('click', win.actionClickHandler as EventListener);
      }

      // Remove toggle button listeners
      const toggleButton = document.getElementById('toggle-button');
      if (toggleButton && win.toggleTouchStartHandler) {
        toggleButton.removeEventListener(
          'touchstart',
          win.toggleTouchStartHandler as EventListener
        );
        toggleButton.removeEventListener('touchend', win.toggleTouchEndHandler as EventListener);
        toggleButton.removeEventListener('click', win.toggleClickHandler as EventListener);
      }

      // Remove log button listeners
      const logButton = document.getElementById('log-button');
      if (logButton && win.logTouchStartHandler) {
        logButton.removeEventListener('touchstart', win.logTouchStartHandler as EventListener);
        logButton.removeEventListener('touchend', win.logTouchEndHandler as EventListener);
        logButton.removeEventListener('click', win.logClickHandler as EventListener);
      }

      // Clean up stored references
      delete win.tapEventCounts;
      delete win.actionTouchStartHandler;
      delete win.actionTouchEndHandler;
      delete win.actionClickHandler;
      delete win.toggleTouchStartHandler;
      delete win.toggleTouchEndHandler;
      delete win.toggleClickHandler;
      delete win.logTouchStartHandler;
      delete win.logTouchEndHandler;
      delete win.logClickHandler;

      console.log('Event listeners cleaned up');
    }, 'MAIN');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All tap() functionality tests completed successfully with event verification',
      details: {
        testsCompleted: [
          'Basic Locator.tap() on action button with event capture',
          'Locator.tap() with position and force options with event capture',
          'Page.tap() method with event capture',
          'Frame.tap() method with event capture',
          'Tap with timeout option with event capture',
        ],
        finalEventCounts: test5Events,
      },
    });
  } catch (error) {
    const errorMessage = `Tap functionality test failed: ${error instanceof Error ? error.message : String(error)}`;
    progress.log(errorMessage);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: errorMessage,
    });
    throw new Error(errorMessage);
  }
}
