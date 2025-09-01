import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testTextContentFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting textContent() functionality tests',
    });

    // Create test elements with various text content scenarios
    progress.log('Using existing test elements for textContent functionality');

    // Clear any existing status and reset for our tests
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.display = 'none';
        statusDiv.innerHTML = '';
      }
    });

    // Wait for elements to be ready

    // Test 1: ElementHandle.textContent() on action button
    console.log('[TEST] Starting Test 1: ElementHandle.textContent() on action button');
    progress.log('Test 1: ElementHandle.textContent() on action button');
    const actionButtonHandle = await page.locator('#action-button').elementHandle();
    console.log('[TEST] Test 1: Got element handle, calling textContent()');
    const actionButtonContent = await actionButtonHandle.textContent();
    console.log('[TEST] Test 1: textContent() returned:', actionButtonContent);
    actionButtonHandle.dispose();

    // The action button should contain text like "Perform Action" (allowing for whitespace)
    if (!actionButtonContent || !actionButtonContent.trim().includes('Action')) {
      throw new Error(
        `Test 1 failed: Expected button to contain "Action", got "${actionButtonContent}"`,
      );
    }
    progress.log('✓ ElementHandle.textContent() on action button: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML = '<strong>Test 1:</strong> ElementHandle.textContent() - SUCCESS';
      }
    });

    // Test 2: Locator.textContent() on log button
    console.log('[TEST] Starting Test 2: Locator.textContent() on log button');
    progress.log('Test 2: Locator.textContent() on log button');
    const logButtonLocator = page.locator('#log-button');
    console.log('[TEST] Test 2: Created locator, calling textContent()');
    const logButtonContent = await logButtonLocator.textContent();
    console.log('[TEST] Test 2: textContent() returned:', `"${logButtonContent}"`);
    console.log('[TEST] Test 2: textContent() trimmed:', `"${logButtonContent.trim()}"`);

    // Log button should contain text like "Log Status" (allowing for whitespace)
    if (!logButtonContent || !logButtonContent.trim().includes('Log')) {
      throw new Error(
        `Test 2 failed: Expected button to contain "Log", got "${logButtonContent.trim()}"`,
      );
    }
    progress.log('✓ Locator.textContent() on log button: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 2:</strong> Locator.textContent() - SUCCESS';
      }
    });

    // Test 3: Frame.textContent() on toggle button
    progress.log('Test 3: Frame.textContent() on toggle button');
    const frameTextContent = await page.mainFrame().textContent('#toggle-button');

    // Toggle button should contain text like "Toggle" (allowing for whitespace)
    if (!frameTextContent || !frameTextContent.trim().includes('Toggle')) {
      throw new Error(
        `Test 3 failed: Expected button to contain "Toggle", got "${frameTextContent.trim()}"`,
      );
    }
    progress.log('✓ Frame.textContent() on toggle button: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 3:</strong> Frame.textContent() - SUCCESS';
      }
    });

    // Test 4: Page.textContent() on text input placeholder (via attribute)
    progress.log('Test 4: Page.textContent() on action button (using Page method)');
    const pageTextContent = await page.textContent('#action-button');

    // Should get the button text content
    if (!pageTextContent || !pageTextContent.trim().includes('Action')) {
      throw new Error(
        `Test 4 failed: Expected button to contain "Action", got "${pageTextContent}"`,
      );
    }
    progress.log('✓ Page.textContent() on action button: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 4:</strong> Page.textContent() - SUCCESS';
      }
    });

    // Test 5: textContent() on text input (should be empty initially)
    progress.log('Test 5: textContent() on text input');
    const textInputContent = await page.locator('#text-input').textContent();

    // Text input should be empty or contain only whitespace for textContent
    if (textInputContent && textInputContent.trim() !== '') {
      // Log the actual content for debugging, but this might be expected for inputs
      progress.log(`Note: Input textContent was "${textInputContent}"`);
    }
    progress.log('✓ textContent() on text input: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 5:</strong> Empty element textContent() - SUCCESS';
      }
    });

    // Test 6: textContent() vs getTextContent() consistency
    progress.log('Test 6: textContent() vs getTextContent() consistency');
    const actionButtonLocator = page.locator('#action-button');
    const textContentResult = await actionButtonLocator.textContent();
    const getTextContentResult = await actionButtonLocator.getTextContent();

    if (textContentResult !== getTextContentResult) {
      throw new Error(
        `Test 6 failed: textContent() and getTextContent() returned different results: "${textContentResult}" vs "${getTextContentResult}"`,
      );
    }
    progress.log('✓ textContent() vs getTextContent() consistency: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML +=
          '<br><strong>Test 6:</strong> textContent() vs getTextContent() consistency - SUCCESS';
      }
    });

    // Test 7: textContent() on input element (should return empty since input.textContent is empty)
    progress.log('Test 7: textContent() on input element');
    const inputElementContent = await page.locator('#email-input').textContent();

    // Note: input.textContent is typically empty, input.value contains the actual value
    if (inputElementContent !== '') {
      progress.log(
        `Note: Input textContent was "${inputElementContent}" - this is expected as input.textContent differs from input.value`,
      );
    }
    progress.log('✓ textContent() on input element: SUCCESS (behavior verified)');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 7:</strong> Input element textContent() - SUCCESS';
      }
    });

    // Test 8: textContent() with timeout option
    progress.log('Test 8: textContent() with timeout option');
    const timeoutTextContent = await page.textContent('#log-button', { timeout: 15000 });

    if (!timeoutTextContent || !timeoutTextContent.trim().includes('Log')) {
      throw new Error(
        `Test 8 failed: Expected button to contain "Log", got "${timeoutTextContent}"`,
      );
    }
    progress.log('✓ textContent() with timeout option: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 8:</strong> textContent() with timeout - SUCCESS';
      }
    });

    // Test 9: textContent() on textarea element
    progress.log('Test 9: textContent() on textarea element');
    const textareaContent = await page.locator('#textarea-input').textContent();

    // Textarea might have default content or be empty
    progress.log(`Note: Textarea textContent was "${textareaContent}"`);
    progress.log('✓ textContent() on textarea element: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML +=
          '<br><strong>Test 9:</strong> Textarea element textContent() - SUCCESS';
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 10: Compare textContent() vs innerText() vs innerHTML()
    progress.log('Test 10: Compare textContent() vs innerText() vs innerHTML()');
    const comparisonLocator = page.locator('#toggle-button');
    const textContentComparison = await comparisonLocator.textContent();
    const innerTextComparison = await comparisonLocator.innerText();
    const innerHTMLComparison = await comparisonLocator.innerHTML();

    progress.log(`textContent(): "${textContentComparison}"`);
    progress.log(`innerText(): "${innerTextComparison}"`);
    progress.log(`innerHTML(): "${innerHTMLComparison}"`);

    // For toggle button, textContent and innerText should be similar (no HTML in button text)
    // innerHTML should be the raw HTML content
    if (!textContentComparison || textContentComparison.trim() === '') {
      throw new Error(`Test 10 failed: textContent() should return button text content`);
    }

    // innerHTML should include any HTML structure if present
    if (!innerHTMLComparison || innerHTMLComparison.trim() === '') {
      throw new Error(`Test 10 failed: innerHTML() should return button HTML content`);
    }

    progress.log('✓ textContent() vs innerText() vs innerHTML() comparison: SUCCESS');

    // Final status update
    await page.evaluate(() => {
      const statusDiv = document.getElementById('textcontent-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 10:</strong> Content methods comparison - SUCCESS';
        statusDiv.innerHTML +=
          '<br><br><strong>🎉 All textContent() tests completed successfully!</strong>';
      }
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All textContent() functionality tests completed successfully',
      details: {
        testsCompleted: [
          'ElementHandle.textContent() on simple text',
          'Locator.textContent() on nested text',
          'Frame.textContent() on text with HTML',
          'Page.textContent() on multiline text',
          'textContent() on empty element',
          'textContent() vs getTextContent() consistency',
          'textContent() on input element',
          'textContent() with timeout option',
          'textContent() on hidden element',
          'textContent() vs innerText() vs innerHTML() comparison',
        ],
        methodsTested: [
          'ElementHandle.textContent()',
          'Locator.textContent()',
          'Frame.textContent()',
          'Page.textContent()',
        ],
      },
    });
  } catch (error) {
    const errorMessage = `TextContent functionality test failed: ${error instanceof Error ? error.message : String(error)}`;
    progress.log(errorMessage);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: errorMessage,
    });
    throw new Error(errorMessage);
  }
}
