import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Test selectText functionality using existing elements from the test page
 * Tests selection on input, textarea, and content elements that already exist
 */
export async function testSelectTextWithExistingElements(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting selectText functionality tests using existing page elements',
    });

    progress.log('Using existing elements from the test page for selectText testing');

    // Test 1: ElementHandle.selectText on existing text input
    progress.log('Testing ElementHandle.selectText on existing text input (#text-input)');
    const textInputLocator = page.locator('#text-input');
    const textInputHandle = await textInputLocator.elementHandle();
    if (!textInputHandle) {
      throw new Error('Text input element not found');
    }

    // First fill it with some content to select
    await textInputHandle.fill('Test content for text selection');
    await textInputHandle.selectText();

    // Verify the selection
    const textInputResult = await page.evaluate(() => {
      const input = document.getElementById('text-input') as HTMLInputElement;
      return {
        selectedText: input.value.substring(input.selectionStart || 0, input.selectionEnd || 0),
        fullText: input.value,
        isAllSelected: input.selectionStart === 0 && input.selectionEnd === input.value.length,
      };
    });

    if (!textInputResult.isAllSelected) {
      throw new Error(
        `ElementHandle.selectText on text input failed: expected all text selected, got "${textInputResult.selectedText}"`,
      );
    }
    progress.log('✓ ElementHandle.selectText on text input: SUCCESS - All text selected');

    // Update form status to show result
    await page.evaluate(result => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML = `<strong>SelectText Test 1:</strong> Text input selection - ${result.isAllSelected ? 'SUCCESS' : 'FAILED'}<br>Selected: "${result.selectedText}"`;
      }
    }, textInputResult);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Locator.selectText on existing textarea
    progress.log('Testing Locator.selectText on existing textarea (#textarea-input)');
    const textareaLocator = page.locator('#textarea-input');

    // Fill textarea with some content first
    await textareaLocator.fill('Multi-line content\nfor textarea selection\ntesting purposes');
    await textareaLocator.selectText();

    const textareaResult = await page.evaluate(() => {
      const textarea = document.getElementById('textarea-input') as HTMLTextAreaElement;
      return {
        selectedText: textarea.value.substring(
          textarea.selectionStart || 0,
          textarea.selectionEnd || 0,
        ),
        fullText: textarea.value,
        isAllSelected:
          textarea.selectionStart === 0 && textarea.selectionEnd === textarea.value.length,
      };
    });

    if (!textareaResult.isAllSelected) {
      throw new Error(
        `Locator.selectText on textarea failed: expected all text selected, got "${textareaResult.selectedText}"`,
      );
    }
    progress.log('✓ Locator.selectText on textarea: SUCCESS - All text selected');

    // Update status
    await page.evaluate(result => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += `<br><strong>SelectText Test 2:</strong> Textarea selection - ${result.isAllSelected ? 'SUCCESS' : 'FAILED'}`;
      }
    }, textareaResult);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Locator.selectText on email input
    progress.log('Testing Locator.selectText on email input (#email-input)');
    const emailLocator = page.locator('#email-input');

    await emailLocator.fill('test@selecttext.com');
    await emailLocator.selectText();

    const emailResult = await page.evaluate(() => {
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      return {
        selectedText: emailInput.value.substring(
          emailInput.selectionStart || 0,
          emailInput.selectionEnd || 0,
        ),
        fullText: emailInput.value,
        isAllSelected:
          emailInput.selectionStart === 0 && emailInput.selectionEnd === emailInput.value.length,
      };
    });

    if (!emailResult.isAllSelected) {
      throw new Error(
        `Locator.selectText on email input failed: expected all text selected, got "${emailResult.selectedText}"`,
      );
    }
    progress.log('✓ Locator.selectText on email input: SUCCESS - All text selected');

    // Update status
    await page.evaluate(result => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += `<br><strong>SelectText Test 3:</strong> Email input selection - ${result.isAllSelected ? 'SUCCESS' : 'FAILED'}`;
      }
    }, emailResult);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 4: Test selectText on content element (using one of the labels)
    progress.log('Testing Locator.selectText on content element (label)');
    const labelLocator = page.locator('label[for="text-input"]');

    await labelLocator.selectText();

    const labelResult = await page.evaluate(() => {
      const selection = window.getSelection();
      const labelElement = document.querySelector('label[for="text-input"]');
      return {
        selectedText: selection ? selection.toString() : '',
        fullText: labelElement ? labelElement.textContent || '' : '',
        hasSelection: selection ? selection.toString().length > 0 : false,
      };
    });

    if (!labelResult.hasSelection || labelResult.selectedText.trim() === '') {
      throw new Error(`Locator.selectText on label failed: no text selection detected`);
    }
    progress.log('✓ Locator.selectText on label: SUCCESS - Text selected');

    // Update status
    await page.evaluate(result => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += `<br><strong>SelectText Test 4:</strong> Label content selection - ${result.hasSelection ? 'SUCCESS' : 'FAILED'}`;
      }
    }, labelResult);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 5: Test with force option (try on hidden input)
    progress.log('Testing selectText with force option on hidden input');
    const hiddenInputLocator = page.locator('#hidden-input');

    // This should succeed with force option even though element is hidden
    await hiddenInputLocator.selectText({ force: true });
    progress.log('✓ selectText with force option: SUCCESS - Hidden element text selected');

    // Final status update
    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += `<br><br><strong>🎉 All selectText tests with existing elements completed successfully!</strong>`;
      }
    });

    // Cleanup
    textInputHandle.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'selectText functionality tests with existing elements completed successfully',
      details: {
        testsRun: 5,
        textInputTest: 'SUCCESS',
        textareaTest: 'SUCCESS',
        emailInputTest: 'SUCCESS',
        labelContentTest: 'SUCCESS',
        forceOptionTest: 'SUCCESS',
        elementsUsed: [
          '#text-input',
          '#textarea-input',
          '#email-input',
          'label[for="text-input"]',
          '#hidden-input',
        ],
      },
    });

    progress.log('All selectText functionality tests with existing elements passed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'selectText functionality test with existing elements failed',
      details: { error: errorMessage },
    });

    progress.log(`selectText test with existing elements failed: ${errorMessage}`);
    throw error;
  }
}
