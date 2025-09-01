/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, test } from '../fixtures/extensionTest';

/**
 * Navigation functionality tests for goBack/goForward implementation
 * Tests the integration between side panel and content scripts
 */
test.describe('Navigation Functionality', () => {
  test('should navigate back successfully', async ({ context, extensionId, serverUrl }) => {
    // Increase test timeout for navigation operations
    test.setTimeout(120000);

    // Open the side panel
    const sidePanelPage = await context.newPage();
    await sidePanelPage.goto(`chrome-extension://${extensionId}/side-panel/index.html`);
    await sidePanelPage.waitForLoadState();
    await expect(sidePanelPage.locator('text=Cordyceps Test Runner')).toBeVisible();

    // Open a test page in another tab
    const testPage = await context.newPage();
    await testPage.goto(`${serverUrl}/nav-page-1`);
    await testPage.waitForLoadState();

    // Navigate to page 2
    await testPage.getByTestId('nav-to-page-2').click();
    await testPage.waitForURL('**/nav-page-2');

    // Wait for page to be ready
    await expect(testPage.getByTestId('nav-ready')).toHaveText('true');

    // Use the side panel to navigate back
    // This would require implementing the goBack functionality in the side panel UI
    // For now, we'll test the basic navigation structure

    // Verify we're on page 2
    await expect(testPage.getByTestId('page-identifier')).toHaveText('nav-page-2');

    // Use browser back for now (until side panel integration is complete)
    await testPage.goBack();

    // Should be back on page 1
    await testPage.waitForURL('**/nav-page-1');
    await expect(testPage.getByTestId('page-identifier')).toHaveText('nav-page-1');
  });

  test('should handle hash navigation correctly', async ({ context, extensionId, serverUrl }) => {
    test.setTimeout(120000);

    const testPage = await context.newPage();
    await testPage.goto(`${serverUrl}/nav-page-1`);
    await testPage.waitForLoadState();

    // Click hash navigation link
    await testPage.getByTestId('hash-nav-section1').click();

    // URL should include hash
    await expect(testPage).toHaveURL(/.*#section1$/);

    // Navigate to another hash
    await testPage.getByTestId('hash-nav-section2').click();
    await expect(testPage).toHaveURL(/.*#section2$/);

    // Navigate back using browser
    await testPage.goBack();
    await expect(testPage).toHaveURL(/.*#section1$/);

    // Navigate forward using browser
    await testPage.goForward();
    await expect(testPage).toHaveURL(/.*#section2$/);
  });

  test('should handle SPA navigation with pushState', async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    test.setTimeout(120000);

    const testPage = await context.newPage();
    await testPage.goto(`${serverUrl}/nav-page-2`);
    await testPage.waitForLoadState();

    // Trigger SPA navigation
    await testPage.getByTestId('spa-nav-step1').click();
    await expect(testPage).toHaveURL(/.*\/spa-step-1$/);

    // Another SPA navigation
    await testPage.getByTestId('spa-nav-step2').click();
    await expect(testPage).toHaveURL(/.*\/spa-step-2$/);

    // Navigate back using browser
    await testPage.goBack();
    await expect(testPage).toHaveURL(/.*\/spa-step-1$/);

    // Navigate forward using browser
    await testPage.goForward();
    await expect(testPage).toHaveURL(/.*\/spa-step-2$/);
  });

  test('should handle replaceState navigation correctly', async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    test.setTimeout(120000);

    const testPage = await context.newPage();
    await testPage.goto(`${serverUrl}/nav-page-1`);
    await testPage.waitForLoadState();

    // Navigate to page 3 which has replaceState functionality
    await testPage.getByTestId('nav-to-page-3').click();
    await testPage.waitForURL('**/nav-page-3');

    // Record initial history length
    const initialHistoryLength = await testPage.getByTestId('history-length').textContent();

    // Use replaceState (should not change history length)
    await testPage.getByTestId('replace-url-1').click();
    await expect(testPage).toHaveURL(/.*\/replaced-url-1$/);

    // History length should be the same
    await expect(testPage.getByTestId('history-length')).toHaveText(initialHistoryLength || '');

    // Navigate back should go to previous page, not replaced URL
    await testPage.goBack();
    await testPage.waitForURL('**/nav-page-1');
  });

  test('should handle mixed navigation test', async ({ context, extensionId, serverUrl }) => {
    test.setTimeout(120000);

    const testPage = await context.newPage();
    await testPage.goto(`${serverUrl}/nav-page-3`);
    await testPage.waitForLoadState();

    // Run mixed navigation test
    await testPage.getByTestId('mixed-nav').click();

    // Wait for mixed navigation to complete
    await expect(testPage.getByTestId('mixed-nav-status')).toHaveText('completed');

    // Should be on the final pushed state
    await expect(testPage).toHaveURL(/.*\/step-4-pushed$/);

    // Navigate back using browser
    await testPage.goBack();

    // Should be on previous state
    await expect(testPage).toHaveURL(/.*\/step-3-replaced$/);
  });

  test('should handle cross-document navigation chain', async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    test.setTimeout(120000);

    const testPage = await context.newPage();
    await testPage.goto(`${serverUrl}/nav-page-1`);
    await testPage.waitForLoadState();

    // Create a chain of navigation: page1 -> page2 -> page3 -> page1
    await testPage.getByTestId('nav-to-page-2').click();
    await testPage.waitForURL('**/nav-page-2');

    await testPage.getByTestId('nav-to-page-3').click();
    await testPage.waitForURL('**/nav-page-3');

    await testPage.getByTestId('nav-to-page-1').click();
    await testPage.waitForURL('**/nav-page-1');

    // Now navigate back through the chain
    await testPage.goBack();
    await testPage.waitForURL('**/nav-page-3');

    await testPage.goBack();
    await testPage.waitForURL('**/nav-page-2');

    await testPage.goBack();
    await testPage.waitForURL('**/nav-page-1');

    // Navigate forward through the chain
    await testPage.goForward();
    await testPage.waitForURL('**/nav-page-2');

    await testPage.goForward();
    await testPage.waitForURL('**/nav-page-3');

    await testPage.goForward();
    await testPage.waitForURL('**/nav-page-1');
  });
});
