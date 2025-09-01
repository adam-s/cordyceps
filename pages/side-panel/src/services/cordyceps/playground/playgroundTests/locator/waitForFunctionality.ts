import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testWaitForFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting waitFor() functionality tests',
    });

    // Create visual indicator for the test
    progress.log('Creating visual indicator for waitFor tests');
    await page.evaluate(() => {
      // Create test indicator
      const indicator = document.createElement('div');
      indicator.id = 'waitfor-test-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e8f5e8;
        border: 2px solid #4caf50;
        padding: 15px;
        border-radius: 8px;
        z-index: 10000;
        font-family: monospace;
        font-size: 12px;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      indicator.innerHTML = `
        <div style="font-weight: bold; color: #2e7d32; margin-bottom: 8px;">
          🧪 waitFor() Test Progress
        </div>
        <div id="waitfor-status">Testing existing page elements...</div>
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
          const status = document.getElementById('waitfor-status');
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

    // Test 1: waitFor() with default 'visible' state on action button
    progress.log('Test 1: waitFor() with default visible state on action button');
    await updateStatus('Test 1: Action button visibility');

    const actionButton = page.locator('#action-button');
    await actionButton.waitFor(); // Default state is 'visible'
    progress.log('✓ waitFor() with default visible state: SUCCESS');
    await updateStatus('Test 1: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 2: waitFor() with explicit 'attached' state on hidden input
    progress.log('Test 2: waitFor() with attached state on hidden input');
    await updateStatus('Test 2: Hidden input attachment');

    const hiddenInput = page.locator('#hidden-input');
    await hiddenInput.waitFor({ state: 'attached' });
    progress.log('✓ waitFor() with attached state on hidden input: SUCCESS');
    await updateStatus('Test 2: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 3: waitFor() with 'visible' state and custom timeout on checkbox
    progress.log('Test 3: waitFor() with visible state and custom timeout on checkbox');
    await updateStatus('Test 3: Checkbox visibility with timeout');

    const testCheckbox = page.locator('#test-checkbox');
    await testCheckbox.waitFor({ state: 'visible', timeout: 5000 });
    progress.log('✓ waitFor() with custom timeout on checkbox: SUCCESS');
    await updateStatus('Test 3: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 4: waitFor() with 'visible' state on form elements
    progress.log('Test 4: waitFor() on form text input');
    await updateStatus('Test 4: Text input visibility');

    const textInput = page.locator('#text-input');
    await textInput.waitFor({ state: 'visible' });
    progress.log('✓ waitFor() on text input: SUCCESS');
    await updateStatus('Test 4: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 5: waitFor() with Frame locator on container
    progress.log('Test 5: waitFor() with Frame locator on container');
    await updateStatus('Test 5: Container element attachment');

    const container = page.mainFrame().locator('.container');
    await container.waitFor({ state: 'attached' });
    progress.log('✓ waitFor() with Frame locator on container: SUCCESS');
    await updateStatus('Test 5: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 6: waitFor() on select element with method chaining
    progress.log('Test 6: waitFor() on select element with scrolling');
    await updateStatus('Test 6: Select element with scrolling');

    const singleSelect = page.locator('#single-select');
    await singleSelect.waitFor({ state: 'visible' });
    await singleSelect.scrollIntoViewIfNeeded();
    progress.log('✓ waitFor() with method chaining on select: SUCCESS');
    await updateStatus('Test 6: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 7: waitFor() on iframe element
    progress.log('Test 7: waitFor() on iframe element');
    await updateStatus('Test 7: Iframe attachment');

    const iframe = page.locator('iframe[title="First embedded iframe"]');
    await iframe.waitFor({ state: 'attached' });
    progress.log('✓ waitFor() on iframe: SUCCESS');
    await updateStatus('Test 7: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 8: waitFor() on multiple elements - textarea
    progress.log('Test 8: waitFor() on textarea element');
    await updateStatus('Test 8: Textarea visibility');

    const textarea = page.locator('#textarea-input');
    await textarea.waitFor({ state: 'visible' });
    progress.log('✓ waitFor() on textarea: SUCCESS');
    await updateStatus('Test 8: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 9: waitFor() on disabled button
    progress.log('Test 9: waitFor() on disabled button');
    await updateStatus('Test 9: Disabled button visibility');

    const disabledButton = page.locator('#disabled-button');
    await disabledButton.waitFor({ state: 'visible' });
    progress.log('✓ waitFor() on disabled button: SUCCESS');
    await updateStatus('Test 9: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 10: waitFor() on radio button
    progress.log('Test 10: waitFor() on radio button');
    await updateStatus('Test 10: Radio button attachment');

    const radioButton = page.locator('#radio-1');
    await radioButton.waitFor({ state: 'attached' });
    progress.log('✓ waitFor() on radio button: SUCCESS');
    await updateStatus('Test 10: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 11: waitFor() error handling for timeout
    progress.log('Test 11: waitFor() error handling with timeout');
    await updateStatus('Test 11: Testing timeout error handling');

    try {
      const nonExistentElement = page.locator('[data-testid="non-existent-element-12345"]');
      await nonExistentElement.waitFor({ state: 'visible', timeout: 1000 });
      throw new Error('Should have thrown timeout error');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Should have thrown')) {
        throw error;
      }
      progress.log('✓ waitFor() timeout error handling: SUCCESS');
      await updateStatus('Test 11: SUCCESS ✓ (Expected timeout)', true);
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 12: waitFor() on color input
    progress.log('Test 12: waitFor() on color input');
    await updateStatus('Test 12: Color input visibility');

    const colorInput = page.locator('#color-input');
    await colorInput.waitFor({ state: 'visible' });
    progress.log('✓ waitFor() on color input: SUCCESS');
    await updateStatus('Test 12: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 13: waitFor() on first fieldset element
    progress.log('Test 13: waitFor() on first fieldset element');
    await updateStatus('Test 13: First fieldset attachment');

    const fieldset = page.locator('fieldset').first();
    await fieldset.waitFor({ state: 'attached' });
    progress.log('✓ waitFor() on first fieldset: SUCCESS');
    await updateStatus('Test 13: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 14: waitFor() on form with multiple attributes
    progress.log('Test 14: waitFor() on form element');
    await updateStatus('Test 14: Form element attachment');

    const testForm = page.locator('#test-form');
    await testForm.waitFor({ state: 'attached' });
    progress.log('✓ waitFor() on form element: SUCCESS');
    await updateStatus('Test 14: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 15: waitFor() on range input
    progress.log('Test 15: waitFor() on range input');
    await updateStatus('Test 15: Range input visibility');

    const rangeInput = page.locator('#range-input');
    await rangeInput.waitFor({ state: 'visible' });
    progress.log('✓ waitFor() on range input: SUCCESS');
    await updateStatus('Test 15: SUCCESS ✓', true);
    await new Promise(resolve => setTimeout(resolve, 100));

    await updateStatus('All waitFor() tests completed! 🎉', true);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'waitFor() functionality tests completed successfully',
      details: {
        testsCompleted: 15,
        allPassed: true,
        elementsUsed: [
          '#action-button',
          '#hidden-input',
          '#test-checkbox',
          '#text-input',
          '.container',
          '#single-select',
          'iframe[title="First embedded iframe"]',
          '#textarea-input',
          '#disabled-button',
          '#radio-1',
          '#color-input',
          'fieldset.first()',
          '#test-form',
          '#range-input',
        ],
      },
    });

    // Keep indicators visible for a moment
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clean up test indicator
    await page.evaluate(() => {
      const indicator = document.getElementById('waitfor-test-indicator');
      if (indicator) indicator.remove();
    });

    progress.log('waitFor() functionality tests completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update status with error
    try {
      await page.evaluate(errorMsg => {
        const status = document.getElementById('waitfor-status');
        if (status) {
          status.textContent = `ERROR: ${errorMsg}`;
          status.style.color = '#d32f2f';
        }
      }, errorMessage);
    } catch (updateError) {
      const updateErrorMessage =
        updateError instanceof Error ? updateError.message : String(updateError);
      progress.log(`Failed to update error status: ${updateErrorMessage}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `waitFor() functionality test failed: ${errorMessage}`,
      details: { error: errorMessage },
    });

    // Clean up on error
    try {
      await page.evaluate(() => {
        const indicator = document.getElementById('waitfor-test-indicator');
        if (indicator) indicator.remove();
      });
    } catch (cleanupError) {
      const cleanupErrorMessage =
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      progress.log(`Failed to clean up test indicator: ${cleanupErrorMessage}`);
    }

    progress.log(`waitFor() functionality test failed: ${errorMessage}`);
    throw error;
  }
}
