import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Quick demo of selectText functionality on the test page
 * This is a lightweight test that showcases the main selectText features
 */
export async function demoSelectTextFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    progress.log('🎯 Running selectText functionality demo');

    // Demo 1: Select text in an input field
    progress.log('Demo 1: Selecting text in the search input field');
    await page.locator('#search-input').fill('Demo search text');
    await page.locator('#search-input').selectText();

    // Visual feedback
    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#d1ecf1';
        statusDiv.innerHTML = '<strong>📝 SelectText Demo:</strong> Search input text selected!';
      }
    });

    // Demo 2: Select text in textarea
    progress.log('Demo 2: Selecting text in the textarea field');
    await page
      .locator('#textarea-input')
      .fill('Demo textarea content\nMultiple lines\nFor selection testing');
    await page.locator('#textarea-input').selectText();

    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>📝 Demo 2:</strong> Textarea text selected!';
      }
    });

    // Demo 3: Select text in password field using ElementHandle
    progress.log('Demo 3: Selecting text in password field using ElementHandle');
    const passwordHandle = await page.locator('#password-input').elementHandle();
    if (passwordHandle) {
      await passwordHandle.fill('demo-password-123');
      await passwordHandle.selectText();
      passwordHandle.dispose();
    }

    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>🔐 Demo 3:</strong> Password field text selected!';
      }
    });

    // Demo 4: Select content text
    progress.log('Demo 4: Selecting content text from a page element');
    await page.locator('h1').selectText();

    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>📄 Demo 4:</strong> Page heading text selected!';
      }
    });

    // Final summary
    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML +=
          '<br><br><strong>✅ SelectText Demo Complete!</strong><br>Successfully demonstrated text selection on:<br>• Input fields<br>• Textarea<br>• Password field<br>• Page content';
      }
    });

    progress.log('✅ selectText functionality demo completed successfully');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'selectText functionality demo completed',
      details: {
        demosRun: 4,
        inputFieldDemo: 'SUCCESS',
        textareaDemo: 'SUCCESS',
        passwordFieldDemo: 'SUCCESS',
        contentDemo: 'SUCCESS',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`selectText demo failed: ${errorMessage}`);
    throw error;
  }
}
