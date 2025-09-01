import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testDispatchEventFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting dispatchEvent() functionality tests',
    });

    // Test 1: Basic custom event dispatch
    progress.log('Test 1: Dispatching custom event on button (#action-button)');

    // Add custom event handler to verify dispatch
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testCustomEventCount = 0;
      const button = document.getElementById('action-button');
      const handler = (e: Event) => {
        console.log('Custom event fired:', e.type, e);
        ((window as unknown as Record<string, unknown>).testCustomEventCount as number)++;
        console.log(
          'Custom event count:',
          (window as unknown as Record<string, unknown>).testCustomEventCount
        );
      };
      if (button) {
        button.addEventListener('customTest', handler);
        (window as unknown as Record<string, unknown>).testCustomEventHandler = handler;
      }
    }, 'MAIN');

    const actionButtonLocator = page.locator('#action-button');
    await actionButtonLocator.dispatchEvent('customTest', {
      detail: { message: 'Hello from custom event!' },
      bubbles: true,
      cancelable: true,
    });

    // Verify custom event happened
    const customEventCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testCustomEventCount,
        'MAIN'
      );

    if (customEventCount !== 1) {
      throw new Error(`Expected 1 custom event, but got ${customEventCount}`);
    }

    progress.log('Successfully dispatched custom event and verified');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: Basic custom event dispatch successful and verified',
    });

    // Test 2: Dispatch input event with event data
    progress.log('Test 2: Dispatching input event on checkbox (#test-checkbox)');

    // Add input event handler for checkbox
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testInputEventCount = 0;
      const checkbox = document.getElementById('test-checkbox') as HTMLInputElement;
      const handler = (e: Event) => {
        console.log('Input event fired:', e.type, e);
        ((window as unknown as Record<string, unknown>).testInputEventCount as number)++;
        console.log(
          'Input event count:',
          (window as unknown as Record<string, unknown>).testInputEventCount
        );
      };
      if (checkbox) {
        checkbox.addEventListener('input', handler);
        (window as unknown as Record<string, unknown>).testInputEventHandler = handler;
      }
    }, 'MAIN');

    const checkboxLocator = page.locator('#test-checkbox');
    await checkboxLocator.dispatchEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: 'test input',
    });

    // Verify input event happened
    const inputEventCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testInputEventCount,
        'MAIN'
      );

    if (inputEventCount !== 1) {
      throw new Error(`Expected 1 input event, but got ${inputEventCount}`);
    }

    progress.log('Successfully dispatched input event and verified');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: Input event dispatch successful and verified',
    });

    // Test 3: Dispatch focus event
    progress.log('Test 3: Dispatching focus event on toggle button (#toggle-button)');

    // Add focus event handler for toggle button
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testFocusEventCount = 0;
      const button = document.getElementById('toggle-button');
      const handler = (e: Event) => {
        console.log('Focus event fired:', e.type, e);
        ((window as unknown as Record<string, unknown>).testFocusEventCount as number)++;
        console.log(
          'Focus event count:',
          (window as unknown as Record<string, unknown>).testFocusEventCount
        );
      };
      if (button) {
        button.addEventListener('focus', handler);
        (window as unknown as Record<string, unknown>).testFocusEventHandler = handler;
      }
    }, 'MAIN');

    const toggleButtonLocator = page.locator('#toggle-button');
    await toggleButtonLocator.dispatchEvent('focus', {
      bubbles: false, // focus events don't bubble
      cancelable: true,
    });

    // Verify focus event happened
    const focusEventCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testFocusEventCount,
        'MAIN'
      );

    if (focusEventCount !== 1) {
      throw new Error(`Expected 1 focus event, but got ${focusEventCount}`);
    }

    progress.log('Successfully dispatched focus event and verified');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Focus event dispatch successful and verified',
    });

    // Test 4: Page-level dispatchEvent methods
    progress.log('Test 4: Testing page-level dispatchEvent() methods');

    // Reset custom event counter
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testCustomEventCount = 0;
    }, 'MAIN');

    // Use page.dispatchEvent() directly
    await page.dispatchEvent('#action-button', 'customTest', {
      detail: { source: 'page-level' },
      bubbles: true,
    });

    // Verify page-level dispatch
    const pageCustomEventCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testCustomEventCount,
        'MAIN'
      );

    if (pageCustomEventCount !== 1) {
      throw new Error(`Expected 1 page custom event, but got ${pageCustomEventCount}`);
    }

    progress.log('Successfully used page.dispatchEvent() and verified');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Page-level dispatchEvent methods work and verified',
    });

    // Test 5: Frame-level dispatchEvent methods
    progress.log('Test 5: Testing frame-level dispatchEvent() methods');

    // Reset input event counter
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testInputEventCount = 0;
    }, 'MAIN');

    const mainFrame = page.mainFrame();
    await mainFrame.dispatchEvent('#test-checkbox', 'input', {
      bubbles: true,
      inputType: 'insertReplacementText',
    });

    // Verify frame-level dispatch
    const frameInputEventCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testInputEventCount,
        'MAIN'
      );

    if (frameInputEventCount !== 1) {
      throw new Error(`Expected 1 frame input event, but got ${frameInputEventCount}`);
    }

    progress.log('Successfully used frame.dispatchEvent() and verified');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: Frame-level dispatchEvent methods work and verified',
    });

    // Test 6: ElementHandle dispatchEvent (through locator)
    progress.log('Test 6: Testing ElementHandle dispatchEvent through locator');

    // Add keydown event handler for log button
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testKeydownEventCount = 0;
      const button = document.getElementById('log-button');
      const handler = (e: Event) => {
        console.log('Keydown event fired:', e.type, e);
        ((window as unknown as Record<string, unknown>).testKeydownEventCount as number)++;
        console.log(
          'Keydown event count:',
          (window as unknown as Record<string, unknown>).testKeydownEventCount
        );
      };
      if (button) {
        button.addEventListener('keydown', handler);
        (window as unknown as Record<string, unknown>).testKeydownEventHandler = handler;
      }
    }, 'MAIN');

    const logButtonLocator = page.locator('#log-button');
    await logButtonLocator.dispatchEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    });

    // Verify keydown event happened
    const keydownEventCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testKeydownEventCount,
        'MAIN'
      );

    if (keydownEventCount !== 1) {
      throw new Error(`Expected 1 keydown event, but got ${keydownEventCount}`);
    }

    progress.log('Successfully dispatched keydown event through locator and verified');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 6 passed: ElementHandle dispatchEvent through locator successful',
    });

    // Clean up event handlers
    progress.log('Cleaning up event handlers');
    await page.mainFrame().context.executeScript(() => {
      const win = window as unknown as Record<string, unknown>;

      // Remove custom event handlers
      if (win.testCustomEventHandler) {
        const button = document.getElementById('action-button');
        if (button) {
          button.removeEventListener('customTest', win.testCustomEventHandler as EventListener);
        }
      }

      if (win.testInputEventHandler) {
        const checkbox = document.getElementById('test-checkbox');
        if (checkbox) {
          checkbox.removeEventListener('input', win.testInputEventHandler as EventListener);
        }
      }

      if (win.testFocusEventHandler) {
        const button = document.getElementById('toggle-button');
        if (button) {
          button.removeEventListener('focus', win.testFocusEventHandler as EventListener);
        }
      }

      if (win.testKeydownEventHandler) {
        const button = document.getElementById('log-button');
        if (button) {
          button.removeEventListener('keydown', win.testKeydownEventHandler as EventListener);
        }
      }

      // Cleanup counter variables
      delete win.testCustomEventCount;
      delete win.testInputEventCount;
      delete win.testFocusEventCount;
      delete win.testKeydownEventCount;
      delete win.testCustomEventHandler;
      delete win.testInputEventHandler;
      delete win.testFocusEventHandler;
      delete win.testKeydownEventHandler;
    }, 'MAIN');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All dispatchEvent() functionality tests completed successfully',
      details: {
        testsCompleted: [
          'Basic custom event dispatch with event data',
          'Input event dispatch on form elements',
          'Focus event dispatch with proper bubbling settings',
          'Page.dispatchEvent() method verification',
          'Frame.dispatchEvent() method verification',
          'ElementHandle.dispatchEvent() through locator verification',
        ],
      },
    });
  } catch (error) {
    const errorMessage = `DispatchEvent functionality test failed: ${error instanceof Error ? error.message : String(error)}`;
    progress.log(errorMessage);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: errorMessage,
    });
    throw new Error(errorMessage);
  }
}
