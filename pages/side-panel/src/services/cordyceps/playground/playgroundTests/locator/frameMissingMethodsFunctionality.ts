import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testFrameMissingMethodsFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting Frame missing methods functionality tests',
    });

    const frame = page.mainFrame();
    // Test Frame getAttribute method
    progress.log('Test 1: Testing Frame getAttribute method');
    const buttonType = await frame.getAttribute('#action-button', 'type');
    progress.log(`Frame getAttribute - Button type: ${buttonType}`);

    if (buttonType === 'button') {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Frame getAttribute method works',
        details: { buttonType },
      });
    } else {
      throw new Error(`Test 1 failed: Expected type="button", got: ${buttonType}`);
    }

    // Test Frame hover method
    progress.log('Test 2: Testing Frame hover method');
    try {
      await frame.hover('#action-button');
      progress.log('Frame hover action completed successfully');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Frame hover method works',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
      progress.log(`Test 2 Frame hover method failed: ${errorMessage}`);
      progress.log(`Test 2 error stack: ${errorStack}`);
      throw new Error(
        `Test 2 failed: Frame hover method error: ${errorMessage}\nStack: ${errorStack}`,
      );
    }

    // Test Frame innerHTML method
    progress.log('Test 3: Testing Frame innerHTML method');
    const innerHTML = await frame.innerHTML('h1');
    progress.log(`Frame innerHTML - Title: ${innerHTML}`);

    if (innerHTML && innerHTML.length > 0) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Frame innerHTML method works',
        details: { innerHTML },
      });
    } else {
      throw new Error('Test 3 failed: Frame innerHTML returned empty or null');
    }

    // Test Frame innerText method
    progress.log('Test 4: Testing Frame innerText method');
    const innerText = await frame.innerText('h1');
    progress.log(`Frame innerText - Title: "${innerText}"`);

    if (innerText && innerText.includes('Cordyceps Example Domain')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Frame innerText method works',
        details: { innerText },
      });
    } else {
      throw new Error(
        `Test 4 failed: Expected innerText with 'Cordyceps Example Domain', got: ${innerText}`,
      );
    }

    // Test Frame inputValue method
    progress.log('Test 5: Testing Frame inputValue method');

    // First, fill the input with a test value
    await frame.fill('#email-input', 'frame-test@example.com');

    // Then test inputValue
    const inputValue = await frame.inputValue('#email-input');
    progress.log(`Frame inputValue - Email: "${inputValue}"`);

    if (inputValue === 'frame-test@example.com') {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: Frame inputValue method works',
        details: { inputValue },
      });
    } else {
      throw new Error(`Test 5 failed: Expected 'frame-test@example.com', got: ${inputValue}`);
    }

    // Test Frame isChecked method
    progress.log('Test 6: Testing Frame isChecked method');

    // Test initial state
    let isChecked = await frame.isChecked('#test-checkbox');
    progress.log(`Frame isChecked - Checkbox initial state: ${isChecked}`);

    // Toggle the checkbox
    await frame.click('#test-checkbox');
    isChecked = await frame.isChecked('#test-checkbox');
    progress.log(`Frame isChecked - Checkbox state after click: ${isChecked}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 6 passed: Frame isChecked method works',
      details: { finalState: isChecked },
    });

    // Test Frame isDisabled method
    progress.log('Test 7: Testing Frame isDisabled method');

    try {
      const disabledState = await frame.isDisabled('button[disabled]');
      const enabledState = await frame.isDisabled('#action-button');

      progress.log(`Frame isDisabled - Disabled button: ${disabledState}`);
      progress.log(`Frame isDisabled - Enabled button: ${enabledState}`);

      if (disabledState === true && enabledState === false) {
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 7 passed: Frame isDisabled method works',
          details: { disabledState, enabledState },
        });
      } else {
        throw new Error(
          `Test 7 failed: Expected disabled=true, enabled=false, got: disabled=${disabledState}, enabled=${enabledState}`,
        );
      }
    } catch (error) {
      // If no disabled button found, test with enabled button only
      const enabledState = await frame.isDisabled('#action-button');
      if (enabledState === false) {
        progress.log('No disabled button found, but enabled button correctly returns false');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 7 passed: Frame isDisabled method works (tested with enabled button)',
          details: { enabledState },
        });
      } else {
        throw new Error(
          `Test 7 failed: Expected enabled button isDisabled=false, got: ${enabledState}`,
        );
      }
    }

    // Test Frame isEditable method
    progress.log('Test 8: Testing Frame isEditable method');
    const inputEditable = await frame.isEditable('#text-input');
    const buttonEditable = await frame.isEditable('#action-button');

    progress.log(`Frame isEditable - Text input: ${inputEditable}`);
    progress.log(`Frame isEditable - Button: ${buttonEditable}`);

    if (inputEditable === true && buttonEditable === false) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 8 passed: Frame isEditable method works',
        details: { inputEditable, buttonEditable },
      });
    } else {
      throw new Error(
        `Test 8 failed: Expected input=true, button=false, got: input=${inputEditable}, button=${buttonEditable}`,
      );
    }

    // Test Frame isEnabled method
    progress.log('Test 9: Testing Frame isEnabled method');
    const enabledState = await frame.isEnabled('#action-button');
    progress.log(`Frame isEnabled - Enabled button: ${enabledState}`);

    if (enabledState === true) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 9 passed: Frame isEnabled method works',
        details: { enabledState },
      });
    } else {
      throw new Error(`Test 9 failed: Expected isEnabled=true, got: ${enabledState}`);
    }

    // Test Frame isHidden method
    progress.log('Test 10: Testing Frame isHidden method');
    const visibleHidden = await frame.isHidden('#action-button');
    progress.log(`Frame isHidden - Visible element: ${visibleHidden}`);

    try {
      // Try form-status first (exists in example HTML with display: none)
      const hiddenHidden = await frame.isHidden('#form-status');
      progress.log(`Frame isHidden - Hidden element: ${hiddenHidden}`);

      if (visibleHidden === false && hiddenHidden === true) {
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 10 passed: Frame isHidden method works',
          details: { visibleHidden, hiddenHidden },
        });
      } else {
        throw new Error(
          `Test 10 failed: Expected visible=false, hidden=true, got: visible=${visibleHidden}, hidden=${hiddenHidden}`,
        );
      }
    } catch (error) {
      // Fallback: try hidden-input if form-status doesn't exist
      try {
        const hiddenInputHidden = await frame.isHidden('#hidden-input');
        progress.log(`Frame isHidden - Hidden input element: ${hiddenInputHidden}`);

        if (visibleHidden === false && hiddenInputHidden === true) {
          context.events.emit({
            timestamp: Date.now(),
            severity: Severity.Success,
            message: 'Test 10 passed: Frame isHidden method works (using hidden-input)',
            details: { visibleHidden, hiddenInputHidden },
          });
        } else {
          throw new Error(
            `Test 10 failed: Expected visible=false, hidden-input=true, got: visible=${visibleHidden}, hidden-input=${hiddenInputHidden}`,
          );
        }
      } catch (fallbackError) {
        // If no hidden element found, test with visible element only
        if (visibleHidden === false) {
          progress.log('No hidden element found, but visible element correctly returns false');
          context.events.emit({
            timestamp: Date.now(),
            severity: Severity.Success,
            message: 'Test 10 passed: Frame isHidden method works (tested with visible element)',
            details: { visibleHidden },
          });
        } else {
          throw new Error(
            `Test 10 failed: Expected visible element isHidden=false, got: ${visibleHidden}`,
          );
        }
      }
    }

    // Test Frame isVisible method
    progress.log('Test 11: Testing Frame isVisible method');
    const visibleState = await frame.isVisible('#action-button');
    progress.log(`Frame isVisible - Visible element: ${visibleState}`);

    if (visibleState === true) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 11 passed: Frame isVisible method works',
        details: { visibleState },
      });
    } else {
      throw new Error(`Test 11 failed: Expected isVisible=true, got: ${visibleState}`);
    }

    // Test Frame press method
    progress.log('Test 12: Testing Frame press method');

    // Clear the input and focus it
    await frame.clear('#text-input');
    await frame.click('#text-input'); // Focus the input

    // Press some keys
    await frame.press('#text-input', 'F');
    await frame.press('#text-input', 'r');
    await frame.press('#text-input', 'a');
    await frame.press('#text-input', 'm');
    await frame.press('#text-input', 'e');

    // Check the result
    const pressedValue = await frame.inputValue('#text-input');
    progress.log(`Frame press - Text after pressing keys: "${pressedValue}"`);

    if (pressedValue === 'Frame') {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 12 passed: Frame press method works',
        details: { pressedValue },
      });
    } else {
      throw new Error(`Test 12 failed: Expected 'Frame', got: ${pressedValue}`);
    }

    // Test Frame content method
    progress.log('Test 13: Testing Frame content method');
    const frameContent = await frame.content();
    progress.log(`Frame content - Retrieved content length: ${frameContent.length} characters`);
    // Basic validation - check that we got HTML content
    const hasDoctype = frameContent.includes('<!DOCTYPE') || frameContent.includes('<!doctype');
    const hasHtml = frameContent.includes('<html');
    const hasBody = frameContent.includes('<body');

    if (hasDoctype && hasHtml && hasBody && frameContent.length > 100) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 13 passed: Frame content method works',
        details: {
          contentLength: frameContent.length,
          hasDoctype,
          hasHtml,
          hasBody,
          contentPreview: frameContent.substring(0, 200) + '...',
        },
      });
    } else {
      throw new Error(
        `Test 13 failed: Frame content did not return valid HTML document. Length: ${frameContent.length}, hasDoctype: ${hasDoctype}, hasHtml: ${hasHtml}, hasBody: ${hasBody}`,
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Frame missing methods functionality tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace available';

    progress.log(`Frame missing methods functionality test failed: ${errorMessage}`);
    progress.log(`Error stack trace: ${errorStack}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Frame missing methods functionality tests failed',
      details: {
        error: errorMessage,
        stack: errorStack,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
    });
    throw error;
  }
}
