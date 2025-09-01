import { Progress } from '../../../core/progress';
import { Page } from '../../../page';
import { BrowserWindow } from '../../../browserWindow';
import { TestContext } from '../api';
import { Severity } from '@src/utils/types';

/**
 * Test active tab management functionality in Cordyceps system
 * Tests BrowserWindow active tab tracking, Page.bringToFront(), and tab switching behavior
 */
export async function testActiveTabManagementFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  const browserWindow = await context.getBrowser(progress);

  // Capture initial state for restoration
  const initialUrl = page.url();
  const initialTabId = page.tabId;

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🧪 Starting Active Tab Management tests',
  });

  try {
    // Test 1: Initial active tab tracking
    await _testInitialActiveTabTracking(browserWindow, page, progress, context);

    // Test 2: Create new tab and test tab switching
    await _testTabCreationAndSwitching(browserWindow, page, progress, context);

    // Test 3: Test Page.bringToFront() functionality
    await _testBringToFrontFunctionality(browserWindow, page, progress, context);

    // Test 4: Test active tab cache invalidation on tab removal
    await _testActiveTabCacheInvalidation(browserWindow, page, progress, context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Active Tab Management tests completed successfully',
    });
  } finally {
    // Ensure the original page is active and at the correct URL for subsequent tests
    try {
      await page.bringToFront();
      await new Promise(resolve => setTimeout(resolve, 300));

      // Only navigate if we're not already on the correct URL
      if (page.url() !== initialUrl) {
        await page.goto(initialUrl, { waitUntil: 'load' });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      progress.log(`✅ Restored original page state: ${initialUrl} (tab ${initialTabId})`);
    } catch (error) {
      progress.log(`⚠️ Failed to restore original page state: ${error}`);
    }
  }
}

/**
 * Test 1: Verify BrowserWindow correctly tracks the initially active tab
 */
async function _testInitialActiveTabTracking(
  browserWindow: BrowserWindow,
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('🔍 Test 1: Initial active tab tracking');

  try {
    // Get the active tab ID from BrowserWindow (should use cache)
    const activeTabId = await browserWindow.getActiveTabId();

    // Verify it matches the current page's tab ID
    if (activeTabId !== page.tabId) {
      throw new Error(`Active tab ID mismatch: expected ${page.tabId}, got ${activeTabId}`);
    }

    // Verify getCurrentPage() returns the same page
    const currentPage = await browserWindow.getCurrentPage();
    if (currentPage.tabId !== page.tabId) {
      throw new Error(
        `getCurrentPage() returned wrong tab: expected ${page.tabId}, got ${currentPage.tabId}`,
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: `✅ Initial active tab tracking works correctly (tab ${activeTabId})`,
    });

    progress.log(`✅ Test 1 passed: Active tab correctly tracked as ${activeTabId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ Test 1 failed: ${errorMessage}`,
    });
    throw new Error(`Initial active tab tracking test failed: ${errorMessage}`);
  }
}

/**
 * Test 2: Create a new tab and test tab switching behavior
 */
