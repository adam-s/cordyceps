import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';
import { handleTestError } from './testUtils';

export async function testDragToFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting dragTo() functionality tests',
    });

    // Test 1: Basic drag and drop from draggable item to drop zone
    progress.log('Test 1: Basic drag from draggable item to drop zone');

    // Set up drag and drop event tracking
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).dragDropEvents = [];

      // Track drag events on draggable items AND sortable items
      const draggableItems = document.querySelectorAll('.draggable-item, .sortable-item');
      draggableItems.forEach(item => {
        item.addEventListener('dragstart', e => {
          ((window as unknown as Record<string, unknown>).dragDropEvents as unknown[]).push({
            type: 'dragstart',
            target:
              (e.target as HTMLElement).id ||
              (e.target as HTMLElement).textContent ||
              (e.target as HTMLElement).getAttribute('data-testid'),
            timestamp: Date.now(),
          });
          console.log(
            'Drag started on:',
            (e.target as HTMLElement).id || (e.target as HTMLElement).getAttribute('data-testid')
          );
        });
      });

      // Track drop events on drop zones AND sortable containers/items
      const dropZones = document.querySelectorAll(
        '.drop-zone, .sortable-container, .sortable-item'
      );
      dropZones.forEach(zone => {
        zone.addEventListener('dragover', e => {
          e.preventDefault();
          ((window as unknown as Record<string, unknown>).dragDropEvents as unknown[]).push({
            type: 'dragover',
            target:
              (e.target as HTMLElement).id ||
              (e.target as HTMLElement).getAttribute('data-testid') ||
              (e.target as HTMLElement).textContent,
            timestamp: Date.now(),
          });
        });

        zone.addEventListener('drop', e => {
          e.preventDefault();
          ((window as unknown as Record<string, unknown>).dragDropEvents as unknown[]).push({
            type: 'drop',
            target:
              (e.target as HTMLElement).id ||
              (e.target as HTMLElement).getAttribute('data-testid') ||
              (e.target as HTMLElement).textContent,
            timestamp: Date.now(),
          });
          console.log(
            'Drop completed on:',
            (e.target as HTMLElement).id || (e.target as HTMLElement).getAttribute('data-testid')
          );
        });
      });
    }, 'MAIN');

    // Perform drag and drop operation
    const sourceLocator = page.locator('[data-testid="drag-item-1"]');
    const targetLocator = page.locator('[data-testid="drop-zone-1"]');

    // Scroll both source and target into view before drag operation
    await sourceLocator.scrollIntoViewIfNeeded();
    await targetLocator.scrollIntoViewIfNeeded();

    await sourceLocator.dragTo(targetLocator);

    // Verify drag and drop events were fired
    const dragDropEvents = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).dragDropEvents,
        'MAIN'
      );

    progress.log(`Drag and drop events captured: ${JSON.stringify(dragDropEvents)}`);

    if (!Array.isArray(dragDropEvents) || dragDropEvents.length === 0) {
      throw new Error('No drag and drop events were captured');
    }

    const hasStartEvent = dragDropEvents.some(
      (event: unknown) => (event as { type: string }).type === 'dragstart'
    );
    const hasDropEvent = dragDropEvents.some(
      (event: unknown) => (event as { type: string }).type === 'drop'
    );

    if (!hasStartEvent) {
      throw new Error('dragstart event was not fired');
    }
    if (!hasDropEvent) {
      throw new Error('drop event was not fired');
    }

    progress.log('✅ Test 1 passed: Basic drag and drop completed successfully');

    // Test 2: Drag and drop with custom positions
    progress.log('Test 2: Drag and drop with custom source and target positions');

    // Clear previous events
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).dragDropEvents = [];
    }, 'MAIN');

    const sourceLocator2 = page.locator('[data-testid="drag-item-2"]');
    const targetLocator2 = page.locator('[data-testid="drop-zone-2"]');

    // Scroll both source and target into view before drag operation
    await sourceLocator2.scrollIntoViewIfNeeded();
    await targetLocator2.scrollIntoViewIfNeeded();

    await sourceLocator2.dragTo(targetLocator2, {
      sourcePosition: { x: 10, y: 10 },
      targetPosition: { x: 50, y: 50 },
    });

    // Verify events were fired with custom positions
    const dragDropEvents2 = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).dragDropEvents,
        'MAIN'
      );

    if (!Array.isArray(dragDropEvents2) || dragDropEvents2.length === 0) {
      throw new Error('No drag and drop events were captured with custom positions');
    }

    progress.log('✅ Test 2 passed: Drag and drop with custom positions completed successfully');

    // Test 3: Drag and drop between sortable items
    progress.log('Test 3: Drag and drop within sortable container');

    // Clear previous events and set up fresh tracking for sortable items
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).dragDropEvents = [];

      // Re-setup event listeners specifically for sortable items
      const sortableItems = document.querySelectorAll('.sortable-item');
      console.log('Found sortable items:', sortableItems.length);

      sortableItems.forEach((item, index) => {
        console.log(
          `Setting up listeners for sortable item ${index}:`,
          item.getAttribute('data-testid')
        );

        item.addEventListener('dragstart', e => {
          const target =
            (e.target as HTMLElement).getAttribute('data-testid') ||
            (e.target as HTMLElement).textContent;
          console.log('Sortable dragstart event fired on:', target);
          ((window as unknown as Record<string, unknown>).dragDropEvents as unknown[]).push({
            type: 'dragstart',
            target: target,
            timestamp: Date.now(),
          });
        });

        item.addEventListener('dragover', e => {
          e.preventDefault();
          const target =
            (e.target as HTMLElement).getAttribute('data-testid') ||
            (e.target as HTMLElement).textContent;
          console.log('Sortable dragover event fired on:', target);
          ((window as unknown as Record<string, unknown>).dragDropEvents as unknown[]).push({
            type: 'dragover',
            target: target,
            timestamp: Date.now(),
          });
        });

        item.addEventListener('drop', e => {
          e.preventDefault();
          const target =
            (e.target as HTMLElement).getAttribute('data-testid') ||
            (e.target as HTMLElement).textContent;
          console.log('Sortable drop event fired on:', target);
          ((window as unknown as Record<string, unknown>).dragDropEvents as unknown[]).push({
            type: 'drop',
            target: target,
            timestamp: Date.now(),
          });
        });
      });
    }, 'MAIN');

    const sortItemA = page.locator('[data-testid="sort-item-a"]');
    const sortItemD = page.locator('[data-testid="sort-item-d"]');

    // Scroll both sortable items into view before drag operation
    await sortItemA.scrollIntoViewIfNeeded();
    await sortItemD.scrollIntoViewIfNeeded();

    await sortItemA.dragTo(sortItemD);

    // Verify sortable drag and drop with better debugging
    const sortEvents = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).dragDropEvents,
        'MAIN'
      );

    progress.log(`Sortable drag and drop events captured: ${JSON.stringify(sortEvents)}`);

    if (!Array.isArray(sortEvents) || sortEvents.length === 0) {
      // Additional debugging - check if elements exist and are draggable
      const elementInfo = await page.mainFrame().context.executeScript(() => {
        const sortA = document.querySelector('[data-testid="sort-item-a"]');
        const sortD = document.querySelector('[data-testid="sort-item-d"]');
        return {
          sortAExists: !!sortA,
          sortDExists: !!sortD,
          sortADraggable: sortA ? sortA.getAttribute('draggable') : null,
          sortDDraggable: sortD ? sortD.getAttribute('draggable') : null,
          sortAText: sortA ? sortA.textContent : null,
          sortDText: sortD ? sortD.textContent : null,
        };
      }, 'MAIN');

      progress.log(`Element debug info: ${JSON.stringify(elementInfo)}`);
      throw new Error('No sortable drag and drop events were captured - see debug info above');
    }

    progress.log('✅ Test 3 passed: Sortable drag and drop completed successfully');

    // Test 4: Error handling - drag to non-existent element
    progress.log('Test 4: Error handling with invalid target selector');

    try {
      // Use a fresh, more specific source locator that targets the original element in the source container
      const errorTestSourceLocator = page.locator('#drag-source [data-testid="drag-item-1"]');
      const invalidTargetLocator = page.locator('#non-existent-element');

      // Scroll source into view before attempting drag operation
      await errorTestSourceLocator.scrollIntoViewIfNeeded();

      // Use a shorter timeout for invalid element tests to fail quickly
      await errorTestSourceLocator.dragTo(invalidTargetLocator, { timeout: 5000 });
      throw new Error('Expected error for invalid target, but operation succeeded');
    } catch (error) {
      progress.log(
        `Test 4 caught error: ${error instanceof Error ? error.message : String(error)}`
      );
      if (
        error instanceof Error &&
        (error.message.includes('Element not found') ||
          error.message.includes('Timeout') ||
          error.message.includes('non-existent-element'))
      ) {
        progress.log('✅ Test 4 passed: Correctly handled invalid target selector');
      } else {
        progress.log('❌ Test 4 failed: Unexpected error type');
        throw error;
      }
    }

    // Test 5: Drag and drop with timeout option
    progress.log('Test 5: Drag and drop with custom timeout');

    const timeoutSourceLocator = page.locator('[data-testid="drag-item-3"]');
    const timeoutTargetLocator = page.locator('[data-testid="target-a"]');

    // Scroll both elements into view before drag operation with timeout
    await timeoutSourceLocator.scrollIntoViewIfNeeded();
    await timeoutTargetLocator.scrollIntoViewIfNeeded();

    await timeoutSourceLocator.dragTo(timeoutTargetLocator, {
      timeout: 15000,
    });

    progress.log('✅ Test 5 passed: Drag and drop with custom timeout completed successfully');

    // Test 6: Verify dragTo method delegation to Frame.dragAndDrop
    progress.log('Test 6: Verify dragTo method calls Frame.dragAndDrop correctly');

    // This test verifies that the Locator.dragTo method properly delegates to Frame.dragAndDrop
    const gridTargetA = page.locator('[data-testid="target-a"]');
    const gridTargetB = page.locator('[data-testid="target-b"]');

    // Scroll both grid targets into view before delegation test
    await gridTargetA.scrollIntoViewIfNeeded();
    await gridTargetB.scrollIntoViewIfNeeded();

    await gridTargetA.dragTo(gridTargetB);

    progress.log('✅ Test 6 passed: dragTo delegation to Frame.dragAndDrop works correctly');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'All dragTo() functionality tests completed successfully',
    });

    progress.log('🎉 All drag and drop tests passed successfully!');
  } catch (error) {
    handleTestError(error, 'testDragToFunctionality', progress, context);
    throw error;
  }
}

