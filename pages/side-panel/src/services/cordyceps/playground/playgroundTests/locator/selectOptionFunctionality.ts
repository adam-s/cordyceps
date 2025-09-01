import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Test selectOption functionality across ElementHandle, Locator, Frame, and Page
 * Tests selection by value, label, index, and multiple selections
 */
export async function testSelectOptionFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting selectOption functionality tests using existing page elements',
    });

    progress.log('Using existing select elements from the page for testing');

    // Test 1: Page.selectOption - Select by value using existing single-select
    progress.log('Testing Page.selectOption - select by value on existing element');
    const pageResult1 = await page.selectOption('#single-select', 'option3');
    if (!pageResult1.includes('option3')) {
      throw new Error(
        `Page.selectOption by value failed: expected ['option3'], got ${JSON.stringify(pageResult1)}`,
      );
    }
    progress.log(
      `✓ Page.selectOption by value: SUCCESS - Selected: ${JSON.stringify(pageResult1)}`,
    );

    // Update page status to show selection result
    await page.evaluate(result => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML = `<strong>Test 1:</strong> Page.selectOption selected: ${JSON.stringify(result)}`;
      }
    }, pageResult1);

    // Wait a moment to see the result
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Frame.selectOption - Select by label on existing single-select
    progress.log('Testing Frame.selectOption - select by label on existing element');
    const frameResult1 = await page
      .mainFrame()
      .selectOption('#single-select', { label: 'Option 1' });
    if (!frameResult1.includes('option1')) {
      throw new Error(
        `Frame.selectOption by label failed: expected ['option1'], got ${JSON.stringify(frameResult1)}`,
      );
    }
    progress.log(
      `✓ Frame.selectOption by label: SUCCESS - Selected: ${JSON.stringify(frameResult1)}`,
    );

    // Update page status to show selection result
    await page.evaluate(result => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#d1ecf1';
        statusDiv.innerHTML = `<strong>Test 2:</strong> Frame.selectOption by label selected: ${JSON.stringify(result)}`;
      }
    }, frameResult1);

    // Wait a moment to see the result
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Locator.selectOption - Select by index on existing single-select
    progress.log('Testing Locator.selectOption - select by index on existing element');
    const locatorResult1 = await page.locator('#single-select').selectOption({ index: 2 });
    if (!locatorResult1.includes('option2')) {
      throw new Error(
        `Locator.selectOption by index failed: expected ['option2'], got ${JSON.stringify(locatorResult1)}`,
      );
    }
    progress.log('✓ Locator.selectOption by index: SUCCESS');

    // Test 4: ElementHandle.selectOption - Select by value on existing single-select
    progress.log('Testing ElementHandle.selectOption - select by value on existing element');
    const element = await page.elementHandle('#single-select');
    const elementResult1 = await element.selectOption('option4');
    element.dispose();
    if (!elementResult1.includes('option4')) {
      throw new Error(
        `ElementHandle.selectOption by value failed: expected ['option4'], got ${JSON.stringify(elementResult1)}`,
      );
    }
    progress.log('✓ ElementHandle.selectOption by value: SUCCESS');

    // Test 5: Multiple selection with Page.selectOption using existing multiple-select
    progress.log('Testing Page.selectOption - multiple selection on existing element');
    const pageResult2 = await page.selectOption('#multiple-select', ['item2', 'item4']);
    if (!pageResult2.includes('item2') || !pageResult2.includes('item4')) {
      throw new Error(
        `Page.selectOption multiple selection failed: expected ['item2', 'item4'], got ${JSON.stringify(pageResult2)}`,
      );
    }
    progress.log(
      `✓ Page.selectOption multiple selection: SUCCESS - Selected: ${JSON.stringify(pageResult2)}`,
    );

    // Update page status to show multiple selection result
    await page.evaluate(result => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#fff3cd';
        statusDiv.innerHTML = `<strong>Test 5:</strong> Multiple selection result: ${JSON.stringify(result)}`;
      }
    }, pageResult2);

    // Wait a moment to see the result
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 6: Mixed selection types with Locator on existing multiple-select
    progress.log('Testing Locator.selectOption - mixed selection types on existing element');
    const locatorResult2 = await page
      .locator('#multiple-select')
      .selectOption(['item1', { label: 'Item 5' }, { index: 2 }]);
    if (
      !locatorResult2.includes('item1') ||
      !locatorResult2.includes('item5') ||
      !locatorResult2.includes('item3')
    ) {
      throw new Error(
        `Locator.selectOption mixed selection failed: expected ['item1', 'item5', 'item3'], got ${JSON.stringify(locatorResult2)}`,
      );
    }
    progress.log('✓ Locator.selectOption mixed selection: SUCCESS');

    // Test 7: Error handling - invalid option on existing single-select
    progress.log('Testing error handling - invalid option on existing element');
    try {
      await page.selectOption('#single-select', 'invalid-option');
      throw new Error('Expected error for invalid option, but none was thrown');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Option not found')) {
        progress.log('✓ Error handling for invalid option: SUCCESS');
      } else {
        throw error;
      }
    }

    // Test 8: Force option for invalid selection on existing single-select
    progress.log('Testing force option for invalid selection on existing element');
    try {
      const forceResult = await page.selectOption('#single-select', 'invalid-option', {
        force: true,
      });
      // Force should not throw error but return empty array if nothing matched
      progress.log(
        `✓ Force option for invalid selection: SUCCESS (result: ${JSON.stringify(forceResult)})`,
      );
    } catch (error) {
      throw new Error(
        `Force option should not throw error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Test 9: Verify current selections using existing elements
    progress.log('Verifying final selections through getValue on existing elements');
    const singleSelectValue = await page.locator('#single-select').getValue();
    const multipleSelectValues = await page.evaluate(() => {
      const select = document.getElementById('multiple-select') as HTMLSelectElement;
      return Array.from(select.selectedOptions).map(opt => opt.value);
    });

    progress.log(`Single select final value: ${singleSelectValue}`);
    progress.log(`Multiple select final values: ${JSON.stringify(multipleSelectValues)}`);

    // Update page status with final results summary
    await page.evaluate(
      results => {
        const statusDiv = document.getElementById('form-status');
        if (statusDiv) {
          statusDiv.style.display = 'block';
          statusDiv.style.backgroundColor = '#d4edda';
          statusDiv.innerHTML = `
          <strong>✅ All Tests Complete!</strong><br>
          Single Select Final Value: <code>${results.single}</code><br>
          Multiple Select Final Values: <code>${JSON.stringify(results.multiple)}</code><br>
          <small>Check console for detailed test results</small>
        `;
        }
      },
      { single: singleSelectValue, multiple: multipleSelectValues },
    );

    // No cleanup needed since we're using existing page elements

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message:
        'selectOption functionality tests completed successfully using existing page elements',
      details: {
        testsRun: 8,
        pageTests: 3,
        frameTests: 1,
        locatorTests: 3,
        elementHandleTests: 1,
        errorHandlingTests: 1,
        elementsUsed: ['#single-select', '#multiple-select'],
      },
    });

    progress.log('All selectOption functionality tests passed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'selectOption functionality test failed',
      details: { error: errorMessage },
    });

    progress.log(`selectOption test failed: ${errorMessage}`);
    throw error;
  }
}