async function _testTabCreationAndSwitching(
  browserWindow: BrowserWindow,
  originalPage: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('🔍 Test 2: Tab creation and switching');

  let newPage: Page | null = null;

  try {
    // Create a new tab (this should become the active tab)
    newPage = await browserWindow.newPage({ timeout: 10000, progress });

    // Wait a moment for the tab activation event to process
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify the new tab is now active
    const newActiveTabId = await browserWindow.getActiveTabId();
    if (newActiveTabId !== newPage.tabId) {
      throw new Error(`New tab should be active: expected ${newPage.tabId}, got ${newActiveTabId}`);
    }

    // Verify getCurrentPage() returns the new page
    const currentPage = await browserWindow.getCurrentPage();
    if (currentPage.tabId !== newPage.tabId) {
      throw new Error(
        `getCurrentPage() should return new tab: expected ${newPage.tabId}, got ${currentPage.tabId}`,
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: `✅ Tab creation and switching works correctly (new active tab: ${newActiveTabId})`,
    });

    progress.log(`✅ Test 2 passed: New tab ${newPage.tabId} is correctly tracked as active`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ Test 2 failed: ${errorMessage}`,
    });
    throw new Error(`Tab creation and switching test failed: ${errorMessage}`);
  } finally {
    // Clean up: close the new tab if it was created
    if (newPage) {
      try {
        await chrome.tabs.remove(newPage.tabId);
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        progress.log(`Warning: Failed to clean up test tab ${newPage.tabId}: ${error}`);
      }
    }
  }
}

/**
 * Test 3: Test Page.bringToFront() functionality
 */
async function _testBringToFrontFunctionality(
  browserWindow: BrowserWindow,
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('🔍 Test 3: Page.bringToFront() functionality');

  let backgroundPage: Page | null = null;

  try {
    // Create a background tab that's not active
    backgroundPage = await browserWindow.newPage({ timeout: 10000, progress });

    // Wait for tab creation to settle
    await new Promise(resolve => setTimeout(resolve, 300));

    // Switch back to original page using Chrome API to make background tab inactive
    await chrome.tabs.update(page.tabId, { active: true });

    // Wait for activation to process
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify original page is active
    let activeTabId = await browserWindow.getActiveTabId();
    if (activeTabId !== page.tabId) {
      throw new Error(
        `Expected original page to be active: expected ${page.tabId}, got ${activeTabId}`,
      );
    }

    // Now use bringToFront() on the background page
    await backgroundPage.bringToFront();

    // Wait for bringToFront to process
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify the background page is now active
    activeTabId = await browserWindow.getActiveTabId();
    if (activeTabId !== backgroundPage.tabId) {
      throw new Error(
        `bringToFront() should make page active: expected ${backgroundPage.tabId}, got ${activeTabId}`,
      );
    }

    // Verify getCurrentPage() returns the brought-to-front page
    const currentPage = await browserWindow.getCurrentPage();
    if (currentPage.tabId !== backgroundPage.tabId) {
      throw new Error(
        `getCurrentPage() should return brought-to-front page: expected ${backgroundPage.tabId}, got ${currentPage.tabId}`,
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: `✅ bringToFront() works correctly (activated tab: ${activeTabId})`,
    });

    progress.log(
      `✅ Test 3 passed: bringToFront() correctly activated tab ${backgroundPage.tabId}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ Test 3 failed: ${errorMessage}`,
    });
    throw new Error(`bringToFront() functionality test failed: ${errorMessage}`);
  } finally {
    // Clean up: close the background tab if it was created
    if (backgroundPage) {
      try {
        await chrome.tabs.remove(backgroundPage.tabId);
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        progress.log(
          `Warning: Failed to clean up background tab ${backgroundPage.tabId}: ${error}`,
        );
      }
    }

    // Ensure original page is active for subsequent tests
    try {
      await page.bringToFront();
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      progress.log(`Warning: Failed to restore original page activity: ${error}`);
    }
  }
}

/**
 * Test 4: Test active tab cache invalidation when tabs are removed
 */
async function _testActiveTabCacheInvalidation(
  browserWindow: BrowserWindow,
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('🔍 Test 4: Active tab cache invalidation on tab removal');

  let testPage: Page | null = null;

  try {
    // Create a new tab that will become active
    testPage = await browserWindow.newPage({ timeout: 10000, progress });

    // Wait for tab creation and activation to settle
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify the test page is active
    let activeTabId = await browserWindow.getActiveTabId();
    if (activeTabId !== testPage.tabId) {
      throw new Error(`Test page should be active: expected ${testPage.tabId}, got ${activeTabId}`);
    }

    // Remove the active tab
    const testTabId = testPage.tabId;
    await chrome.tabs.remove(testTabId);

    // Wait for removal to process and cache invalidation
    await new Promise(resolve => setTimeout(resolve, 500));

    // The active tab should now be different (cache should be invalidated)
    activeTabId = await browserWindow.getActiveTabId();
    if (activeTabId === testTabId) {
      throw new Error(
        `Active tab cache should be invalidated: removed tab ${testTabId} still appears active`,
      );
    }

    // Verify getCurrentPage() works with the new active tab
    const currentPage = await browserWindow.getCurrentPage();
    if (currentPage.tabId === testTabId) {
      throw new Error(`getCurrentPage() should not return removed tab: got ${currentPage.tabId}`);
    }

    // Verify the current active tab is valid
    if (activeTabId !== currentPage.tabId) {
      throw new Error(
        `Active tab ID should match current page: expected ${currentPage.tabId}, got ${activeTabId}`,
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: `✅ Active tab cache invalidation works correctly (new active tab: ${activeTabId})`,
    });

    progress.log(`✅ Test 4 passed: Cache invalidated, new active tab is ${activeTabId}`);

    // Clear testPage reference since it's been removed
    testPage = null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ Test 4 failed: ${errorMessage}`,
    });
    throw new Error(`Active tab cache invalidation test failed: ${errorMessage}`);
  } finally {
    // Ensure original page is active for subsequent tests
    try {
      await page.bringToFront();
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      progress.log(`Warning: Failed to restore original page activity: ${error}`);
    }
  }
}
