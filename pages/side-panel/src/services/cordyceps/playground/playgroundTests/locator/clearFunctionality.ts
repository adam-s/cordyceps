import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testClearFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting clear() functionality tests',
    });

    // Test 1: Clear text input field that has a value
    progress.log('Test 1: Clearing text input field (#text-input)');
    const textInputLocator = page.locator('#text-input');

    // First, ensure the input has a value to clear
    const initialValue = 'Initial test value';
    await textInputLocator.fill(initialValue);

    // Verify it was filled
    const preClearValue = await textInputLocator.getValue();
    progress.log(`Text input pre-clear value: "${preClearValue}"`);

    // Now clear it
    await textInputLocator.clear();

    // Verify the value was cleared
    const clearedTextValue = await textInputLocator.getValue();

    if (clearedTextValue === '') {
      progress.log(`Text input clear test PASSED - Value cleared successfully`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Text input cleared successfully',
        details: { preClearValue, postClearValue: clearedTextValue },
      });
    } else {
      progress.log(`Text input clear test FAILED - Expected: "", Got: "${clearedTextValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 1 failed: Text input clear verification failed',
        details: { expectedValue: '', actualValue: clearedTextValue },
      });
    }

    // Test 2: Clear email input field
    progress.log('Test 2: Clearing email input field (#email-input)');
    const emailInputLocator = page.locator('#email-input');

    // First, ensure the email input has a value to clear
    const initialEmail = 'test@example.com';
    await emailInputLocator.fill(initialEmail);

    // Verify it was filled
    const preClearEmail = await emailInputLocator.getValue();
    progress.log(`Email input pre-clear value: "${preClearEmail}"`);

    // Now clear it
    await emailInputLocator.clear();

    // Verify the email value was cleared
    const clearedEmailValue = await emailInputLocator.getValue();

    if (clearedEmailValue === '') {
      progress.log(`Email input clear test PASSED - Value cleared successfully`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Email input cleared successfully',
        details: { preClearValue: preClearEmail, postClearValue: clearedEmailValue },
      });
    } else {
      progress.log(`Email input clear test FAILED - Expected: "", Got: "${clearedEmailValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 2 failed: Email input clear verification failed',
        details: { expectedValue: '', actualValue: clearedEmailValue },
      });
    }

    // Test 3: Clear textarea field
    progress.log('Test 3: Clearing textarea field (#textarea-input)');
    const textareaLocator = page.locator('#textarea-input');

    // First, ensure the textarea has a value to clear
    const initialTextareaValue = 'This is a test message in a textarea that will be cleared.';
    await textareaLocator.fill(initialTextareaValue);

    // Verify it was filled
    const preClearTextarea = await textareaLocator.getValue();
    progress.log(`Textarea pre-clear value: "${preClearTextarea}"`);

    // Now clear it
    await textareaLocator.clear();

    // Verify the textarea value was cleared
    const clearedTextareaValue = await textareaLocator.getValue();

    if (clearedTextareaValue === '') {
      progress.log(`Textarea clear test PASSED - Value cleared successfully`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Textarea cleared successfully',
        details: { preClearValue: preClearTextarea, postClearValue: clearedTextareaValue },
      });
    } else {
      progress.log(`Textarea clear test FAILED - Expected: "", Got: "${clearedTextareaValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 3 failed: Textarea clear verification failed',
        details: { expectedValue: '', actualValue: clearedTextareaValue },
      });
    }

    // Test 4: Clear password input field
    progress.log('Test 4: Clearing password input field (#password-input)');
    const passwordInputLocator = page.locator('#password-input');

    // First, ensure the password input has a value to clear
    const initialPassword = 'SecurePassword123!';
    await passwordInputLocator.fill(initialPassword);

    // Verify it was filled
    const preClearPassword = await passwordInputLocator.getValue();
    progress.log(`Password input pre-clear value: "${preClearPassword}"`);

    // Now clear it
    await passwordInputLocator.clear();

    // Verify the password value was cleared
    const clearedPasswordValue = await passwordInputLocator.getValue();

    if (clearedPasswordValue === '') {
      progress.log(`Password input clear test PASSED - Value cleared successfully`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Password input cleared successfully',
        details: { preClearValue: preClearPassword, postClearValue: clearedPasswordValue },
      });
    } else {
      progress.log(
        `Password input clear test FAILED - Expected: "", Got: "${clearedPasswordValue}"`,
      );
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 4 failed: Password input clear verification failed',
        details: { expectedValue: '', actualValue: clearedPasswordValue },
      });
    }

    // Test 5: Clear already empty input (should be idempotent)
    progress.log('Test 5: Clearing already empty text input (#text-input)');

    // Ensure it's already empty from previous test
    await textInputLocator.clear();

    // Verify it's empty
    const alreadyEmptyValue = await textInputLocator.getValue();

    if (alreadyEmptyValue === '') {
      progress.log(`Clear empty input test PASSED - Idempotent operation successful`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: Clear operation on empty input is idempotent',
        details: { value: alreadyEmptyValue },
      });
    } else {
      progress.log(`Clear empty input test FAILED - Expected: "", Got: "${alreadyEmptyValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 5 failed: Clear operation on empty input failed',
        details: { expectedValue: '', actualValue: alreadyEmptyValue },
      });
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Clear functionality tests completed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Clear functionality test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Clear functionality tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}
