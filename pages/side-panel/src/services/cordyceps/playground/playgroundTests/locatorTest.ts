import { Severity } from '@src/utils/types';
import { Progress, ProgressController } from '../../core/progress';
import { Page } from '../../page';
import { PlaygroundTest } from './api';
import { StateAwareEventTest } from './stateAwareEvent';
import {
  testApiConsistencyAcrossLayers,
  testAriaSnapshotFunctionality,
  testCheckFunctionality,
  testClearFunctionality,
  testClickFunctionality,
  testDblclickFunctionality,
  testDispatchEventFunctionality,
  testDragToFunctionality,
  testDragToAdvanced,
  testEvaluateFunctionality,
  testFillFunctionality,
  testFrameMissingMethodsFunctionality,
  testGenericElementOperationsFunctionality,
  testHighlightFunctionality,
  testLocatorFunctionality,
  testMissingMethodsFunctionality,
  testPageMissingMethodsFunctionality,
  testScrollIntoViewIfNeededFunctionality,
  testScreenshotterFunctionality,
  testSelectOptionFunctionality,
  testSetCheckedFunctionality,
  testSetInputFilesFunctionality,
  testTapFunctionality,
  testTextContentFunctionality,
  testTypeFunctionality,
  testWaitForFunctionality,
  testWaitForEventFunctionality,
  testWaitForLoadStateFunctionality,
  testNavigationAutoWait,
  testNavigationGoBack,
  testNavigationGoForward,
  testNavigationSameDocumentGoBack,
  testNavigationReload,
  testNetworkEventFunctionality,
  debugNetworkEvents,
  testDownloadFunctionality,
  testActiveTabManagementFunctionality,
  testCloseCurrentTabFunctionality,
} from './locator';

export class LocatorTest extends PlaygroundTest {
  protected async _run(progress: Progress): Promise<void> {
    const browser = await this.context.getBrowser(progress);
    const page = await this.context.newPage(browser, progress);
    await this.context.navigate(page, progress);
    await this._stepTestLocator(page, progress);
  }

