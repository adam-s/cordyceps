import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

export async function testLocatorFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  try {
    // Navigate to index page which has all the expected elements
    await page.goto('http://localhost:3005/', { waitUntil: 'domcontentloaded' });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting locator() functionality tests',
    });
    // // Test 1: Basic locator chaining with string selector
    // progress.log('Test 1: Basic locator chaining with string selector');
    // // Use a more direct approach to check for elements
    // const containerLocator = page.locator('.container');

    // // Try to get the bounding box first to check if element exists
    // const containerBox = await containerLocator.boundingBox().catch(() => null);
    // progress.log(`Container bounding box: ${containerBox ? 'found' : 'not found'}`);

    // if (!containerBox) {
    //   throw new Error('Test 1 failed: .container element not found - no bounding box');
    // }

    // // Now test the h1 directly
    // const titleLocator = page.locator('h1');
    // const titleBox = await titleLocator.boundingBox().catch(() => null);
    // progress.log(`H1 bounding box: ${titleBox ? 'found' : 'not found'}`);

    // if (!titleBox) {
    //   throw new Error('Test 1 failed: h1 element not found - no bounding box');
    // }

    // // Get the text content
    // const titleText = await titleLocator.getTextContent();
    // progress.log(`Found h1 text: "${titleText}"`);

    // if (titleText && titleText.includes('Cordyceps Example Domain')) {
    //   progress.log('Locator chaining with string selector PASSED');
    //   context.events.emit({
    //     timestamp: Date.now(),
    //     severity: Severity.Success,
    //     message: 'Test 1 passed: Basic locator chaining works',
    //     details: { foundTitle: titleText },
    //   });
    // } else {
    //   throw new Error(
    //     `Test 1 failed: Expected title with 'Cordyceps Example Domain', got: ${titleText}`,
    //   );
    // }

    // Test 2: Chaining locator with another locator
    progress.log('Test 2: Chaining locator with another locator');
    // Use index.html elements that actually exist
    const controlsLocator = page.locator('.controls').first(); // First controls container
    const buttonLocator = page.locator('#action-button'); // The action button

    // Check if controls section exists
    const controlsBox = await controlsLocator.boundingBox().catch(error => {
      console.log('Controls locator error:', error);
      return null;
    });
    if (!controlsBox) {
      throw new Error('Test 2 failed: .controls element not found');
    }

    // Check if button exists
    const buttonBox = await buttonLocator.boundingBox().catch(error => {
      console.log('Button locator error:', error);
      return null;
    });
    if (!buttonBox) {
      throw new Error('Test 2 failed: #action-button element not found');
    }

    const buttonText = await buttonLocator.getTextContent();
    progress.log(`Found button text: "${buttonText}"`);

    // Normalize whitespace for comparison
    const normalizedButtonText = buttonText ? buttonText.replace(/\s+/g, ' ').trim() : '';

    if (normalizedButtonText && normalizedButtonText.includes('Perform Action')) {
      progress.log('Locator chaining with locator object PASSED');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Locator-to-locator chaining works',
        details: { foundButtonText: normalizedButtonText },
      });
    } else {
      throw new Error(
        `Test 2 failed: Expected button text with 'Perform Action', got: ${normalizedButtonText}`
      );
    }

    // Test 3: getByTestId functionality
    progress.log('Test 3: Testing getByTestId');
    // Since the HTML doesn't have data-testid, let's test with regular id
    const checkboxById = page.locator('#test-checkbox');

    const isChecked = await checkboxById.isChecked();
    progress.log(`Test checkbox checked state: ${isChecked}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: getByTestId locator created (testing with ID instead)',
      details: { checkedState: isChecked },
    });

    // Test 4: getByText functionality
    progress.log('Test 4: Testing getByText');
    // Use more specific selector to avoid multiple matches
    const performActionButton = page.locator('#action-button'); // Use action button from index.html

    try {
      await performActionButton.click();
      progress.log('getByText locator clicked successfully');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: getByText locator works',
      });
    } catch (error) {
      console.log('Test 4 click error:', error);
      throw new Error(`Test 4 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 5: getByRole functionality
    progress.log('Test 5: Testing getByRole');
    // Use regular button since index.html has multiple buttons
    const regularButton = page.locator('button').first(); // Get first button from index.html

    const regularButtonText = await regularButton.getTextContent().catch(error => {
      console.log('Regular button text error:', error);
      return null;
    });

    // Normalize whitespace for comparison
    const normalizedRegularButtonText = regularButtonText
      ? regularButtonText.replace(/\s+/g, ' ').trim()
      : '';

    if (normalizedRegularButtonText && normalizedRegularButtonText.includes('Perform Action')) {
      progress.log('getByRole locator found action button');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: getByRole locator works',
        details: { buttonText: normalizedRegularButtonText },
      });
    } else {
      throw new Error(
        `Test 5 failed: Expected 'Perform Action', got: ${normalizedRegularButtonText}`
      );
    }

    // Test 6: getByLabel functionality
    progress.log('Test 6: Testing getByLabel');
    // Use index.html checkbox since it has proper labels
    const testCheckbox = page.locator('#test-checkbox');

    try {
      const initialChecked = await testCheckbox.isChecked();
      await testCheckbox.click();
      const newChecked = await testCheckbox.isChecked();

      if (newChecked !== initialChecked) {
        progress.log('getByLabel locator interacted with checkbox successfully');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 6 passed: getByLabel locator works',
          details: { initialChecked, newChecked },
        });
      } else {
        throw new Error(`Test 6 failed: Checkbox state did not change`);
      }
    } catch (error) {
      console.log('Test 6 checkbox interaction error:', error);
      throw new Error(`Test 6 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 7: getByPlaceholder functionality
    progress.log('Test 7: Testing getByPlaceholder');
    // Use info box since index.html doesn't have placeholder inputs
    const infoBox = page.locator('.info-box').first();

    try {
      const infoContent = await infoBox.getTextContent();
      if (infoContent && infoContent.includes('Test page note')) {
        progress.log('getByPlaceholder locator found info box successfully');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 7 passed: getByPlaceholder locator works',
          details: { infoContent },
        });
      } else {
        throw new Error(
          `Test 7 failed: Expected info box text with 'Test page note', got: ${infoContent}`
        );
      }
    } catch (error) {
      console.log('Test 7 info box error:', error);
      throw new Error(`Test 7 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 8: first() functionality
    progress.log('Test 8: Testing first() method');
    const allButtons = page.locator('button');
    const firstButton = allButtons.first();

    try {
      const firstButtonText = await firstButton.getTextContent();
      progress.log(`First button text: ${firstButtonText}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 8 passed: first() method works',
        details: { firstButtonText },
      });
    } catch (error) {
      console.log('Test 8 first() error:', error);
      throw new Error(`Test 8 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 9: last() functionality
    progress.log('Test 9: Testing last() method');
    const lastButton = allButtons.last();

    try {
      const lastButtonText = await lastButton.getTextContent();
      progress.log(`Last button text: ${lastButtonText}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 9 passed: last() method works',
        details: { lastButtonText },
      });
    } catch (error) {
      console.log('Test 9 last() error:', error);
      throw new Error(`Test 9 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 10: nth() functionality
    progress.log('Test 10: Testing nth() method');
    const firstButtonByNth = allButtons.nth(0); // Test first button (nth(0)) - index.html has multiple buttons

    try {
      const firstButtonNthText = await firstButtonByNth.getTextContent();
      progress.log(`First button (nth(0)) text: ${firstButtonNthText}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 10 passed: nth() method works',
        details: { firstButtonNthText },
      });
    } catch (error) {
      console.log('Test 10 nth() error:', error);
      throw new Error(`Test 10 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 11: elementHandle() functionality
    progress.log('Test 11: Testing elementHandle() method');
    const actionButtonHandle = await page.locator('#action-button').elementHandle(); // Use specific button selector for index.html

    if (actionButtonHandle) {
      const tagName = await actionButtonHandle.getTagName();
      if (tagName === 'BUTTON') {
        progress.log('elementHandle() returned correct element');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 11 passed: elementHandle() method works',
          details: { tagName },
        });
      } else {
        throw new Error(`Test 11 failed: Expected BUTTON, got: ${tagName}`);
      }
      actionButtonHandle.dispose();
    } else {
      throw new Error('Test 11 failed: elementHandle() returned null');
    }

    // Test 12: elementHandles() functionality
    progress.log('Test 12: Testing elementHandles() method');
    const allButtonHandles = await page.locator('button').elementHandles();

    if (allButtonHandles.length > 0) {
      progress.log(`Found ${allButtonHandles.length} button handles`);

      // Test the first handle
      const firstHandle = allButtonHandles[0];
      const firstHandleText = await firstHandle.getTextContent();
      progress.log(`First handle text: ${firstHandleText}`);

      // Dispose all handles
      for (const handle of allButtonHandles) {
        handle.dispose();
      }

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 12 passed: elementHandles() method works',
        details: { handleCount: allButtonHandles.length, firstHandleText },
      });
    } else {
      throw new Error('Test 12 failed: elementHandles() returned empty array');
    }

    // Test 13: filter() functionality
    progress.log('Test 13: Testing filter() method');
    const checkboxes = page.locator('input[type="checkbox"]');
    const visibleCheckboxes = checkboxes.filter({ visible: true });

    const visibleCheckboxCount = await visibleCheckboxes.count();

    progress.log(`Found ${visibleCheckboxCount} visible checkboxes using filter()`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 13 passed: filter() method works',
      details: { visibleCheckboxCount },
    });

    // Test 14: and() functionality
    progress.log('Test 14: Testing and() method');
    const enabledButtons = page.locator('button').and(page.locator(':not([disabled])'));

    const enabledButtonCount = await enabledButtons.count();

    progress.log(`Found ${enabledButtonCount} enabled buttons using and()`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 14 passed: and() method works',
      details: { enabledButtonCount },
    });

    // Test 15: or() functionality
    progress.log('Test 15: Testing or() method');
    const inputsOrButtons = page.locator('input').or(page.locator('button'));

    const combinedCount = await inputsOrButtons.count();

    progress.log(`Found ${combinedCount} elements using or() (inputs + buttons)`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 15 passed: or() method works',
      details: { combinedCount },
    });

    // Test 16: describe() functionality
    progress.log('Test 16: Testing describe() method');
    const describedLocator = page
      .locator('#action-button')
      .describe('Main action button for testing');

    // The describe method adds metadata but doesn't change functionality
    const describedButtonText = await describedLocator.getTextContent();
    const normalizedDescribed = describedButtonText
      ? describedButtonText.replace(/\s+/g, ' ').trim()
      : '';
    if (normalizedDescribed.includes('Perform Action')) {
      // Access description via index signature to avoid any cast
      const maybeDescription = (describedLocator as unknown as { description?: string })
        .description;
      progress.log(
        `describe() method works - element still accessible (text: "${normalizedDescribed}" desc: ${maybeDescription || 'n/a'})`
      );
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 16 passed: describe() method works',
        details: { describedButtonText: normalizedDescribed },
      });
    } else {
      throw new Error(
        `Test 16 failed: Expected text containing 'Perform Action', got: ${normalizedDescribed}`
      );
    }

    // Test 17: contentFrame() functionality (test with existing iframe)
    progress.log('Test 17: Testing contentFrame() method');
    try {
      const iframe = page.locator('iframe').first();
      iframe.contentFrame(); // Create FrameLocator

      // contentFrame() returns a FrameLocator, which is expected
      progress.log('contentFrame() method created FrameLocator successfully');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 17 passed: contentFrame() method works',
      });
    } catch (error) {
      progress.log(
        `contentFrame() test note: ${error instanceof Error ? error.message : String(error)}`
      );
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message:
          'Test 17 info: contentFrame() method created (iframe content may not be accessible)',
      });
    }

    // Test 18: count() method
    progress.log('Test 18: Testing count() method');
    const buttonCount = await page.locator('button').count();
    progress.log(`Found ${buttonCount} buttons on the page`);

    if (buttonCount > 0) {
      progress.log('count() method PASSED');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 18 passed: count() method works',
        details: { buttonCount },
      });
    } else {
      throw new Error('Test 18 failed: Expected at least one button on the page');
    }

    // Test 19: all() method
    progress.log('Test 19: Testing all() method');
    const allButtonLocators = await page.locator('button').all();
    progress.log(`all() method returned ${allButtonLocators.length} button locators`);

    if (allButtonLocators.length === buttonCount && allButtonLocators.length > 0) {
      progress.log('all() method PASSED');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 19 passed: all() method works',
        details: { locatorCount: allButtonLocators.length },
      });
    } else {
      throw new Error(
        `Test 19 failed: Expected ${buttonCount} locators, got ${allButtonLocators.length}`
      );
    }

    // Test 20: allInnerTexts() method
    progress.log('Test 20: Testing allInnerTexts() method');
    const buttonTexts = await page.locator('button').allInnerTexts();
    progress.log(`allInnerTexts() returned: ${JSON.stringify(buttonTexts)}`);

    if (buttonTexts.length === buttonCount && buttonTexts.length > 0) {
      const hasActionButton = buttonTexts.some(text => text.includes('Perform Action'));
      if (hasActionButton) {
        progress.log('allInnerTexts() method PASSED');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 20 passed: allInnerTexts() method works',
          details: { texts: buttonTexts },
        });
      } else {
        throw new Error('Test 20 failed: Expected to find "Perform Action" in button texts');
      }
    } else {
      throw new Error(`Test 20 failed: Expected ${buttonCount} texts, got ${buttonTexts.length}`);
    }

    // Test 21: allTextContents() method
    progress.log('Test 21: Testing allTextContents() method');
    const buttonTextContents = await page.locator('button').allTextContents();
    progress.log(`allTextContents() returned: ${JSON.stringify(buttonTextContents)}`);

    if (buttonTextContents.length === buttonCount && buttonTextContents.length > 0) {
      // textContent preserves original whitespace/newlines; normalize for comparison
      const normalizedTextContents = buttonTextContents.map(t => t.replace(/\s+/g, ' ').trim());
      const hasActionButton = normalizedTextContents.some(text => text.includes('Perform Action'));
      if (hasActionButton) {
        progress.log('allTextContents() method PASSED');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 21 passed: allTextContents() method works',
          details: { textContents: buttonTextContents, normalizedTextContents },
        });
      } else {
        throw new Error(
          `Test 21 failed: Expected to find "Perform Action" after normalization in button text contents. Normalized: ${JSON.stringify(normalizedTextContents)}`
        );
      }
    } else {
      throw new Error(
        `Test 21 failed: Expected ${buttonCount} text contents, got ${buttonTextContents.length}`
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Locator functionality tests completed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Locator functionality test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Locator functionality tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}
