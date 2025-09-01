import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Quick demo of setChecked functionality on the test page
 * This is a lightweight test that showcases the main setChecked features
 */
export async function demoSetCheckedFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    progress.log('🎯 Running setChecked functionality demo');

    // Demo 1: Set checkbox to checked state
    progress.log('Demo 1: Setting test checkbox to checked state');
    await page.locator('#test-checkbox').setChecked(true);

    // Visual feedback
    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#d1ecf1';
        statusDiv.innerHTML = '<strong>☑️ SetChecked Demo:</strong> Test checkbox set to checked!';
      }
    });

    // Demo 2: Set checkbox to unchecked state
    progress.log('Demo 2: Setting test checkbox to unchecked state');
    await page.locator('#test-checkbox').setChecked(false);

    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML += '<br><strong>☐ Demo 2:</strong> Test checkbox set to unchecked!';
      }
    });

    // Demo 3: Use setChecked with ElementHandle
    progress.log('Demo 3: Using setChecked with ElementHandle on advanced-mode checkbox');
    const advancedHandle = await page.locator('#advanced-mode').elementHandle();
    if (advancedHandle) {
      await advancedHandle.setChecked(false);
      await advancedHandle.setChecked(true);
      advancedHandle.dispose();
    }

    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML +=
          '<br><strong>🔧 Demo 3:</strong> ElementHandle setChecked toggle complete!';
      }
    });

    // Demo 4: Use Page-level setChecked
    progress.log('Demo 4: Using Page-level setChecked method');
    await page.setChecked('#test-checkbox', true);
    await page.setChecked('#advanced-mode', false);

    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML +=
          '<br><strong>📄 Demo 4:</strong> Page-level setChecked operations complete!';
      }
    });

    // Final summary
    await page.evaluate(() => {
      const statusDiv = document.getElementById('form-status');
      if (statusDiv) {
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.innerHTML +=
          '<br><br><strong>✅ SetChecked Demo Complete!</strong><br>Successfully demonstrated:<br>• Locator.setChecked(true/false)<br>• ElementHandle.setChecked()<br>• Page.setChecked()';
      }
    });

    // Reset to default states
    await page.setChecked('#test-checkbox', false); // Default unchecked
    await page.setChecked('#advanced-mode', true); // Default checked

    progress.log('✅ setChecked functionality demo completed successfully');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'setChecked functionality demo completed',
      details: {
        demosRun: 4,
        locatorDemo: 'SUCCESS',
        elementHandleDemo: 'SUCCESS',
        pageMethodDemo: 'SUCCESS',
        resetToDefaults: 'SUCCESS',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`setChecked demo failed: ${errorMessage}`);
    throw error;
  }
}
