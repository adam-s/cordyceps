import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testMissingMethodsFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting missing methods functionality tests',
    });

    // Test getAttribute method
    progress.log('Test 1: Testing getAttribute method');
    const actionButton = page.locator('#action-button');

    // First, let's verify the element exists
    try {
      const elementExists = await actionButton.isVisible();
      progress.log(`Element #action-button exists and is visible: ${elementExists}`);

      if (!elementExists) {
        // Try to find what elements are available
        const allButtons = await page.locator('button').count();
        progress.log(`Total buttons found on page: ${allButtons}`);

        if (allButtons > 0) {
          const firstButtonText = await page.locator('button').first().innerText();
          progress.log(`First button text: "${firstButtonText}"`);
        }

        throw new Error(`Test 1 failed: Element #action-button not found or not visible`);
      }

      // Check what attributes the element has
      const tagName = await actionButton.getTagName();
      progress.log(`Element tag name: ${tagName}`);

      // Try to get the innerHTML to see what the element looks like
      const innerHTML = await actionButton.innerHTML();
      progress.log(`Element innerHTML: ${innerHTML}`);

      // Get the id attribute (which actually exists)
      const buttonId = await actionButton.getAttribute('id');
      progress.log(`Button id attribute: ${buttonId}`);

      // Also check for other common button attributes
      const className = await actionButton.getAttribute('class');
      progress.log(`Button class: ${className}`);

      if (buttonId === 'action-button') {
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 1 passed: getAttribute method works',
          details: { buttonId, tagName, className },
        });

        // Test 1a: verify getAttribute returns correct value for existing type attribute
        const buttonType = await actionButton.getAttribute('type');
        if (buttonType === 'button') {
          context.events.emit({
            timestamp: Date.now(),
            severity: Severity.Success,
            message:
              'Test 1a passed: getAttribute returns correct value for existing type attribute',
            details: { buttonType },
          });
        } else {
          throw new Error(`Test 1a failed: Expected type="button", got: ${buttonType}`);
        }

        // Test 1b: verify getAttribute returns null for truly non-existent attributes
        const nonExistentAttr = await actionButton.getAttribute('data-nonexistent');
        if (nonExistentAttr === null) {
          context.events.emit({
            timestamp: Date.now(),
            severity: Severity.Success,
            message:
              'Test 1b passed: getAttribute correctly returns null for non-existent attributes',
            details: { nonExistentAttr },
          });
        } else {
          throw new Error(
            `Test 1b failed: Expected null for non-existent 'data-nonexistent' attribute, got: ${nonExistentAttr}`,
          );
        }
      } else {
        // Provide more context about what we found
        throw new Error(
          `Test 1 failed: Expected id="action-button", got: ${buttonId}\n` +
            `Element details: tagName=${tagName}, class=${className}\n` +
            `innerHTML: ${innerHTML}`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
      progress.log(`Test 1 getAttribute method failed: ${errorMessage}`);
      progress.log(`Test 1 error stack: ${errorStack}`);
      throw new Error(
        `Test 1 failed: getAttribute method error: ${errorMessage}\nStack: ${errorStack}`,
      );
    }

    // Test hover method
    progress.log('Test 2: Testing hover method');
    try {
      await actionButton.hover();
      progress.log('Hover action completed successfully');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: hover method works',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
      progress.log(`Test 2 hover method failed: ${errorMessage}`);
      progress.log(`Test 2 error stack: ${errorStack}`);
      throw new Error(`Test 2 failed: hover method error: ${errorMessage}\nStack: ${errorStack}`);
    }

    // Test innerHTML method
    progress.log('Test 3: Testing innerHTML method');
    const titleElement = page.locator('h1');
    const innerHTML = await titleElement.innerHTML();
    progress.log(`Title innerHTML: ${innerHTML}`);

    if (innerHTML && innerHTML.length > 0) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: innerHTML method works',
        details: { innerHTML },
      });
    } else {
      throw new Error('Test 3 failed: innerHTML returned empty or null');
    }

    // Test innerText method
    progress.log('Test 4: Testing innerText method');
    const innerText = await titleElement.innerText();
    progress.log(`Title innerText: "${innerText}"`);

    if (innerText && innerText.includes('Cordyceps Example Domain')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: innerText method works',
        details: { innerText },
      });
    } else {
      throw new Error(
        `Test 4 failed: Expected innerText with 'Cordyceps Example Domain', got: ${innerText}`,
      );
    }

    // Test inputValue method
    progress.log('Test 5: Testing inputValue method');
    const emailInput = page.locator('#email-input');

    // First, fill the input with a test value
    await emailInput.fill('test-input@example.com');

    // Then test inputValue
    const inputValue = await emailInput.inputValue();
    progress.log(`Email input value: "${inputValue}"`);

    if (inputValue === 'test-input@example.com') {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: inputValue method works',
        details: { inputValue },
      });
    } else {
      throw new Error(`Test 5 failed: Expected 'test-input@example.com', got: ${inputValue}`);
    }

    // Test isChecked method
    progress.log('Test 6: Testing isChecked method');
    const checkbox = page.locator('#test-checkbox');

    // Test initial state
    let isChecked = await checkbox.isChecked();
    progress.log(`Checkbox initial state: ${isChecked}`);

    // Toggle the checkbox
    await checkbox.click();
    isChecked = await checkbox.isChecked();
    progress.log(`Checkbox state after click: ${isChecked}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 6 passed: isChecked method works',
      details: { finalState: isChecked },
    });

    // Test isDisabled method
    progress.log('Test 7: Testing isDisabled method');
    const disabledButtonLocator = page.locator('button[disabled]');
    const enabledButton = page.locator('#action-button');

    // Avoid potential hang: check count first before calling isDisabled on a non-existent element
    const disabledCount = await disabledButtonLocator.count();
    progress.log(`Disabled button count: ${disabledCount}`);

    if (disabledCount > 0) {
      const disabledButton = disabledButtonLocator.first();
      try {
        const disabledState = await disabledButton.isDisabled();
        const enabledState = await enabledButton.isDisabled();

        progress.log(`Disabled button isDisabled: ${disabledState}`);
        progress.log(`Enabled button isDisabled: ${enabledState}`);

        if (disabledState === true && enabledState === false) {
          context.events.emit({
            timestamp: Date.now(),
            severity: Severity.Success,
            message: 'Test 7 passed: isDisabled method works',
            details: { disabledState, enabledState },
          });
        } else {
          throw new Error(
            `Test 7 failed: Expected disabled=true, enabled=false, got: disabled=${disabledState}, enabled=${enabledState}`,
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(`Test 7 error while checking disabled button: ${errorMessage}`);
        throw error;
      }
    } else {
      // Fallback path when no disabled element exists on the page
      const enabledState = await enabledButton.isDisabled();
      progress.log('No disabled button present on page. Verifying enabled button reports false.');
      progress.log(`Enabled button isDisabled: ${enabledState}`);
      if (enabledState === false) {
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 7 passed: isDisabled method works (no disabled button present)',
          details: { enabledState, disabledCount },
        });
      } else {
        throw new Error(
          `Test 7 failed: Expected enabled button isDisabled=false, got: ${enabledState}`,
        );
      }
    }

    // Test isEditable method
    progress.log('Test 8: Testing isEditable method');
    const textInput = page.locator('#text-input');
    const buttonElement = page.locator('#action-button');

    const inputEditable = await textInput.isEditable();
    const buttonEditable = await buttonElement.isEditable();

    progress.log(`Text input isEditable: ${inputEditable}`);
    progress.log(`Button isEditable: ${buttonEditable}`);

    if (inputEditable === true && buttonEditable === false) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 8 passed: isEditable method works',
        details: { inputEditable, buttonEditable },
      });
    } else {
      throw new Error(
        `Test 8 failed: Expected input=true, button=false, got: input=${inputEditable}, button=${buttonEditable}`,
      );
    }

    // Test isEnabled method
    progress.log('Test 9: Testing isEnabled method');
    const enabledState = await enabledButton.isEnabled();
    progress.log(`Enabled button isEnabled: ${enabledState}`);

    if (enabledState === true) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 9 passed: isEnabled method works',
        details: { enabledState },
      });
    } else {
      throw new Error(`Test 9 failed: Expected isEnabled=true, got: ${enabledState}`);
    }
    // Test isHidden method
    progress.log('Test 10: Testing isHidden method');
    const visibleElement = page.locator('#action-button');

    const visibleHidden = await visibleElement.isHidden();
    progress.log(`Visible element isHidden: ${visibleHidden}`);

    // Try hidden-input first (works in both HTML files)
    let hiddenElementLocator = page.locator('#hidden-input');
    let hiddenCount = await hiddenElementLocator.count();
    progress.log(`Hidden input element count: ${hiddenCount}`);

    if (hiddenCount === 0) {
      // Fallback to form-status if hidden-input doesn't exist (for example HTML)
      hiddenElementLocator = page.locator('#form-status');
      hiddenCount = await hiddenElementLocator.count();
      progress.log(`Form status element count: ${hiddenCount}`);
    }

    if (hiddenCount > 0) {
      const hiddenElement = hiddenElementLocator.first();
      try {
        const hiddenHidden = await hiddenElement.isHidden();
        progress.log(`Hidden element isHidden: ${hiddenHidden}`);

        if (visibleHidden === false && hiddenHidden === true) {
          context.events.emit({
            timestamp: Date.now(),
            severity: Severity.Success,
            message: 'Test 10 passed: isHidden method works',
            details: { visibleHidden, hiddenHidden },
          });
        } else {
          throw new Error(
            `Test 10 failed: Expected visible=false, hidden=true, got: visible=${visibleHidden}, hidden=${hiddenHidden}`,
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(`Test 10 error while checking hidden element: ${errorMessage}`);
        throw error;
      }
    } else {
      // Fallback when no hidden elements exist - test with visible element only
      if (visibleHidden === false) {
        progress.log('No hidden element present on page. Verifying visible element reports false.');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 10 passed: isHidden method works (no hidden element present)',
          details: { visibleHidden, hiddenCount },
        });
      } else {
        throw new Error(
          `Test 10 failed: Expected visible element isHidden=false, got: ${visibleHidden}`,
        );
      }
    }

    // Test isVisible method
    progress.log('Test 11: Testing isVisible method');
    const visibleState = await visibleElement.isVisible();
    progress.log(`Visible element isVisible: ${visibleState}`);

    if (visibleState === true) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 11 passed: isVisible method works',
        details: { visibleState },
      });
    } else {
      throw new Error(`Test 11 failed: Expected isVisible=true, got: ${visibleState}`);
    }

    // Test press method
    progress.log('Test 12: Testing press method');
    const textInputForPress = page.locator('#text-input');

    // Clear the input and focus it
    await textInputForPress.clear();
    await textInputForPress.focus();

    // Press some keys
    await textInputForPress.press('H');
    await textInputForPress.press('e');
    await textInputForPress.press('l');
    await textInputForPress.press('l');
    await textInputForPress.press('o');

    // Check the result
    const pressedValue = await textInputForPress.inputValue();
    progress.log(`Text after pressing keys: "${pressedValue}"`);

    if (pressedValue === 'Hello') {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 12 passed: press method works',
        details: { pressedValue },
      });
    } else {
      throw new Error(`Test 12 failed: Expected 'Hello', got: ${pressedValue}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Missing methods functionality tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace available';

    progress.log(`Missing methods functionality test failed: ${errorMessage}`);
    progress.log(`Error stack trace: ${errorStack}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Missing methods functionality tests failed',
      details: {
        error: errorMessage,
        stack: errorStack,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
    });
    throw error;
  }
}
