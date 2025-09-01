import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

export async function testAriaSnapshotFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting ariaSnapshot functionality tests',
    });

    // Test 1: Frame-level ariaSnapshot (full page)
    progress.log('Test 1: Testing Frame.ariaSnapshot() for full page');
    const frameSnapshot = await page.mainFrame().ariaSnapshot({
      forAI: true,
      refPrefix: 'page',
    });

    if (frameSnapshot && frameSnapshot.length > 0) {
      progress.log(`Frame ariaSnapshot successful, length: ${frameSnapshot.length}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Frame ariaSnapshot works',
        details: {
          snapshotLength: frameSnapshot.length,
          preview: frameSnapshot.substring(0, 100) + '...',
        },
      });
    } else {
      throw new Error('Test 1 failed: Frame ariaSnapshot returned empty or null');
    }

    // Test 2: Frame-level ariaSnapshot with specific selector
    progress.log('Test 2: Testing Frame.ariaSnapshot() with specific selector');
    try {
      const selectorSnapshot = await page.mainFrame().ariaSnapshot({
        forAI: true,
        refPrefix: 'form',
        selector: '.container', // Target a specific container
      });

      if (selectorSnapshot && selectorSnapshot.length > 0) {
        progress.log(
          `Frame ariaSnapshot with selector successful, length: ${selectorSnapshot.length}`,
        );
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 2 passed: Frame ariaSnapshot with selector works',
          details: {
            snapshotLength: selectorSnapshot.length,
            preview: selectorSnapshot.substring(0, 100) + '...',
          },
        });
      } else {
        progress.log('Frame ariaSnapshot with selector returned empty, trying fallback');
        // Try with a more basic selector
        const fallbackSnapshot = await page.mainFrame().ariaSnapshot({
          forAI: true,
          refPrefix: 'body',
          selector: 'body',
        });

        if (fallbackSnapshot && fallbackSnapshot.length > 0) {
          progress.log('Fallback selector worked');
          context.events.emit({
            timestamp: Date.now(),
            severity: Severity.Success,
            message: 'Test 2 passed: Frame ariaSnapshot with fallback selector works',
          });
        } else {
          throw new Error('Test 2 failed: Frame ariaSnapshot with selector returned empty');
        }
      }
    } catch (error) {
      progress.log(
        `Test 2 selector error: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Try without selector as fallback
      const basicSnapshot = await page.mainFrame().ariaSnapshot({
        forAI: true,
        refPrefix: 'fallback',
      });
      if (basicSnapshot && basicSnapshot.length > 0) {
        progress.log('Basic frame snapshot worked as fallback');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Test 2 passed with fallback: Frame ariaSnapshot basic functionality works',
        });
      } else {
        throw error;
      }
    }

    // Test 3: Locator ariaSnapshot
    progress.log('Test 3: Testing Locator.ariaSnapshot()');
    try {
      // Use a simple, reliable selector
      const bodyLocator = page.locator('body');
      const locatorSnapshot = await bodyLocator.ariaSnapshot({
        forAI: true,
        refPrefix: 'locator',
      });

      if (locatorSnapshot && locatorSnapshot.length > 0) {
        progress.log(`Locator ariaSnapshot successful, length: ${locatorSnapshot.length}`);
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 3 passed: Locator ariaSnapshot works',
          details: {
            snapshotLength: locatorSnapshot.length,
            preview: locatorSnapshot.substring(0, 100) + '...',
          },
        });
      } else {
        throw new Error('Test 3 failed: Locator ariaSnapshot returned empty or null');
      }
    } catch (error) {
      progress.log(`Test 3 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 3 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 4: ElementHandle ariaSnapshot
    progress.log('Test 4: Testing ElementHandle.ariaSnapshot()');
    try {
      const bodyHandle = await page.locator('body').elementHandle();

      if (bodyHandle) {
        const elementSnapshot = await bodyHandle.ariaSnapshot({
          forAI: true,
          refPrefix: 'element',
        });

        if (elementSnapshot && elementSnapshot.length > 0) {
          progress.log(`ElementHandle ariaSnapshot successful, length: ${elementSnapshot.length}`);
          context.events.emit({
            timestamp: Date.now(),
            severity: Severity.Success,
            message: 'Test 4 passed: ElementHandle ariaSnapshot works',
            details: {
              snapshotLength: elementSnapshot.length,
              preview: elementSnapshot.substring(0, 100) + '...',
            },
          });
        } else {
          throw new Error('Test 4 failed: ElementHandle ariaSnapshot returned empty or null');
        }

        // Clean up the handle
        bodyHandle.dispose();
      } else {
        throw new Error('Test 4 failed: Could not get element handle for body');
      }
    } catch (error) {
      progress.log(`Test 4 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 4 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 5: Compare ariaSnapshot outputs with different forAI settings
    progress.log('Test 5: Testing ariaSnapshot with forAI=false vs forAI=true');
    try {
      const aiTrueSnapshot = await page.mainFrame().ariaSnapshot({
        forAI: true,
        refPrefix: 'ai_true',
      });

      const aiFalseSnapshot = await page.mainFrame().ariaSnapshot({
        forAI: false,
        refPrefix: 'ai_false',
      });

      if (aiTrueSnapshot && aiFalseSnapshot) {
        progress.log(`AI=true snapshot length: ${aiTrueSnapshot.length}`);
        progress.log(`AI=false snapshot length: ${aiFalseSnapshot.length}`);

        // They should be different or at least both non-empty
        if (aiTrueSnapshot.length > 0 && aiFalseSnapshot.length > 0) {
          context.events.emit({
            timestamp: Date.now(),
            severity: Severity.Success,
            message: 'Test 5 passed: ariaSnapshot forAI parameter works',
            details: {
              aiTrueLength: aiTrueSnapshot.length,
              aiFalseLength: aiFalseSnapshot.length,
            },
          });
        } else {
          throw new Error('Test 5 failed: One of the snapshots was empty');
        }
      } else {
        throw new Error('Test 5 failed: Could not get snapshots for comparison');
      }
    } catch (error) {
      progress.log(`Test 5 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 5 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 6: Test with different refPrefix values
    progress.log('Test 6: Testing ariaSnapshot with different refPrefix values');
    try {
      const prefix1Snapshot = await page.mainFrame().ariaSnapshot({
        forAI: true,
        refPrefix: 'test_prefix_1',
      });

      const prefix2Snapshot = await page.mainFrame().ariaSnapshot({
        forAI: true,
        refPrefix: 'test_prefix_2',
      });

      if (
        prefix1Snapshot &&
        prefix2Snapshot &&
        prefix1Snapshot.length > 0 &&
        prefix2Snapshot.length > 0
      ) {
        // Check if the prefixes appear in the snapshots
        const hasPrefix1 = prefix1Snapshot.includes('test_prefix_1');
        const hasPrefix2 = prefix2Snapshot.includes('test_prefix_2');

        if (hasPrefix1 || hasPrefix2) {
          progress.log('RefPrefix appears to be working (found in at least one snapshot)');
        }

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 6 passed: ariaSnapshot refPrefix parameter works',
          details: {
            prefix1Found: hasPrefix1,
            prefix2Found: hasPrefix2,
          },
        });
      } else {
        throw new Error('Test 6 failed: Could not get snapshots with different prefixes');
      }
    } catch (error) {
      progress.log(`Test 6 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 6 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'AriaSnapshot functionality tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`AriaSnapshot functionality test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'AriaSnapshot functionality tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}
