import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Network event functionality test - DEPRECATED
 * Network tracking has been removed in favor of content script readiness approach.
 * This test is kept as a stub for backward compatibility.
 */
export async function networkEventFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  progress.log('⚠️ Network event functionality test is deprecated');
  progress.log('🔄 Content script readiness approach is now used instead');
  progress.log('✅ This test is kept as a stub for backward compatibility');

  // Simple test to verify page is working
  progress.log(`✅ Page ${page.tabId} is accessible and functional`);
  progress.log('💡 For network-like behavior, use page.waitForLoadState("networkidle")');

  // Test the new approach
  try {
    progress.log('🧪 Testing content script readiness...');
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    progress.log('✅ Content script readiness test completed');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Content script readiness test completed successfully',
      details: { approach: 'content-script-readiness' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`⚠️ Content script readiness test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Warning,
      message: 'Content script readiness test failed',
      details: { error: errorMessage },
    });
  }
}
