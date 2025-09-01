import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';
import { executeTestWithErrorHandling, assertTestCondition } from './testUtils';

export async function testNavigationAutoWait(page: Page, progress: Progress, context: TestContext) {
  await executeTestWithErrorHandling(
    'Navigation Auto-Wait (click)',
    async () => {
      // Ensure the example page is loaded
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Starting navigation auto-wait test',
      });
      // Add an anchor that triggers a same-document hash navigation and click it
      await page.evaluate(() => {
        const id = 'autoWait-hash-link';
        if (!document.getElementById(id)) {
          const a = document.createElement('a');
          a.id = id;
          a.href = '#auto-section';
          a.textContent = 'Go to Auto Section';
          document.body.appendChild(a);
        }
        if (!document.getElementById('auto-section')) {
          const target = document.createElement('div');
          target.id = 'auto-section';
          target.style.marginTop = '1200px';
          target.textContent = 'Auto Section Target';
          document.body.appendChild(target);
        }
      });
      const link = page.locator('#autoWait-hash-link');
      await link.click(); // should auto-wait for commit (same-document)

      // Verify hash updated
      const hash = await page.evaluate(() => window.location.hash);
      assertTestCondition(
        hash === '#auto-section',
        'URL hash should update after click',
        'Navigation Auto-Wait (click)',
        hash,
        '#auto-section'
      );

      // Now test cross-document navigation: create a local route link and click it
      await page.evaluate(() => {
        const id = 'autoWait-crossdoc-link';
        if (!document.getElementById(id)) {
          const a = document.createElement('a');
          a.id = id;
          a.href = '/iframe1';
          a.textContent = 'Go to /iframe1';
          document.body.appendChild(a);
        }
      });

      const cross = page.locator('#autoWait-crossdoc-link');
      await cross.click(); // should auto-wait for commit; page URL changes

      // Give a short settle time; then verify URL ends with /iframe1
      await new Promise(r => setTimeout(r, 100));
      const url = await page.evaluate(() => window.location.pathname);
      assertTestCondition(
        url === '/iframe1',
        'Pathname should be /iframe1 after navigation',
        'Navigation Auto-Wait (click)',
        url,
        '/iframe1'
      );

      // Navigate back to the root page so subsequent tests have expected DOM
      const origin = await page.evaluate(() => window.location.origin);
      await page.goto(`${origin}/`, { waitUntil: 'load', timeout: 30000 });
    },
    progress,
    context
  );
}

export async function testNavigationGoBack(page: Page, progress: Progress, context: TestContext) {
  await executeTestWithErrorHandling(
    'Navigation GoBack',
    async () => {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Starting goBack navigation test',
      });

      // Get initial URL
      const origin = await page.evaluate(() => window.location.origin);

      // Start fresh - navigate to root to establish baseline
      await page.goto(`${origin}/`, { waitUntil: 'commit', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);
      await new Promise(r => setTimeout(r, 200));

      // Navigate to iframe1 page to create browser history
      await page.goto(`${origin}/iframe1`, { waitUntil: 'commit', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);
      await new Promise(r => setTimeout(r, 200));

      // Verify we're on iframe1
      let currentUrl = await page.evaluate(() => window.location.pathname);
      assertTestCondition(
        currentUrl === '/iframe1',
        'Should be on /iframe1 page before goBack',
        'Navigation GoBack',
        currentUrl,
        '/iframe1'
      );

      // Test goBack - should go back to root
      // Note: chrome.tabs.goBack() may fail in test environment, will fallback to history.back()
      await page.goBack({ waitUntil: 'commit', timeout: 15000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);

      // Add 200ms settling time after goBack
      await new Promise(r => setTimeout(r, 200));

      // Verify we went back to root
      currentUrl = await page.evaluate(() => window.location.pathname);
      assertTestCondition(
        currentUrl === '/',
        'Should be back on root page after goBack',
        'Navigation GoBack',
        currentUrl,
        '/'
      );

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'GoBack navigation test completed successfully',
      });
    },
    progress,
    context
  );
}

