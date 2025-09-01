import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testSetCheckedFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting setChecked() functionality tests',
    });

    // Test 1: SetChecked(true) on initially unchecked checkbox
    progress.log(
      'Test 1: Setting checked state to true on initially unchecked checkbox (#test-checkbox)',
    );
    const testCheckboxLocator = page.locator('#test-checkbox');

    // Set to checked state
    await testCheckboxLocator.setChecked(true);
    progress.log('Successfully set test checkbox to checked state using setChecked(true)');

    // Verify it's checked
    const isChecked1 = await testCheckboxLocator.isChecked();
    if (!isChecked1) {
      throw new Error('Checkbox should be checked after setChecked(true)');
    }
    progress.log('Verified: Checkbox is now checked');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: setChecked(true) successfully checked unchecked checkbox',
    });

    // Test 2: SetChecked(false) on checked checkbox
    progress.log('Test 2: Setting checked state to false on checked checkbox');

    await testCheckboxLocator.setChecked(false);
    progress.log('Successfully set test checkbox to unchecked state using setChecked(false)');

    // Verify it's unchecked
    const isChecked2 = await testCheckboxLocator.isChecked();
    if (isChecked2) {
      throw new Error('Checkbox should be unchecked after setChecked(false)');
    }
    progress.log('Verified: Checkbox is now unchecked');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: setChecked(false) successfully unchecked checked checkbox',
    });

    // Test 3: SetChecked(true) on already checked checkbox (idempotent)
    progress.log(
      'Test 3: Testing setChecked(true) idempotent behavior on already checked checkbox',
    );
    const advancedModeLocator = page.locator('#advanced-mode');

    // First ensure it's checked
    await advancedModeLocator.setChecked(true);
    progress.log('Set advanced-mode checkbox to checked state');

    // Call setChecked(true) again (should be idempotent)
    await advancedModeLocator.setChecked(true);
    progress.log('Called setChecked(true) again on already checked checkbox');

    // Verify it's still checked
    const isChecked3 = await advancedModeLocator.isChecked();
    if (!isChecked3) {
      throw new Error('Checkbox should remain checked after redundant setChecked(true)');
    }
    progress.log('Verified: Checkbox remains checked (idempotent behavior)');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: setChecked(true) is idempotent on already checked checkbox',
    });

    // Test 4: SetChecked(false) on already unchecked checkbox (idempotent)
    progress.log(
      'Test 4: Testing setChecked(false) idempotent behavior on already unchecked checkbox',
    );

    // First ensure it's unchecked
    await testCheckboxLocator.setChecked(false);
    progress.log('Set test checkbox to unchecked state');

    // Call setChecked(false) again (should be idempotent)
    await testCheckboxLocator.setChecked(false);
    progress.log('Called setChecked(false) again on already unchecked checkbox');

    // Verify it's still unchecked
    const isChecked4 = await testCheckboxLocator.isChecked();
    if (isChecked4) {
      throw new Error('Checkbox should remain unchecked after redundant setChecked(false)');
    }
    progress.log('Verified: Checkbox remains unchecked (idempotent behavior)');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: setChecked(false) is idempotent on already unchecked checkbox',
    });

    // Test 5: ElementHandle.setChecked() functionality
    progress.log('Test 5: Testing ElementHandle.setChecked() functionality');
    const checkboxHandle = await testCheckboxLocator.elementHandle();

    // Test setting to checked via ElementHandle
    await checkboxHandle.setChecked(true);
    progress.log('Successfully used ElementHandle.setChecked(true)');

    // Verify it's checked
    const isChecked5 = await checkboxHandle.isChecked();
    if (!isChecked5) {
      throw new Error('Checkbox should be checked after ElementHandle.setChecked(true)');
    }
    progress.log('Verified: ElementHandle.setChecked(true) worked correctly');

    // Test setting to unchecked via ElementHandle
    await checkboxHandle.setChecked(false);
    progress.log('Successfully used ElementHandle.setChecked(false)');

    // Verify it's unchecked
    const isChecked6 = await checkboxHandle.isChecked();
    if (isChecked6) {
      throw new Error('Checkbox should be unchecked after ElementHandle.setChecked(false)');
    }
    progress.log('Verified: ElementHandle.setChecked(false) worked correctly');

    checkboxHandle.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: ElementHandle.setChecked() methods work correctly',
    });

    // Test 6: Frame.setChecked() functionality
    progress.log('Test 6: Testing Frame.setChecked() functionality');
    const frame = page.mainFrame();

    // Test frame-level setChecked
    await frame.setChecked('#test-checkbox', true);
    progress.log('Successfully used Frame.setChecked(selector, true)');

    // Verify via locator
    const isChecked7 = await testCheckboxLocator.isChecked();
    if (!isChecked7) {
      throw new Error('Checkbox should be checked after Frame.setChecked(selector, true)');
    }
    progress.log('Verified: Frame.setChecked() worked correctly');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 6 passed: Frame.setChecked() method works correctly',
    });

    // Test 7: Page.setChecked() functionality
    progress.log('Test 7: Testing Page.setChecked() functionality');

    // Test page-level setChecked
    await page.setChecked('#advanced-mode', false);
    progress.log('Successfully used Page.setChecked(selector, false)');

    // Verify via locator
    const isChecked8 = await advancedModeLocator.isChecked();
    if (isChecked8) {
      throw new Error('Checkbox should be unchecked after Page.setChecked(selector, false)');
    }
    progress.log('Verified: Page.setChecked() worked correctly');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 7 passed: Page.setChecked() method works correctly',
    });

    // Reset checkboxes to their default states for other tests
    await page.setChecked('#test-checkbox', false); // Default unchecked
    await page.setChecked('#advanced-mode', true); // Default checked
    progress.log('Reset checkboxes to their default states');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All setChecked() functionality tests completed successfully',
      details: {
        testsCompleted: [
          'Locator.setChecked(true) on unchecked element',
          'Locator.setChecked(false) on checked element',
          'setChecked(true) idempotent behavior',
          'setChecked(false) idempotent behavior',
          'ElementHandle.setChecked() methods',
          'Frame.setChecked() method',
          'Page.setChecked() method',
        ],
      },
    });
  } catch (error) {
    const errorMessage = `setChecked functionality test failed: ${error instanceof Error ? error.message : String(error)}`;
    progress.log(errorMessage);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: errorMessage,
    });
    throw new Error(errorMessage);
  }
}
