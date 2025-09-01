import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testFillFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting fill() functionality tests',
    });

    // Test 1: Fill text input field
    progress.log('Test 1: Filling text input field (#text-input)');
    const textInputLocator = page.locator('#text-input');

    const testValue1 = 'Hello World!';
    await textInputLocator.fill(testValue1);

    // Verify the value was set correctly
    const textValue = await textInputLocator.getValue();

    if (textValue === testValue1) {
      progress.log(`Text input fill test PASSED - Value: "${textValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Text input filled successfully',
        details: { expectedValue: testValue1, actualValue: textValue },
      });
    } else {
      progress.log(`Text input fill test FAILED - Expected: "${testValue1}", Got: "${textValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 1 failed: Text input fill verification failed',
        details: { expectedValue: testValue1, actualValue: textValue },
      });
    }

    // Test 2: Fill email input field
    progress.log('Test 2: Filling email input field (#email-input)');
    const emailInputLocator = page.locator('#email-input');

    const testEmail = 'test@example.com';
    await emailInputLocator.fill(testEmail);

    // Verify the email value was set correctly
    const emailValue = await emailInputLocator.getValue();

    if (emailValue === testEmail) {
      progress.log(`Email input fill test PASSED - Value: "${emailValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Email input filled successfully',
        details: { expectedValue: testEmail, actualValue: emailValue },
      });
    } else {
      progress.log(`Email input fill test FAILED - Expected: "${testEmail}", Got: "${emailValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 2 failed: Email input fill verification failed',
        details: { expectedValue: testEmail, actualValue: emailValue },
      });
    }

    // Test 3: Fill textarea field
    progress.log('Test 3: Filling textarea field (#textarea-input)');
    const textareaLocator = page.locator('#textarea-input');

    const testTextareaValue = 'This is a test message in a textarea.';
    await textareaLocator.fill(testTextareaValue);

    // Verify the textarea value was set correctly
    const textareaValue = await textareaLocator.getValue();

    if (textareaValue === testTextareaValue) {
      progress.log(`Textarea fill test PASSED - Value: "${textareaValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Textarea filled successfully',
        details: { expectedValue: testTextareaValue, actualValue: textareaValue },
      });
    } else {
      progress.log(
        `Textarea fill test FAILED - Expected: "${testTextareaValue}", Got: "${textareaValue}"`,
      );
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 3 failed: Textarea fill verification failed',
        details: { expectedValue: testTextareaValue, actualValue: textareaValue },
      });
    }

    // Test 4: Fill password input field
    progress.log('Test 4: Filling password input field (#password-input)');
    const passwordInputLocator = page.locator('#password-input');

    const testPassword = 'SecurePassword123!';
    await passwordInputLocator.fill(testPassword);

    // Verify the password value was set correctly
    const passwordValue = await passwordInputLocator.getValue();

    if (passwordValue === testPassword) {
      progress.log(`Password input fill test PASSED - Value set correctly`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Password input filled successfully',
        details: { expectedValue: testPassword, actualValue: passwordValue },
      });
    } else {
      progress.log(
        `Password input fill test FAILED - Expected: "${testPassword}", Got: "${passwordValue}"`,
      );
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 4 failed: Password input fill verification failed',
        details: { expectedValue: testPassword, actualValue: passwordValue },
      });
    }

    // Test 5: Overwrite existing value in text input
    progress.log('Test 5: Overwriting existing value in text input (#text-input)');
    const overwriteValue = 'Overwritten value';
    await textInputLocator.fill(overwriteValue);

    // Verify the value was overwritten correctly
    const overwrittenValue = await textInputLocator.getValue();

    if (overwrittenValue === overwriteValue) {
      progress.log(`Text input overwrite test PASSED - Value: "${overwrittenValue}"`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: Text input overwritten successfully',
        details: { expectedValue: overwriteValue, actualValue: overwrittenValue },
      });
    } else {
      progress.log(
        `Text input overwrite test FAILED - Expected: "${overwriteValue}", Got: "${overwrittenValue}"`,
      );
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Test 5 failed: Text input overwrite verification failed',
        details: { expectedValue: overwriteValue, actualValue: overwrittenValue },
      });
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Fill functionality tests completed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Fill functionality test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Fill functionality tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}
