/**
 * Download functionality test for Cordyceps - Simplified for core testing
 * Tests only essential download types: TXT, CSV, and PNG files
 *
 * Uses server-delivered files instead of client-side blob generation
 * for more realistic download testing scenarios.
 */

import { Severity } from '@src/utils/types';
import { Progress } from '../../../core/progress';
import { Page } from '../../../page';
import { Download } from '../../../operations/download';
import { DownloadManager, DownloadEventData } from '../../../operations/downloadManager';
import type { TestContext } from '../api';

/**
 * Simplified download functionality test for Cordyceps
 * Tests core download types with server fixtures
 */

export async function testDownloadFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('Testing core download functionality with server fixtures');

  try {
    // ENSURE PAGE IS ON CORRECT URL FIRST - Navigate to root page where download buttons are located
    progress.log('Ensuring page is on correct URL for download tests');
    const currentUrl = await page.evaluate(() => window.location.href);
    const targetUrl = 'http://localhost:3005';

    // Check if we're on the root page (either exact URL or with trailing slash)
    if (currentUrl !== targetUrl && currentUrl !== targetUrl + '/') {
      progress.log(
        `Page is currently on ${currentUrl}, navigating to ${targetUrl} for download tests`,
      );

      try {
        await page.goto(targetUrl, { waitUntil: 'load', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 500)); // Extra settling time
        progress.log('Successfully navigated to root page for download tests');
      } catch (navigationError) {
        progress.log(`Navigation to ${targetUrl} failed: ${navigationError}`);
        progress.log('Attempting to continue with current page...');

        // Check if current page has the expected elements
        const hasDownloadButton = await page.evaluate(
          () => !!document.querySelector('#download-text-file'),
        );
        if (!hasDownloadButton) {
          throw new Error(
            `Navigation failed and current page ${currentUrl} does not have download test elements. Please ensure test server is running at ${targetUrl}`,
          );
        }
        progress.log('Current page has download elements, continuing with tests');
      }
    } else {
      progress.log('Page is already on correct URL, ready for download tests');
    }

    // Test 1: Basic download event listening (VS Code Event pattern used by Cordyceps)
    progress.log('Test 1: Setting up download event listener');

    // Use VS Code Event pattern (which is how Page events work in Cordyceps)
    const downloadDisposable = page.onDownload((download: Download) => {
      progress.log(`Download started: ${download.url()}`);
      progress.log(`Suggested filename: ${download.suggestedFilename()}`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Download event received',
        details: {
          url: download.url(),
          suggestedFilename: download.suggestedFilename(),
        },
      });
    });

    // Test 2: Core download types using server fixtures
    progress.log('Test 2: Testing core download types with server fixtures');

    const coreDownloadTests = [
      {
        buttonId: '#download-text-file',
        description: 'Text file download',
        expectedFile: 'test-file.txt',
      },
      {
        buttonId: '#download-csv-file',
        description: 'CSV file download',
        expectedFile: 'test-data.csv',
      },
      {
        buttonId: '#download-image-file',
        description: 'PNG image download',
        expectedFile: 'test-image.png',
      },
    ];

    for (const test of coreDownloadTests) {
      try {
        progress.log(`Testing ${test.description}`);

        // Use the helper method with consistent delay between downloads
        const download = await page.waitForDownloadAndClick(test.buttonId, {
          delay: 800, // 800ms delay between downloads to avoid browser warnings
          timeout: 30000,
        });

        progress.log(`✓ ${test.description}: ${download.suggestedFilename()}`);

        // Verify expected filename
        if (download.suggestedFilename() === test.expectedFile) {
          progress.log(`  ✓ Filename matches expected: ${test.expectedFile}`);
        } else {
          progress.log(
            `  ⚠ Filename mismatch - Expected: ${test.expectedFile}, Got: ${download.suggestedFilename()}`,
          );
        }

        // Wait for the download process to complete
        await download.path(); // This waits for completion

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: `${test.description} completed successfully`,
          details: {
            filename: download.suggestedFilename(),
            url: download.url(),
            expectedFile: test.expectedFile,
          },
        });
      } catch (error) {
        progress.log(`✗ ${test.description} failed: ${error}`);
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Error,
          message: `${test.description} failed`,
          details: { error: String(error) },
        });
      }
    }

    // Test 3: Chrome extension specific features
    progress.log('Test 3: Testing Chrome extension download features');

    try {
      // Test with the text file download
      const downloadPromise = page.waitForEvent('download');
      await page.click('#download-text-file');
      const download = (await downloadPromise) as Download;

      progress.log(`Testing Chrome extension features for: ${download.suggestedFilename()}`);

      // Test Chrome extension specific features
      const chromeId = download.chromeDownloadId;
      progress.log(`  ✓ Chrome download ID: ${chromeId}`);

      const progressInfo = await download.getProgress();
      progress.log(`  ✓ Download state: ${progressInfo.state}`);

      // Test show in file manager
      await download.show();
      progress.log('  ✓ download.show() - Opens file in system file manager');

      // Test download path
      const downloadPath = await download.path();
      progress.log(`  ✓ download.path(): ${downloadPath}`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Chrome extension download features test completed',
        details: {
          filename: download.suggestedFilename(),
          chromeId,
          state: progressInfo.state,
          path: downloadPath,
        },
      });
    } catch (error) {
      progress.log(`Chrome extension features test failed: ${error}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Chrome extension features test failed',
        details: { error: String(error) },
      });
    }

    // Test 4: Download manager global events
    progress.log('Test 4: Testing DownloadManager global events');

    const downloadManager = DownloadManager.getInstance();

    // Listen to all download events globally
    const globalStartedDisposable = downloadManager.onDownloadStarted(
      (event: DownloadEventData) => {
        progress.log(`Global event: Download started - ${event.download.url()}`);
      },
    );

    const globalCompletedDisposable = downloadManager.onDownloadCompleted(
      (event: DownloadEventData) => {
        progress.log(`Global event: Download completed - ${event.download.suggestedFilename()}`);
      },
    );

    // Trigger one more download to test global events
    try {
      const download = await page.waitForDownloadAndClick('#download-csv-file', {
        delay: 1000, // Longer delay for final test
        timeout: 30000,
      });
      progress.log(`✓ Global download events working for: ${download.suggestedFilename()}`);
    } catch (error) {
      progress.log(`Global events test failed: ${error}`);
    }

    // Clean up event listeners
    downloadDisposable.dispose();
    globalStartedDisposable.dispose();
    globalCompletedDisposable.dispose();

    // Show download status
    await page.click('button:has-text("Show Download Status")');
    progress.log('✓ Download status display activated');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Core download functionality tests completed using server fixtures',
    });
  } catch (error) {
    progress.log(`Download functionality test failed: ${error}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Download functionality test failed',
      details: { error: String(error) },
    });
  }
}

/**
 * Demonstrates how Playwright download API translates to Chrome extension in Cordyceps
 * Simplified version focused on core download functionality
 */
export async function showPlaywrightEquivalents(page: Page): Promise<void> {
  // Playwright: page.on('download', download => ...)
  // Cordyceps: page.onDownload(download => ...)
  const downloadDisposable = page.onDownload((download: Download) => {
    console.log('Download event:', download.url());
  });

  // Playwright: const downloadPromise = page.waitForEvent('download');
  // Cordyceps: const downloadPromise = page.waitForEvent('download');
  const downloadPromise = page.waitForEvent('download');

  // Playwright: await page.getByText('Download file').click();
  // Cordyceps: await page.click('#download-button');
  await page.click('#download-text-file');

  // Playwright: const download = await downloadPromise;
  // Cordyceps: const download = await downloadPromise as Download;
  const download = (await downloadPromise) as Download;

  // Playwright: await download.saveAs('/path/to/save/at/' + download.suggestedFilename());
  // Cordyceps: await download.saveAs('/path/to/save/at/' + download.suggestedFilename());
  await download.saveAs('/path/to/save/at/' + download.suggestedFilename());

  // Clean up
  downloadDisposable.dispose();
}
