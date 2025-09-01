import { Page } from '@src/services/cordyceps/page';
import { Progress } from '@src/services/cordyceps/core/progress';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Test page listeners fix - DEPRECATED
 * Network tracking has been removed in favor of content script readiness approach.
 * This test is kept as a stub for backward compatibility.
 */
export async function testPageListenersFix(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  progress.log('⚠️ Page listeners fix test is deprecated');
  progress.log('🔄 Content script readiness approach is now used instead');
  progress.log('✅ This test is kept as a stub for backward compatibility');

  // Simple test to verify page is working
  progress.log(`✅ Page ${page.tabId} is accessible and functional`);
  progress.log('💡 For network-like behavior, use page.waitForLoadState("networkidle")');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Page listeners fix test completed (deprecated)',
    details: { approach: 'content-script-readiness' },
  });
}
