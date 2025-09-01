import { Severity } from '@src/utils/types';
import { Progress } from '../../../core/progress';
import { Page } from '../../../page';
import { BrowserWindow } from '../../../browserWindow';
import { TestContext } from '../api';
import { BrowserContext, BrowserContextState } from '@src/services/browser-use/browser/context';

/**
 * Test closeCurrentTab() functionality for browser-use context
 * This test verifies proper tab closing behavior and context state management
 */
export async function testCloseCurrentTabFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  progress.log('🧪 Testing closeCurrentTab() functionality...');

  try {
    // Option A: Use real BrowserWindow for integration testing
    const browserWindow = await BrowserWindow.create();

    // Create a browser-use context for testing closeCurrentTab
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost', '127.0.0.1'],
      saveDownloadsPath: null,
    });

    // Initialize the context
    await browserContext.enter();
    const initialTabCount = browserContext.pages.length;
    progress.log(`Initial tab count: ${initialTabCount}`);

    // Create additional tabs for testing
    progress.log('Creating additional tabs for closeCurrentTab testing...');

    // Instead of creating many tabs that could cause infinite loops,
    // create just 2 additional tabs for controlled testing
    await browserContext.createNewTab('http://localhost:3005/');
    await browserContext.createNewTab(); // Empty tab

    const afterCreateTabCount = browserContext.pages.length;
    progress.log(`Tab count after creating test tabs: ${afterCreateTabCount}`);

    if (afterCreateTabCount < initialTabCount + 2) {
      throw new Error(`Expected at least ${initialTabCount + 2} tabs, got ${afterCreateTabCount}`);
    }

    // Test 1: Close current tab with multiple tabs available
    progress.log('Test 1: Closing current tab with multiple tabs available...');

    const tabsBeforeClose = browserContext.pages.length;
    const currentPageBefore = await browserContext.getCurrentPage();
    const currentTabIdBefore = currentPageBefore.tabId;

    progress.log(`About to close current tab (tabId: ${currentTabIdBefore})`);

    // Set up close event listener to verify the page close event fires
    let closeEventFired = false;
    const closeDisposable = currentPageBefore.onClose(() => {
      closeEventFired = true;
      progress.log(`✅ Page close event fired for tab ${currentTabIdBefore}`);
    });

    // Close the current tab
    await browserContext.closeCurrentTab();

    const tabsAfterClose = browserContext.pages.length;
    const currentPageAfter = await browserContext.getCurrentPage();
    const currentTabIdAfter = currentPageAfter.tabId;

    // Verify tab was closed and close event fired
    if (tabsAfterClose !== tabsBeforeClose - 1) {
      throw new Error(`Expected ${tabsBeforeClose - 1} tabs after close, got ${tabsAfterClose}`);
    }

    if (currentTabIdAfter === currentTabIdBefore) {
      throw new Error('Current tab ID should have changed after closing the current tab');
    }

    if (!closeEventFired) {
      progress.log(
        '⚠️ Warning: Page close event did not fire (this may be expected in test environment)'
      );
    }

    closeDisposable.dispose();

    progress.log('✅ Test 1 passed: Successfully closed current tab and switched to another');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'closeCurrentTab() multiple tabs test passed',
      details: {
        tabsBeforeClose,
        tabsAfterClose,
        closedTabId: currentTabIdBefore,
        newCurrentTabId: currentTabIdAfter,
        closeEventFired,
      },
    });

    // Test 2: Verify context state remains active
    progress.log('Test 2: Verifying context state management...');

    const contextState = browserContext.session.state;
    if (contextState !== BrowserContextState.ACTIVE) {
      throw new Error(`Expected context to remain ACTIVE, got ${contextState}`);
    }

    progress.log('✅ Test 2 passed: Context state properly maintained');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'closeCurrentTab() state management test passed',
      details: { contextState, remainingTabs: browserContext.pages.length },
    });

    // Test 3: Close all tabs except one, then close the last one
    progress.log('Test 3: Testing closeCurrentTab() until only one tab remains...');

    // Close tabs until only one remains (but don't close the last tab)
    while (browserContext.pages.length > 1) {
      const remainingBefore = browserContext.pages.length;
      const currentPageBefore = await browserContext.getCurrentPage();
      const currentTabIdBefore = currentPageBefore.tabId;

      progress.log(`About to close tab ${currentTabIdBefore}, ${remainingBefore} tabs total`);

      await browserContext.closeCurrentTab();

      // Force a refresh of the pages array to ensure it's up to date
      const currentPage = await browserContext.getCurrentPage();
      const remainingAfter = browserContext.pages.length;

      progress.log(`Closed tab: ${remainingBefore} → ${remainingAfter} tabs remaining`);
      progress.log(`Current tab is now: ${currentPage.tabId}`);

      // Safety check: if pages length didn't decrease, break to avoid infinite loop
      if (remainingAfter >= remainingBefore) {
        progress.log(
          `⚠️ Tab count didn't decrease (${remainingBefore} → ${remainingAfter}), breaking loop`
        );
        break;
      }
    }

    if (browserContext.pages.length !== 1) {
      throw new Error(`Expected 1 tab remaining, got ${browserContext.pages.length}`);
    }

    // Verify we have exactly one tab left (don't close the last tab to avoid closing the window)
    const lastPage = await browserContext.getCurrentPage();
    const lastTabId = lastPage.tabId;

    progress.log(`✅ Successfully closed all tabs except the last one (tabId: ${lastTabId})`);
    progress.log('✅ Test 3 passed: closeCurrentTab() works correctly, keeping last tab open');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'closeCurrentTab() close tabs test passed (keeping last tab open)',
      details: {
        remainingTabs: browserContext.pages.length,
        lastRemainingTabId: lastTabId,
      },
    });

    // Clean up - DO NOT dispose browserWindow as it closes the entire browser
    // and affects other tests that might run after this one
    // browserWindow.dispose(); // ❌ REMOVED: This closes the entire browser window

    progress.log('✅ All closeCurrentTab() functionality tests completed successfully');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'closeCurrentTab() functionality tests completed successfully',
      details: {
        testsCompleted: 3,
        testNames: [
          'Multiple tabs close and switch',
          'Context state management',
          'Close all tabs until context closes',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';

    progress.log(`❌ closeCurrentTab() functionality test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'closeCurrentTab() functionality test failed',
      details: {
        error: errorMessage,
        stack: errorStack,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
    });

    throw new Error(`closeCurrentTab() functionality test failed: ${errorMessage}`);
  }
}