export async function testNavigationGoForward(
  page: Page,
  progress: Progress,
  context: TestContext
) {
  await executeTestWithErrorHandling(
    'Navigation GoForward',
    async () => {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Starting goForward navigation test',
      });

      const origin = await page.evaluate(() => window.location.origin);

      // Set up clean state - navigate to root first to establish a clean starting point
      await page.goto(`${origin}/`, { waitUntil: 'commit', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);
      await new Promise(r => setTimeout(r, 200));

      // Navigate to iframe1 to create forward history
      await page.goto(`${origin}/iframe1`, { waitUntil: 'commit', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);
      await new Promise(r => setTimeout(r, 200));

      // Go back to create forward history
      await page.goBack({ waitUntil: 'commit', timeout: 15000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);
      await new Promise(r => setTimeout(r, 200));

      // Verify we're back on root (this is the critical assertion that was failing)
      let currentUrl = await page.evaluate(() => window.location.pathname);
      assertTestCondition(
        currentUrl === '/',
        'Should be on root page before goForward',
        'Navigation GoForward',
        currentUrl,
        '/'
      );

      // Test goForward - should go forward to iframe1
      await page.goForward({ waitUntil: 'commit', timeout: 15000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);

      // Add 200ms settling time after goForward
      await new Promise(r => setTimeout(r, 200));

      // Verify we went forward to iframe1
      currentUrl = await page.evaluate(() => window.location.pathname);
      assertTestCondition(
        currentUrl === '/iframe1',
        'Should be on /iframe1 page after goForward',
        'Navigation GoForward',
        currentUrl,
        '/iframe1'
      );

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'GoForward navigation test completed successfully',
      });

      // Clean up - return to root page
      await page.goto(`${origin}/`, { waitUntil: 'load', timeout: 30000 });
    },
    progress,
    context
  );
}

export async function testNavigationSameDocumentGoBack(
  page: Page,
  progress: Progress,
  context: TestContext
) {
  await executeTestWithErrorHandling(
    'Navigation Same-Document GoBack',
    async () => {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Starting same-document goBack test (hash navigation)',
      });

      const origin = await page.evaluate(() => window.location.origin);

      // Ensure we're on root page
      await page.goto(`${origin}/`, { waitUntil: 'commit', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);
      await new Promise(r => setTimeout(r, 200));

      // Use history.pushState to create same-document navigation history
      await page.evaluate(() => {
        // Create multiple history entries with pushState
        history.pushState({}, '', '/step1');
        history.pushState({}, '', '/step2');
        history.pushState({}, '', '/step3');
      });
      await new Promise(r => setTimeout(r, 200));

      // Verify we're on step3
      let currentPath = await page.evaluate(() => window.location.pathname);
      assertTestCondition(
        currentPath === '/step3',
        'Should be on /step3 after pushState',
        'Navigation Same-Document GoBack',
        currentPath,
        '/step3'
      );

      // Test goBack - should go back to step2
      // Note: chrome.tabs.goBack() will fail for pushState navigation, history.back() fallback handles this
      await page.goBack({ timeout: 10000 });
      await new Promise(r => setTimeout(r, 200));

      currentPath = await page.evaluate(() => window.location.pathname);
      assertTestCondition(
        currentPath === '/step2',
        'Should be on /step2 after first goBack',
        'Navigation Same-Document GoBack',
        currentPath,
        '/step2'
      );

      // Test another goBack - should go back to step1
      // Note: chrome.tabs.goBack() will fail for pushState navigation, history.back() fallback handles this
      await page.goBack({ timeout: 10000 });
      await new Promise(r => setTimeout(r, 200));

      currentPath = await page.evaluate(() => window.location.pathname);
      assertTestCondition(
        currentPath === '/step1',
        'Should be on /step1 after second goBack',
        'Navigation Same-Document GoBack',
        currentPath,
        '/step1'
      );

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Same-document goBack test completed successfully',
      });

      // Clean up - return to root page
      await page.goto(`${origin}/`, { waitUntil: 'load', timeout: 30000 });
    },
    progress,
    context
  );
}

export async function testNavigationReload(page: Page, progress: Progress, context: TestContext) {
  await executeTestWithErrorHandling(
    'Navigation Reload',
    async () => {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Starting page reload test',
      });

      const origin = await page.evaluate(() => window.location.origin);

      // Ensure we're on a specific page
      await page.goto(`${origin}/iframe1`, { waitUntil: 'commit', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);
      await new Promise(r => setTimeout(r, 200));

      // Add some dynamic content to verify reload
      await page.evaluate(() => {
        const marker = document.createElement('div');
        marker.id = 'reload-test-marker';
        marker.textContent = 'Before reload';
        document.body.appendChild(marker);
      });

      // Verify marker exists
      let markerExists = await page.evaluate(() => !!document.getElementById('reload-test-marker'));
      assertTestCondition(
        markerExists,
        'Test marker should exist before reload',
        'Navigation Reload',
        markerExists,
        true
      );

      // Test reload - should refresh the page and remove dynamic content
      await page.reload({ waitUntil: 'commit', timeout: 15000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);

      // Add 200ms settling time after reload
      await new Promise(r => setTimeout(r, 200));

      // Verify we're still on the same page
      const currentUrl = await page.evaluate(() => window.location.pathname);
      assertTestCondition(
        currentUrl === '/iframe1',
        'Should still be on /iframe1 page after reload',
        'Navigation Reload',
        currentUrl,
        '/iframe1'
      );

      // Verify dynamic content was removed by reload
      markerExists = await page.evaluate(() => !!document.getElementById('reload-test-marker'));
      assertTestCondition(
        !markerExists,
        'Test marker should be removed after reload',
        'Navigation Reload',
        markerExists,
        false
      );

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Page reload test completed successfully',
      });
    },
    progress,
    context
  );
}