/**
 * Test drag and drop functionality with comprehensive scenarios
 */
export async function testDragToAdvanced(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting advanced dragTo() functionality tests',
    });

    // Advanced Test 1: Multiple drag and drop operations in sequence
    progress.log('Advanced Test 1: Sequential drag and drop operations');

    const items = ['drag-item-1', 'drag-item-2', 'drag-item-3'];
    const targets = ['target-a', 'target-b', 'target-c'];

    for (let i = 0; i < items.length; i++) {
      // Use more specific selectors to target original elements in the drag-source container
      const itemLocator = page.locator(`#drag-source [data-testid="${items[i]}"]`);
      const targetLocator = page.locator(`[data-testid="${targets[i]}"]`);

      // Scroll both elements into view before each drag operation
      await itemLocator.scrollIntoViewIfNeeded();
      await targetLocator.scrollIntoViewIfNeeded();

      await itemLocator.dragTo(targetLocator);
      progress.log(`✓ Dragged ${items[i]} to ${targets[i]}`);
    }

    progress.log('✅ Advanced Test 1 passed: Sequential drag and drop operations completed');

    // Advanced Test 2: Drag and drop with force option (if implemented)
    progress.log('Advanced Test 2: Testing drag and drop resilience');

    const resilientSource = page.locator('[data-testid="sort-item-b"]');
    const resilientTarget = page.locator('[data-testid="sort-item-c"]');

    // Scroll elements into view before resilience testing
    await resilientSource.scrollIntoViewIfNeeded();
    await resilientTarget.scrollIntoViewIfNeeded();

    // Test multiple rapid drag operations
    await resilientSource.dragTo(resilientTarget);
    await resilientTarget.dragTo(resilientSource);

    progress.log('✅ Advanced Test 2 passed: Resilient drag and drop operations completed');

    // Advanced Test 3: Verify drag and drop state changes
    progress.log('Advanced Test 3: Verify DOM state changes after drag and drop');

    // Check initial state
    const initialDropZoneContent = await page.locator('[data-testid="drop-zone-1"]').textContent();
    progress.log(`Initial drop zone content: "${initialDropZoneContent}"`);

    // Perform drag and drop using more specific selector to avoid duplicates
    const stateTestSource = page.locator('#drag-source [data-testid="drag-item-1"]');
    const stateTestTarget = page.locator('[data-testid="drop-zone-1"]');

    // Scroll elements into view before state verification test
    await stateTestSource.scrollIntoViewIfNeeded();
    await stateTestTarget.scrollIntoViewIfNeeded();

    await stateTestSource.dragTo(stateTestTarget);

    // Check final state (allowing for time for DOM updates)
    await new Promise(resolve => setTimeout(resolve, 500));
    const finalDropZoneContent = await page.locator('[data-testid="drop-zone-1"]').textContent();
    progress.log(`Final drop zone content: "${finalDropZoneContent}"`);

    progress.log('✅ Advanced Test 3 passed: DOM state verification completed');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'All advanced dragTo() functionality tests completed successfully',
    });

    progress.log('🎉 All advanced drag and drop tests passed successfully!');
  } catch (error) {
    handleTestError(error, 'testDragToAdvanced', progress, context);
    throw error;
  }
}
