/* eslint-disable @typescript-eslint/no-unused-vars */
import { PlaygroundTest } from '../api';
import { Progress } from '../../../core/progress';
import { Page } from '../../../page';
import { Severity } from '@src/utils/types';

/**
 * Comprehensive test for StateAwareEvent functionality.
 * Tests the "already fired" scenario for lifecycle events.
 */
export class StateAwareEventTest extends PlaygroundTest {
  protected async _run(progress: Progress): Promise<void> {
    // Use getBrowser() which returns a BrowserWindow directly
    const browserWindow = await this.context.getBrowser(progress);

    // Use getCurrentPage() instead of newPage() to avoid creating multiple tabs
    const page = await browserWindow.getCurrentPage();

    // Ensure the page is focused and active
    await page.bringToFront();

    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting StateAwareEvent tests',
    });

    await this._testImmediateSubscription(page, progress);
    // Don't run late subscription immediately - the events need to remain fired
    await this._testLateSubscription(page, progress);
    await this._testNavigationReset(page, progress);
    await this._testMultipleSubscribers(page, progress);
    await this._testFrameStateAwareEvents(page, progress);

    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ All StateAwareEvent tests completed successfully',
    });
  }

  /**
   * Test 1: Normal subscription before events fire
   */
  private async _testImmediateSubscription(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '📋 Test 1: Normal subscription before events fire',
    });

    let domContentLoadedFired = false;
    let loadFired = false;

    // Subscribe before navigating
    const domContentLoadedDisposable = page.onDomContentLoaded(() => {
      domContentLoadedFired = true;
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: '  ✓ DOMContentLoaded event received (immediate subscription)',
      });
    });

    const loadDisposable = page.onLoad(() => {
      loadFired = true;
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: '  ✓ Load event received (immediate subscription)',
      });
    });

    // Navigate to trigger events
    await this.context.navigate(page, progress);

    // Wait a bit for events to fire
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!domContentLoadedFired || !loadFired) {
      throw new Error('❌ Immediate subscription test failed: events not fired');
    }

    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '  ✅ Test 1 passed: Immediate subscription works correctly',
    });

    domContentLoadedDisposable.dispose();
    loadDisposable.dispose();
  }

  /**
   * Test 2: Late subscription after events have already fired (the key test!)
   */
  private async _testLateSubscription(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '📋 Test 2: Late subscription after events fired (KEY TEST)',
    });

    // NOTE: We don't navigate here - we're testing late subscription to events
    // that were already fired in the previous test (_testImmediateSubscription)

    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '  📍 Testing late subscription to already-fired events...',
    });

    let lateLoadFired = false;
    let lateDomContentLoadedFired = false;

    // Subscribe AFTER the events have already fired
    const lateDomContentLoadedDisposable = page.onDomContentLoaded(() => {
      lateDomContentLoadedFired = true;
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '  🎯 DOMContentLoaded fired for LATE subscriber (this is the magic!)',
      });
    });

    const lateLoadDisposable = page.onLoad(() => {
      lateLoadFired = true;
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '  🎯 Load fired for LATE subscriber (this is the magic!)',
      });
    });

    // Wait a bit for the immediate firing to occur
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!lateDomContentLoadedFired || !lateLoadFired) {
      throw new Error('❌ Late subscription test FAILED: StateAwareEvent not working correctly');
    }

    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '  🚀 Test 2 passed: Late subscription works! (Race condition solved)',
    });

    lateDomContentLoadedDisposable.dispose();
    lateLoadDisposable.dispose();
  }

  /**
   * Test 3: Navigation reset functionality
   */
  private async _testNavigationReset(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '📋 Test 3: Navigation reset functionality',
    });

    // Ensure page is focused before navigation tests
    await page.bringToFront();

    // Test that StateAwareEvent resets properly on navigation
    // Use different URLs to ensure cross-document navigation

    // First navigation - navigate to main page with query parameter
    await page.goto('http://localhost:3005/?test=1');
    await page.waitForLoadState('load', { timeout: 3000 });

    // Now subscribe after first navigation has completed
    let firstSubscriptionFired = false;
    const firstDisposable = page.onLoad(() => {
      firstSubscriptionFired = true;
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: '  ✓ Load event for first subscription (immediate fire)',
      });
    });

    // Should fire immediately since load already happened
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!firstSubscriptionFired) {
      throw new Error('❌ First subscription should have fired immediately');
    }

    firstDisposable.dispose();

    // Second navigation (should reset StateAwareEvent)
    let secondSubscriptionFired = false;
    const secondDisposable = page.onLoad(() => {
      secondSubscriptionFired = true;
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: '  ✓ Load event for second navigation',
      });
    });

    // Navigate to trigger reset and new load event with robust retry logic
    try {
      await this._robustNavigation(page, 'http://localhost:3005/nav-page-2.html', 3000);
    } catch (error) {
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Warning,
        message: `  ⚠️ Navigation to nav-page-2.html failed, falling back to query param navigation: ${error}`,
      });
      // Fallback to query parameter navigation (same-domain, should work)
      await this._robustNavigation(page, 'http://localhost:3005/?test=nav2', 3000);
    }

    if (!secondSubscriptionFired) {
      throw new Error('❌ Second navigation load event not fired after reset');
    }

    // Navigate back to main page for subsequent tests with robust handling
    try {
      await this._robustNavigation(page, 'http://localhost:3005', 3000);
    } catch (error) {
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Warning,
        message: `  ⚠️ Navigation back to main page failed, continuing anyway: ${error}`,
      });
      // Don't fail the test - just continue
    }

    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '  ✅ Test 3 passed: Navigation reset works correctly',
    });

    secondDisposable.dispose();
  }

  /**
   * Test 4: Multiple subscribers all get the event
   */
  private async _testMultipleSubscribers(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '📋 Test 4: Multiple late subscribers',
    });

    // Ensure page is focused before test
    await page.bringToFront();

    // Navigate to a fresh page with robust retry logic
    try {
      await this._robustNavigation(page, 'http://localhost:3005/nav-page-1.html', 3000);
    } catch (error) {
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Warning,
        message: `  ⚠️ Navigation to nav-page-1.html failed, falling back to query param: ${error}`,
      });
      // Fallback to query parameter navigation
      await this._robustNavigation(page, 'http://localhost:3005/?test=nav1', 3000);
    }

    const subscriberResults: boolean[] = [false, false, false];

    // Subscribe multiple listeners AFTER events have fired
    const disposables = [
      page.onLoad(() => {
        subscriberResults[0] = true;
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Info,
          message: '  ✓ Subscriber 1 received late load event',
        });
      }),
      page.onLoad(() => {
        subscriberResults[1] = true;
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Info,
          message: '  ✓ Subscriber 2 received late load event',
        });
      }),
      page.onLoad(() => {
        subscriberResults[2] = true;
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Info,
          message: '  ✓ Subscriber 3 received late load event',
        });
      }),
    ];

    // Wait for immediate firing
    await new Promise(resolve => setTimeout(resolve, 100));

    const allReceived = subscriberResults.every(result => result);
    if (!allReceived) {
      throw new Error('❌ Multiple subscribers test failed: not all subscribers received events');
    }

    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '  ✅ Test 4 passed: All multiple subscribers received events',
    });

    disposables.forEach(d => d.dispose());
  }

  /**
   * Test 5: Frame-level StateAwareEvent functionality
   */
  private async _testFrameStateAwareEvents(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '📋 Test 5: Frame-level StateAwareEvent functionality',
    });

    // Ensure page is focused before test
    await page.bringToFront();

    // Get the main frame
    const mainFrame = page.mainFrame();
    // Navigate to ensure frame events fire using nav-page-2.html
    await page.goto('http://localhost:3005/nav-page-2.html');
    await page.waitForLoadState('load', { timeout: 3000 });

    let frameLoadFired = false;

    // Subscribe to frame events AFTER they have already fired (the key test!)
    const frameLoadDisposable = mainFrame.onLoad(() => {
      frameLoadFired = true;
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '  🎯 Frame Load fired for LATE subscriber (Frame StateAware magic!)',
      });
    });

    // Wait a bit for the immediate firing to occur
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!frameLoadFired) {
      throw new Error(
        '❌ Frame StateAwareEvent test FAILED: Frame load event not working correctly'
      );
    }

    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '  🚀 Test 5 passed: Frame StateAwareEvent works! (Frame race condition solved)',
    });

    frameLoadDisposable.dispose();
    // Navigate back to main page for clean state with robust handling
    try {
      await this._robustNavigation(page, 'http://localhost:3005', 3000);
    } catch (error) {
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Warning,
        message: `  ⚠️ Final navigation back to main page failed, continuing anyway: ${error}`,
      });
    }
  }

  /**
   * Robust navigation with retry logic and fallback strategies
   * Real-world solution for network tracking removal impact
   */
  private async _robustNavigation(page: Page, url: string, timeoutMs: number): Promise<void> {
    const maxRetries = 2;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Info,
          message: `  🌐 Navigation attempt ${attempt}/${maxRetries} to ${url}`,
        });

        // Use Promise.race to handle both goto and waitForLoadState with shared timeout
        await Promise.race([
          (async () => {
            await page.goto(url);
            await page.waitForLoadState('load', { timeout: timeoutMs });
          })(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Navigation timeout after ${timeoutMs}ms`)),
              timeoutMs + 500
            )
          ),
        ]);

        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: `  ✅ Navigation successful on attempt ${attempt}`,
        });
        return; // Success!
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: `  ⚠️ Navigation attempt ${attempt} failed: ${lastError.message}`,
        });

        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries failed - throw the last error
    const lastErrorMsg = lastError?.message || 'Unknown error';
    const errorMessage = `Navigation failed after ${maxRetries} attempts. Last error: ${lastErrorMsg}`;
    throw new Error(errorMessage);
  }
}