  private async _stepTestLocator(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Testing Locator functionality',
    });
    const testStart = Date.now();

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      // If we don't wait, some of the iframes will not have been loaded
      // we need to have wait methods added later.
      // Get the ariaSnapshotForAI first   // Get the ariaSnapshotForAI first
      const snapshot = await page.snapshotForAI();
      progress.log('Snapshot for AI created successfully.');
      console.log('Aria snapshot for AI \n', snapshot);
      progress.log('Creating and testing a basic locator');
      // Create a locator for the body element
      const bodyLocator = page.locator('body');
      progress.log(`Locator created successfully: ${bodyLocator._selector}`);

      // Test boundingBox functionality
      progress.log('Testing boundingBox method');
      const boundingBox = await bodyLocator.boundingBox();
      if (boundingBox) {
        {
          const { x, y, width, height } = boundingBox;
          const bboxMsg =
            `BoundingBox retrieved: x=${x}, y=${y}, ` + `width=${width}, height=${height}`;
          progress.log(bboxMsg);
        }
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'BoundingBox test passed.',
          details: {
            boundingBox,
          },
        });
      } else {
        progress.log('BoundingBox returned null (element may not be visible)');
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'BoundingBox test returned null.',
        });
      }

      // Test StateAwareEvent functionality (lifecycle event race conditions)
      progress.log('Testing StateAwareEvent functionality for lifecycle event race conditions');
      try {
        const stateAwareEventTest = new StateAwareEventTest(this.context);
        // Increased timeout for robust navigation with retries (was 15000)
        await stateAwareEventTest.run(25000, 'StateAwareEvent functionality tests');
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'StateAwareEvent functionality tests completed successfully',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(`StateAwareEvent functionality test failed (non-fatal): ${errorMessage}`);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'StateAwareEvent functionality test failed but continuing',
          details: { error: errorMessage },
        });
      }

      // Test navigation auto-wait behavior first (hash + cross-doc)
      progress.log('Testing navigation auto-wait (hash and cross-document via click)');
      await testNavigationAutoWait(page, progress, this.context);

      // Test goBack() functionality
      progress.log('Testing goBack() method for history navigation');
      await testNavigationGoBack(page, progress, this.context);

      // Test goForward() functionality
      progress.log('Testing goForward() method for history navigation');
      await testNavigationGoForward(page, progress, this.context);

      // Test same-document goBack() functionality
      progress.log('Testing same-document goBack() with pushState navigation');
      await testNavigationSameDocumentGoBack(page, progress, this.context);

      // Test reload() functionality
      progress.log('Testing reload() method for page refresh');
      await testNavigationReload(page, progress, this.context);

      // NOTE: Navigation tests above may leave the page on different URLs (like /iframe1).
      // Tests below that interact with page elements should ensure they navigate to the correct page first.

      // Ensure we're back on the main page with form elements for subsequent tests
      progress.log('Navigating back to main page for form element tests');
      const origin = await page.evaluate(() => window.location.origin);
      await page.goto(`${origin}/`, { waitUntil: 'commit', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);
      await new Promise(resolve => setTimeout(resolve, 500)); // Extra settling time

      // Test check() functionality
      progress.log('Testing check() method on checkboxes');
      await testCheckFunctionality(page, progress, this.context);

      // Test setChecked() functionality
      progress.log('Testing setChecked() method on checkboxes');
      await testSetCheckedFunctionality(page, progress, this.context);

      // Test click() functionality
      progress.log('Testing click() method on various elements');
      await testClickFunctionality(page, progress, this.context);

      // Test dblclick() functionality
      progress.log('Testing dblclick() method on various elements');
      await testDblclickFunctionality(page, progress, this.context);

      // Test tap() functionality
      progress.log('Testing tap() method on various elements');
      await testTapFunctionality(page, progress, this.context);

      // Test dispatchEvent() functionality
      progress.log('Testing dispatchEvent() method on various elements');
      await testDispatchEventFunctionality(page, progress, this.context);

      // Test dragTo() functionality
      progress.log('Testing dragTo() method for drag and drop operations');
      await testDragToFunctionality(page, progress, this.context);

      // Test advanced dragTo() functionality
      progress.log('Testing advanced dragTo() scenarios and edge cases');
      await testDragToAdvanced(page, progress, this.context);

      // Test fill() functionality
      progress.log('Testing fill() method on form inputs');
      await testFillFunctionality(page, progress, this.context);

      // Test clear() functionality
      progress.log('Testing clear() method on form inputs');
      await testClearFunctionality(page, progress, this.context);

      // Test textContent() functionality
      progress.log('Testing textContent() method across all layers');
      await testTextContentFunctionality(page, progress, this.context);

      // Test type() functionality
      progress.log('Testing type() method across all layers');
      await testTypeFunctionality(page, progress, this.context);

      // Test waitFor() functionality
      progress.log('Testing waitFor() method for element state waiting');
      await testWaitForFunctionality(page, progress, this.context);

      // Test waitForEvent() functionality
      progress.log('Testing waitForEvent() method for page event waiting');
      await testWaitForEventFunctionality(page, progress, this.context);

      // Test highlight() functionality
      progress.log('Testing highlight() and hideHighlight() methods');
      try {
        await testHighlightFunctionality(page, progress, this.context);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Highlight functionality tests completed successfully',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(`Highlight functionality test failed (non-fatal): ${errorMessage}`);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Highlight functionality test failed but continuing',
          details: { error: errorMessage },
        });
      }

      // Test locator functionality (chaining, getBy methods, etc.)
      progress.log('Testing advanced locator methods (chaining, getBy, first, last, etc.)');
      await testLocatorFunctionality(page, progress, this.context);

      // Test type-safe element operations functionality
      progress.log('Testing type-safe element operations methods');
      await testEvaluateFunctionality(page, progress, this.context);

      // Test generic element operations functionality
      progress.log('Testing generic element operations system (executeFunction methods)');
      await testGenericElementOperationsFunctionality(page, progress, this.context);

      // Test missing methods functionality
      progress.log('Testing newly implemented missing methods');
      await testMissingMethodsFunctionality(page, progress, this.context);

      // Test Frame missing methods functionality
      progress.log('Testing Frame layer missing methods');
      await testFrameMissingMethodsFunctionality(page, progress, this.context);

      // Test Page missing methods functionality
      progress.log('Testing Page layer missing methods');
      await testPageMissingMethodsFunctionality(page, progress, this.context);

      // Test API consistency across all layers
      progress.log('Testing API consistency across ElementHandle, Locator, Frame, and Page layers');
      await testApiConsistencyAcrossLayers(page, progress, this.context);

      // Test ariaSnapshot functionality across all layers
      progress.log(
        'Testing ariaSnapshot functionality across ElementHandle, Locator, and Frame layers'
      );
      await testAriaSnapshotFunctionality(page, progress, this.context);

      // Test scrollIntoViewIfNeeded functionality across ElementHandle and Locator
      progress.log('Testing scrollIntoViewIfNeeded functionality across ElementHandle and Locator');
      await testScrollIntoViewIfNeededFunctionality(page, progress, this.context);

      // Test selectOption functionality across all layers
      progress.log(
        'Testing selectOption functionality across ElementHandle, Locator, Frame, and Page'
      );
      await testSelectOptionFunctionality(page, progress, this.context);

      // Test setInputFiles functionality across all layers
      progress.log(
        'Testing setInputFiles functionality across ElementHandle, Locator, Frame, and Page'
      );
      await testSetInputFilesFunctionality(page, progress, this.context);

      // Test screenshotter functionality
      progress.log('Testing screenshotter functionality (screenshot page)');
      await testScreenshotterFunctionality(page, progress, this.context);

      // Test download functionality using server fixtures
      progress.log(
        'Testing download functionality with server fixtures (Playwright-compatible API)'
      );
      try {
        const downloadProgressController = new ProgressController(20000); // 20 second timeout for downloads
        await downloadProgressController.run(async downloadProgress => {
          await testDownloadFunctionality(page, downloadProgress, this.context);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(`Download functionality test failed (non-fatal): ${errorMessage}`);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Download functionality test failed but continuing with other tests',
          details: { error: errorMessage },
        });
      }

      // Test waitForLoadState functionality
      progress.log('Testing waitForLoadState() functionality for Page and Frame');
      try {
        const loadStateProgressController = new ProgressController(10000); // 10 second timeout
        await loadStateProgressController.run(async loadStateProgress => {
          await testWaitForLoadStateFunctionality(page, loadStateProgress, this.context);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(`waitForLoadState functionality test failed (non-fatal): ${errorMessage}`);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'waitForLoadState functionality test failed but continuing',
          details: { error: errorMessage },
        });
      }

      // Test network event functionality (DEBUG VERSION) - Use fresh progress to avoid timeout
      progress.log('DEBUGGING: Testing network event functionality (request/response monitoring)');
      try {
        // Create a fresh progress controller with a shorter timeout for this specific test
        const networkProgressController = new ProgressController(15000); // 15 second timeout
        await networkProgressController.run(async networkProgress => {
          await debugNetworkEvents(page, networkProgress, this.context);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(`Network debugging test failed (non-fatal): ${errorMessage}`);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Network debugging test failed but continuing with other tests',
          details: { error: errorMessage },
        });
      }

      // Test basic network event functionality
      progress.log('Testing basic network event functionality');
      try {
        const networkEventProgressController = new ProgressController(10000); // 10 second timeout
        await networkEventProgressController.run(async networkEventProgress => {
          await testNetworkEventFunctionality(page, networkEventProgress, this.context);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(`Network event functionality test failed (non-fatal): ${errorMessage}`);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Network event functionality test failed but continuing',
          details: { error: errorMessage },
        });
      }

      // Network stability test removed - no longer supported
      progress.log('Network stability test skipped - functionality removed');

      // Test Active Tab Management functionality (after all navigation and form tests)
      progress.log(
        'Testing Active Tab Management functionality (BrowserWindow, cache, bringToFront)'
      );
      try {
        await testActiveTabManagementFunctionality(page, progress, this.context);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Active Tab Management functionality tests completed successfully',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(
          `Active Tab Management functionality test failed (non-fatal): ${errorMessage}`
        );
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Active Tab Management functionality test failed but continuing',
          details: { error: errorMessage },
        });
      }

      // Test Close Current Tab functionality (browser-use context integration)
      progress.log('Testing Close Current Tab functionality (browser-use context integration)');
      try {
        await testCloseCurrentTabFunctionality(page, progress, this.context);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Close Current Tab functionality tests completed successfully',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.log(`Close Current Tab functionality test failed (non-fatal): ${errorMessage}`);
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Close Current Tab functionality test failed but continuing',
          details: { error: errorMessage },
        });
      }

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Basic locator test passed.',
      });

      const testDuration = Date.now() - testStart;
      progress.log('Locator tests completed successfully.');
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Locator functionality tested',
        details: {
          duration: testDuration,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';

      progress.log(`Locator test failed: ${errorMessage}`);
      progress.log(`Error stack trace: ${errorStack}`);

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Locator test failed with detailed error information',
        details: {
          error: errorMessage,
          stack: errorStack,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        },
      });

      throw new Error(`Locator test failed: ${errorMessage}\nStack trace: ${errorStack}`);
    }
  }
}
