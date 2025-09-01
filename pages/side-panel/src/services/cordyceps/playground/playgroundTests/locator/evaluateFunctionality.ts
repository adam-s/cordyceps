import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Test type-safe element operations functionality across Page, Frame, Locator, and ElementHandle
 * Note: Due to Chrome extension limitations, we use simple inline functions for testing
 */
export async function testEvaluateFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  // Define functions that can be serialized by Chrome extension
  function getDocumentTitle() {
    return document.title;
  }

  function getLocationHref() {
    return window.location.href;
  }

  function getDocument() {
    return document;
  }

  progress.log('Testing type-safe element operations methods');

  try {
    // Test Page.evaluate() - minimal sanity check with inline function
    progress.log('Testing Page.evaluate()');

    const pageTitle = await page.evaluate(getDocumentTitle);
    progress.log(`Page title: ${pageTitle}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Page.evaluate() test passed',
      details: { pageTitle },
    });

    // Test Frame.evaluate() - minimal sanity check
    progress.log('Testing Frame.evaluate()');

    const frameUrl = await page.mainFrame().evaluate(getLocationHref);
    progress.log(`Frame URL: ${frameUrl}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Frame.evaluate() test passed',
      details: { frameUrl },
    });

    // Test Locator type-safe methods - get body element info
    progress.log('Testing Locator type-safe methods');
    const bodyLocator = page.locator('body');

    const bodyTagName = await bodyLocator.getTagName();
    progress.log(`Body tag name: ${bodyTagName}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Locator type-safe methods test passed',
      details: { bodyTagName },
    });

    // Test ElementHandle type-safe methods are covered by Locator methods which use _withElement
    progress.log('ElementHandle type-safe methods are tested via Locator methods');

    // Test Page.evaluateHandle() - get document reference
    progress.log('Testing Page.evaluateHandle()');

    const documentHandle = await page.evaluateHandle(getDocument);
    if (documentHandle) {
      progress.log('Page.evaluateHandle() returned document handle');

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Page.evaluateHandle() test passed',
      });
    }

    progress.log('All type-safe functionality tests completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Type-safe functionality test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Type-safe functionality test failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}
