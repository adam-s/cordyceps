import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Test selectText functionality across ElementHandle and Locator
 * Tests text selection on various element types including input, textarea, and content elements
 */
export async function testSelectTextFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting selectText functionality tests',
    });

    progress.log('Creating test elements for selectText functionality');

    // Create test elements on the page
    await page.evaluate(() => {
      // Clear any existing test elements first
      const existingContainer = document.getElementById('selecttext-test-container');
      if (existingContainer) {
        existingContainer.remove();
      }

      // Create test container
      const container = document.createElement('div');
      container.id = 'selecttext-test-container';
      container.style.cssText =
        'margin: 20px; padding: 20px; border: 1px solid #ccc; background: #f9f9f9;';

      container.innerHTML = `
        <h3>SelectText Test Elements</h3>
        <div>
          <label for="test-input">Test Input:</label>
          <input id="test-input" type="text" value="Sample input text to select" style="width: 300px; margin: 5px;" />
        </div>
        <div>
          <label for="test-textarea">Test Textarea:</label>
          <textarea id="test-textarea" style="width: 300px; height: 80px; margin: 5px;">Sample textarea content
Multiple lines of text
Ready for selection</textarea>
        </div>
        <div>
          <label for="test-content">Test Content Div:</label>
          <div id="test-content" style="border: 1px solid #999; padding: 10px; margin: 5px; width: 300px; background: white;">
            This is a content div with selectable text content for testing purposes.
          </div>
        </div>
        <div id="selecttext-status" style="margin-top: 10px; padding: 10px; border: 1px solid #ddd; background: #fff; display: none;"></div>
      `;

      document.body.appendChild(container);
    });

    // Wait for elements to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 1: Locator.selectText on input element
    progress.log('Testing Locator.selectText on input element');
    const inputLocator = page.locator('#test-input');
    await inputLocator.selectText();

    // Verify selection by checking if text is selected
    const inputSelectionInfo = await page.evaluate(() => {
      const input = document.getElementById('test-input') as HTMLInputElement;
      return {
        selectedText: input.value.substring(input.selectionStart || 0, input.selectionEnd || 0),
        fullText: input.value,
        isAllSelected: input.selectionStart === 0 && input.selectionEnd === input.value.length,
      };
    });

    if (!inputSelectionInfo.isAllSelected) {
      throw new Error(
        `Locator.selectText on input failed: expected all text selected, got selection: "${inputSelectionInfo.selectedText}"`,
      );
    }
    progress.log('✓ Locator.selectText on input: SUCCESS - All text selected');

    // Update status
    await page.evaluate(result => {
      const statusDiv = document.getElementById('selecttext-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML = `<strong>Test 1:</strong> Input text selection - ${result.isAllSelected ? 'SUCCESS' : 'FAILED'}`;
      }
    }, inputSelectionInfo);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: ElementHandle.selectText on textarea
    progress.log('Testing ElementHandle.selectText on textarea element');
    const textareaLocator = page.locator('#test-textarea');
    const textareaHandle = await textareaLocator.elementHandle();
    if (!textareaHandle) {
      throw new Error('Textarea element not found');
    }

    await textareaHandle.selectText();

    const textareaSelectionInfo = await page.evaluate(() => {
      const textarea = document.getElementById('test-textarea') as HTMLTextAreaElement;
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

    if (!textareaSelectionInfo.isAllSelected) {
      throw new Error(
        `ElementHandle.selectText on textarea failed: expected all text selected, got selection: "${textareaSelectionInfo.selectedText}"`,
      );
    }
    progress.log('✓ ElementHandle.selectText on textarea: SUCCESS - All text selected');

    // Update status
    await page.evaluate(result => {
      const statusDiv = document.getElementById('selecttext-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += `<br><strong>Test 2:</strong> Textarea text selection - ${result.isAllSelected ? 'SUCCESS' : 'FAILED'}`;
      }
    }, textareaSelectionInfo);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Locator.selectText on content div
    progress.log('Testing Locator.selectText on content div element');
    const contentLocator = page.locator('#test-content');
    await contentLocator.selectText();

    // For content elements, check if window selection contains the text
    const contentSelectionInfo = await page.evaluate(() => {
      const selection = window.getSelection();
      const contentDiv = document.getElementById('test-content');
      return {
        selectedText: selection ? selection.toString() : '',
        fullText: contentDiv ? contentDiv.textContent || '' : '',
        hasSelection: selection ? selection.toString().length > 0 : false,
      };
    });

    if (!contentSelectionInfo.hasSelection || contentSelectionInfo.selectedText.trim() === '') {
      throw new Error(`Locator.selectText on content div failed: no text selection detected`);
    }
    progress.log('✓ Locator.selectText on content div: SUCCESS - Text selected');

    // Update status
    await page.evaluate(result => {
      const statusDiv = document.getElementById('selecttext-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += `<br><strong>Test 3:</strong> Content div text selection - ${result.hasSelection ? 'SUCCESS' : 'FAILED'}`;
      }
    }, contentSelectionInfo);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 4: Test with force option on hidden element
    progress.log('Testing selectText with force option');

    // Create a hidden element
    await page.evaluate(() => {
      const hiddenInput = document.createElement('input');
      hiddenInput.id = 'hidden-input';
      hiddenInput.type = 'text';
      hiddenInput.value = 'Hidden text to select';
      hiddenInput.style.display = 'none';
      document.body.appendChild(hiddenInput);
    });

    // This should fail without force option
    let errorCaught = false;
    try {
      const hiddenLocator = page.locator('#hidden-input');
      await hiddenLocator.selectText({ timeout: 2000 });
    } catch (error) {
      errorCaught = true;
      progress.log('✓ selectText correctly failed on hidden element without force option');
    }

    if (!errorCaught) {
      throw new Error('selectText should have failed on hidden element without force option');
    }

    // This should succeed with force option
    const hiddenLocator = page.locator('#hidden-input');
    await hiddenLocator.selectText({ force: true });
    progress.log('✓ selectText succeeded on hidden element with force option');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('selecttext-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += `<br><strong>Test 4:</strong> Force option test - SUCCESS`;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Final status update
    await page.evaluate(() => {
      const statusDiv = document.getElementById('selecttext-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += `<br><br><strong>All selectText tests completed successfully!</strong>`;
      }
    });

    // Cleanup
    textareaHandle.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'selectText functionality tests completed successfully',
      details: {
        testsRun: 4,
        inputTest: 'SUCCESS',
        textareaTest: 'SUCCESS',
        contentDivTest: 'SUCCESS',
        forceOptionTest: 'SUCCESS',
      },
    });

    progress.log('All selectText functionality tests passed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'selectText functionality test failed',
      details: { error: errorMessage },
    });

    progress.log(`selectText test failed: ${errorMessage}`);
    throw error;
  }
}
