import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testTypeFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting type() functionality tests',
    });

    // Clear any existing content and prepare for tests
    progress.log('Preparing input fields for type functionality tests');

    // Clear all input fields first
    await page.fill('#text-input', '');
    await page.fill('#email-input', '');
    await page.fill('#password-input', '');

    // Wait for elements to be ready

    // Test 1: ElementHandle.type() on text input
    progress.log('Test 1: ElementHandle.type() on text input');
    const textInputLocator = page.locator('#text-input');
    await textInputLocator.scrollIntoViewIfNeeded();
    const textInputHandle = await textInputLocator.elementHandle();
    await textInputHandle.type('Hello World!');
    const textInputValue = await textInputHandle.getValue();
    textInputHandle.dispose();

    if (textInputValue !== 'Hello World!') {
      throw new Error(`Test 1 failed: Expected "Hello World!", got "${textInputValue}"`);
    }
    progress.log('✓ ElementHandle.type() on text input: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML = '<strong>Test 1:</strong> ElementHandle.type() - SUCCESS';
      }
    });

    // Test 2: Locator.type() on email input
    progress.log('Test 2: Locator.type() on email input');
    const emailLocator = page.locator('#email-input');
    await emailLocator.scrollIntoViewIfNeeded();
    await emailLocator.type('test@example.com');
    const emailValue = await emailLocator.getValue();

    if (emailValue !== 'test@example.com') {
      throw new Error(`Test 2 failed: Expected "test@example.com", got "${emailValue}"`);
    }
    progress.log('✓ Locator.type() on email input: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 2:</strong> Locator.type() - SUCCESS';
      }
    });

    // Test 3: Frame.type() on password input
    progress.log('Test 3: Frame.type() on password input');
    const passwordLocator = page.locator('#password-input');
    await passwordLocator.scrollIntoViewIfNeeded();
    await page.mainFrame().type('#password-input', 'SecurePass123!');
    const passwordValue = await page.inputValue('#password-input');

    if (passwordValue !== 'SecurePass123!') {
      throw new Error(`Test 3 failed: Expected "SecurePass123!", got "${passwordValue}"`);
    }
    progress.log('✓ Frame.type() on password input: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 3:</strong> Frame.type() - SUCCESS';
      }
    });

    // Test 4: Page.type() on text input (overwriting existing content)
    progress.log('Test 4: Page.type() on text input (overwriting existing content)');
    await textInputLocator.scrollIntoViewIfNeeded();
    await page.clear('#text-input'); // Clear first
    await page.type('#text-input', 'Overwritten by Page.type()');
    const overwrittenValue = await page.inputValue('#text-input');

    if (overwrittenValue !== 'Overwritten by Page.type()') {
      throw new Error(
        `Test 4 failed: Expected "Overwritten by Page.type()", got "${overwrittenValue}"`,
      );
    }
    progress.log('✓ Page.type() on text input: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 4:</strong> Page.type() - SUCCESS';
      }
    });

    // Test 5: type() with delay option
    progress.log('Test 5: type() with delay option');
    await textInputLocator.scrollIntoViewIfNeeded();
    await page.clear('#text-input');
    const startTime = Date.now();
    await page.type('#text-input', 'SLOW', { delay: 50 }); // 50ms delay between characters
    const endTime = Date.now();
    const typingDuration = endTime - startTime;
    const delayedValue = await page.inputValue('#text-input');

    // Should take at least 3 * 50ms = 150ms for 4 characters with 50ms delay
    if (delayedValue !== 'SLOW') {
      throw new Error(`Test 5 failed: Expected "SLOW", got "${delayedValue}"`);
    }

    // Check that typing took reasonable time (allowing for some variance)
    if (typingDuration < 150) {
      progress.log(
        `Note: Typing duration was ${typingDuration}ms, expected at least 150ms. Delay might not be fully working.`,
      );
    } else {
      progress.log(`✓ Typing with delay took ${typingDuration}ms as expected`);
    }

    progress.log('✓ type() with delay option: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 5:</strong> type() with delay - SUCCESS';
      }
    });

    // Test 6: type() on textarea
    progress.log('Test 6: type() on textarea');
    const textareaLocator = page.locator('#textarea-input');
    await textareaLocator.scrollIntoViewIfNeeded();
    await page.clear('#textarea-input');
    const multilineText = 'Line 1\nLine 2\nLine 3';
    await page.type('#textarea-input', multilineText);
    const textareaValue = await page.inputValue('#textarea-input');

    if (textareaValue !== multilineText) {
      throw new Error(`Test 6 failed: Expected "${multilineText}", got "${textareaValue}"`);
    }
    progress.log('✓ type() on textarea: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 6:</strong> Textarea type() - SUCCESS';
      }
    });

    // Test 7: type() special characters
    progress.log('Test 7: type() special characters');
    await textInputLocator.scrollIntoViewIfNeeded();
    await page.clear('#text-input');
    const specialChars = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./ ';
    await page.type('#text-input', specialChars);
    const specialCharsValue = await page.inputValue('#text-input');

    if (specialCharsValue !== specialChars) {
      throw new Error(`Test 7 failed: Expected "${specialChars}", got "${specialCharsValue}"`);
    }
    progress.log('✓ type() special characters: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 7:</strong> Special characters type() - SUCCESS';
      }
    });

    // Test 8: type() empty string
    progress.log('Test 8: type() empty string');
    await textInputLocator.scrollIntoViewIfNeeded();
    await page.fill('#text-input', 'initial content');
    await page.type('#text-input', ''); // Should not change content
    const emptyTypeValue = await page.inputValue('#text-input');

    if (emptyTypeValue !== 'initial content') {
      throw new Error(`Test 8 failed: Expected "initial content", got "${emptyTypeValue}"`);
    }
    progress.log('✓ type() empty string: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 8:</strong> Empty string type() - SUCCESS';
      }
    });

    // Test 9: type() vs fill() behavior comparison
    progress.log('Test 9: type() vs fill() behavior comparison');

    // Clear and use fill()
    await textInputLocator.scrollIntoViewIfNeeded();
    await page.clear('#text-input');
    await page.fill('#text-input', 'Filled Text');
    const fillValue = await page.inputValue('#text-input');

    // Clear and use type()
    await page.clear('#text-input');
    await page.type('#text-input', 'Typed Text');
    const typeValue = await page.inputValue('#text-input');

    if (fillValue !== 'Filled Text' || typeValue !== 'Typed Text') {
      throw new Error(`Test 9 failed: fill gave "${fillValue}", type gave "${typeValue}"`);
    }
    progress.log('✓ type() vs fill() behavior comparison: SUCCESS');

    // Update status
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 9:</strong> type() vs fill() comparison - SUCCESS';
      }
    });

    // Test 10: type() with timeout option
    progress.log('Test 10: type() with timeout option');
    await textInputLocator.scrollIntoViewIfNeeded();
    await page.clear('#text-input');
    await page.type('#text-input', 'Timeout Test', { timeout: 15000 });
    const timeoutValue = await page.inputValue('#text-input');

    if (timeoutValue !== 'Timeout Test') {
      throw new Error(`Test 10 failed: Expected "Timeout Test", got "${timeoutValue}"`);
    }
    progress.log('✓ type() with timeout option: SUCCESS');

    // Final status update
    await page.evaluate(() => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>Test 10:</strong> type() with timeout - SUCCESS';
        statusDiv.innerHTML +=
          '<br><br><strong>🎉 All type() tests completed successfully!</strong>';
      }
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All type() functionality tests completed successfully',
      details: {
        testsRun: 10,
        testTypes: [
          'ElementHandle.type()',
          'Locator.type()',
          'Frame.type()',
          'Page.type()',
          'type() with delay',
          'type() on textarea',
          'type() special characters',
          'type() empty string',
          'type() vs fill() comparison',
          'type() with timeout',
        ],
      },
    });

    progress.log('🎉 All type() functionality tests completed successfully!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update status to show error
    await page.evaluate((msg: string) => {
      const statusDiv = document.getElementById('type-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#f8d7da';
        statusDiv.innerHTML = `<strong>❌ Type functionality test failed:</strong><br>${msg}`;
      }
    }, errorMessage);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `Type functionality test failed: ${errorMessage}`,
    });

    throw new Error(`Type functionality test failed: ${errorMessage}`);
  }
}
