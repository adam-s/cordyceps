import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testApiConsistencyAcrossLayers(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting API consistency tests across all layers',
    });

    const frame = page.mainFrame();
    const locator = page.locator('#action-button');

    // Test 1: getAttribute consistency
    progress.log('Test 1: Testing getAttribute consistency across layers');
    const pageAttr = await page.getAttribute('#action-button', 'type');
    const frameAttr = await frame.getAttribute('#action-button', 'type');
    const locatorAttr = await locator.getAttribute('type');

    progress.log(`Page getAttribute: ${pageAttr}`);
    progress.log(`Frame getAttribute: ${frameAttr}`);
    progress.log(`Locator getAttribute: ${locatorAttr}`);

    if (pageAttr === frameAttr && frameAttr === locatorAttr && pageAttr === 'button') {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: getAttribute consistent across all layers',
        details: { value: pageAttr },
      });
    } else {
      throw new Error(
        `Test 1 failed: Inconsistent getAttribute results: Page=${pageAttr}, Frame=${frameAttr}, Locator=${locatorAttr}`,
      );
    }

    // Test 2: innerText consistency
    progress.log('Test 2: Testing innerText consistency across layers');
    const pageText = await page.innerText('#action-button');
    const frameText = await frame.innerText('#action-button');
    const locatorText = await locator.innerText();

    // Normalize whitespace for comparison
    const normalizedPageText = pageText.replace(/\s+/g, ' ').trim();
    const normalizedFrameText = frameText.replace(/\s+/g, ' ').trim();
    const normalizedLocatorText = locatorText.replace(/\s+/g, ' ').trim();

    progress.log(`Page innerText: "${normalizedPageText}"`);
    progress.log(`Frame innerText: "${normalizedFrameText}"`);
    progress.log(`Locator innerText: "${normalizedLocatorText}"`);

    if (
      normalizedPageText === normalizedFrameText &&
      normalizedFrameText === normalizedLocatorText &&
      normalizedPageText.includes('Perform Action')
    ) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: innerText consistent across all layers',
        details: { text: normalizedPageText },
      });
    } else {
      throw new Error(
        `Test 2 failed: Inconsistent innerText results: Page="${normalizedPageText}", Frame="${normalizedFrameText}", Locator="${normalizedLocatorText}"`,
      );
    }

    // Test 3: isVisible consistency
    progress.log('Test 3: Testing isVisible consistency across layers');
    const pageVisible = await page.isVisible('#action-button');
    const frameVisible = await frame.isVisible('#action-button');
    const locatorVisible = await locator.isVisible();

    progress.log(`Page isVisible: ${pageVisible}`);
    progress.log(`Frame isVisible: ${frameVisible}`);
    progress.log(`Locator isVisible: ${locatorVisible}`);

    if (pageVisible === frameVisible && frameVisible === locatorVisible && pageVisible === true) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: isVisible consistent across all layers',
        details: { visible: pageVisible },
      });
    } else {
      throw new Error(
        `Test 3 failed: Inconsistent isVisible results: Page=${pageVisible}, Frame=${frameVisible}, Locator=${locatorVisible}`,
      );
    }

    // Test 4: isEnabled consistency
    progress.log('Test 4: Testing isEnabled consistency across layers');
    const pageEnabled = await page.isEnabled('#action-button');
    const frameEnabled = await frame.isEnabled('#action-button');
    const locatorEnabled = await locator.isEnabled();

    progress.log(`Page isEnabled: ${pageEnabled}`);
    progress.log(`Frame isEnabled: ${frameEnabled}`);
    progress.log(`Locator isEnabled: ${locatorEnabled}`);

    if (pageEnabled === frameEnabled && frameEnabled === locatorEnabled && pageEnabled === true) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: isEnabled consistent across all layers',
        details: { enabled: pageEnabled },
      });
    } else {
      throw new Error(
        `Test 4 failed: Inconsistent isEnabled results: Page=${pageEnabled}, Frame=${frameEnabled}, Locator=${locatorEnabled}`,
      );
    }

    // Test 5: Form input consistency (inputValue)
    progress.log('Test 5: Testing inputValue consistency with form inputs');
    const testValue = 'consistency-test@example.com';

    // Use Page to fill
    await page.fill('#email-input', testValue);

    // Check with all layers
    const pageInputValue = await page.inputValue('#email-input');
    const frameInputValue = await frame.inputValue('#email-input');
    const locatorInputValue = await page.locator('#email-input').inputValue();

    progress.log(`Page inputValue: "${pageInputValue}"`);
    progress.log(`Frame inputValue: "${frameInputValue}"`);
    progress.log(`Locator inputValue: "${locatorInputValue}"`);

    if (
      pageInputValue === frameInputValue &&
      frameInputValue === locatorInputValue &&
      pageInputValue === testValue
    ) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: inputValue consistent across all layers',
        details: { value: pageInputValue },
      });
    } else {
      throw new Error(
        `Test 5 failed: Inconsistent inputValue results: Page="${pageInputValue}", Frame="${frameInputValue}", Locator="${locatorInputValue}"`,
      );
    }

    // Test 6: Checkbox state consistency (isChecked)
    progress.log('Test 6: Testing isChecked consistency with checkbox');
    const checkboxLocator = page.locator('#test-checkbox');

    // Get initial state from all layers
    const pageCheckedBefore = await page.isChecked('#test-checkbox');
    const frameCheckedBefore = await frame.isChecked('#test-checkbox');
    const locatorCheckedBefore = await checkboxLocator.isChecked();

    // Toggle using Locator
    await checkboxLocator.click();

    // Check state from all layers after toggle
    const pageCheckedAfter = await page.isChecked('#test-checkbox');
    const frameCheckedAfter = await frame.isChecked('#test-checkbox');
    const locatorCheckedAfter = await checkboxLocator.isChecked();

    progress.log(
      `Before click - Page: ${pageCheckedBefore}, Frame: ${frameCheckedBefore}, Locator: ${locatorCheckedBefore}`,
    );
    progress.log(
      `After click - Page: ${pageCheckedAfter}, Frame: ${frameCheckedAfter}, Locator: ${locatorCheckedAfter}`,
    );

    if (
      pageCheckedBefore === frameCheckedBefore &&
      frameCheckedBefore === locatorCheckedBefore &&
      pageCheckedAfter === frameCheckedAfter &&
      frameCheckedAfter === locatorCheckedAfter &&
      pageCheckedBefore !== pageCheckedAfter
    ) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 6 passed: isChecked consistent across all layers and state changed',
        details: {
          before: pageCheckedBefore,
          after: pageCheckedAfter,
        },
      });
    } else {
      throw new Error(
        `Test 6 failed: Inconsistent isChecked results or state didn't change properly`,
      );
    }

    // Test 7: Element interaction consistency (hover)
    progress.log('Test 7: Testing hover consistency across layers');
    try {
      // Test hover on all layers - they should all work without throwing
      await page.hover('#action-button');
      await frame.hover('#action-button');
      await locator.hover();

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 7 passed: hover works consistently across all layers',
      });
    } catch (error) {
      throw new Error(
        `Test 7 failed: hover inconsistency: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'API consistency tests across all layers completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace available';

    progress.log(`API consistency test failed: ${errorMessage}`);
    progress.log(`Error stack trace: ${errorStack}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'API consistency tests failed',
      details: {
        error: errorMessage,
        stack: errorStack,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
    });
    throw error;
  }
}
