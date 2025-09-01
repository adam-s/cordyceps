/**
 * ObserveHandlerUtils Redux - Chrome Extension Compatible Functions
 *
 * This module provides content script functions for observing and highlighting elements
 * in Chrome extension environments. All functions are CSP-compliant and work within
 * content script contexts.
 *
 * Features:
 * - Complete TypeScript safety with no 'any' types
 * - Real DOM manipulation with proper element highlighting
 * - Chrome extension Content Security Policy compliance
 * - XPath and CSS selector support for element location
 * - Visual overlay system for element observation
 * - Production-ready code quality with comprehensive error handling
 */

// =============================================================================
// CONTENT SCRIPT FUNCTIONS FOR OBSERVE HANDLER
// =============================================================================

/**
 * Content script function to draw visual overlays on observed elements
 * This function runs in the MAIN world content script context to highlight elements
 *
 * Accepts either:
 * - page.evaluate(drawObserveOverlayFunction, selectors)
 * - element.executeFunction('drawObserveOverlay', selectors)
 */
export const drawObserveOverlayFunction = (
  elementOrSelectors: unknown,
  options?: unknown
): boolean => {
  const selectors: string[] = Array.isArray(elementOrSelectors)
    ? (elementOrSelectors as string[])
    : Array.isArray(options)
      ? (options as string[])
      : typeof elementOrSelectors === 'string'
        ? [elementOrSelectors]
        : [];
  console.log(
    `[drawObserveOverlayFunction] drawing overlays for ${selectors.length} selectors ######`
  );
  selectors.forEach(selector => {
    let element: Element | null;

    try {
      if (selector.startsWith('xpath=')) {
        const xpath = selector.substring(6);
        console.log(`[drawObserveOverlayFunction] evaluating xpath="${xpath}" ######`);
        element = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue as Element | null;
      } else {
        console.log(`[drawObserveOverlayFunction] querying selector="${selector}" ######`);
        element = document.querySelector(selector);
      }

      if (element instanceof HTMLElement) {
        console.log(`[drawObserveOverlayFunction] creating overlay for element`, element, `######`);
        const overlay = document.createElement('div');
        overlay.setAttribute('stagehandObserve', 'true');
        const rect = element.getBoundingClientRect();
        overlay.style.position = 'absolute';
        overlay.style.left = rect.left + 'px';
        overlay.style.top = rect.top + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '10000';
        document.body.appendChild(overlay);
      } else {
        console.log(
          `[drawObserveOverlayFunction] element not found or not an HTMLElement for selector="${selector}" ######`
        );
      }
    } catch (error) {
      console.error(
        `[drawObserveOverlayFunction] error processing selector="${selector}": ${error instanceof Error ? error.message : String(error)} ######`
      );
    }
  });
  return true;
};

/**
 * Content script function to clear all observation overlays
 * Removes all visual highlights created by drawObserveOverlayFunction
 */
export const clearObserveOverlaysFunction = (_element: Element, _options?: unknown): boolean => {
  console.log(`[clearObserveOverlaysFunction] clearing all overlays ######`);
  const overlays = document.querySelectorAll('[stagehandObserve="true"]');
  console.log(`[clearObserveOverlaysFunction] found ${overlays.length} overlays to remove ######`);
  overlays.forEach(overlay => overlay.remove());
  return true;
};

/**
 * Content script function to count observable elements matching given selectors
 * Returns count information for validation and testing
 *
 * @param selectors - Array of CSS selectors or XPath selectors (with xpath= prefix)
 * @returns Object with counts and element information
 */
export const countObservableElementsFunction = (
  elementOrSelectors: unknown,
  options?: unknown
): {
  totalSelectors: number;
  foundElements: number;
  foundElementTypes: string[];
  missingSelectors: string[];
} => {
  const selectors: string[] = Array.isArray(elementOrSelectors)
    ? (elementOrSelectors as string[])
    : Array.isArray(options)
      ? (options as string[])
      : typeof elementOrSelectors === 'string'
        ? [elementOrSelectors]
        : [];
  console.log(
    `[countObservableElementsFunction] counting elements for ${selectors.length} selectors ######`
  );
  const foundElementTypes: string[] = [];
  const missingSelectors: string[] = [];
  let foundElements = 0;

  selectors.forEach(selector => {
    let element: Element | null;

    try {
      if (selector.startsWith('xpath=')) {
        const xpath = selector.substring(6);
        console.log(`[countObservableElementsFunction] evaluating xpath="${xpath}" ######`);
        element = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue as Element | null;
      } else {
        console.log(`[countObservableElementsFunction] querying selector="${selector}" ######`);
        element = document.querySelector(selector);
      }

      if (element) {
        foundElements++;
        foundElementTypes.push(element.tagName.toLowerCase());
        console.log(
          `[countObservableElementsFunction] found element for selector="${selector}" ######`
        );
      } else {
        missingSelectors.push(selector);
        console.log(
          `[countObservableElementsFunction] did not find element for selector="${selector}" ######`
        );
      }
    } catch (error) {
      console.error(
        `[countObservableElementsFunction] error processing selector="${selector}": ${error instanceof Error ? error.message : String(error)} ######`
      );
      missingSelectors.push(selector);
    }
  });

  const result = {
    totalSelectors: selectors.length,
    foundElements,
    foundElementTypes,
    missingSelectors,
  };
  console.log(`[countObservableElementsFunction] result=${JSON.stringify(result)} ######`);
  return result;
};

/**
 * Content script function to get detailed element information for observed elements
 * Provides comprehensive element data for testing and validation
 *
 * @param selectors - Array of CSS selectors or XPath selectors (with xpath= prefix)
 * @returns Array of element information objects
 */
export const getObservedElementInfoFunction = (
  elementOrSelectors: unknown,
  options?: unknown
): Array<{
  selector: string;
  found: boolean;
  tagName?: string;
  id?: string;
  className?: string;
  textContent?: string;
  visible?: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}> => {
  const selectors: string[] = Array.isArray(elementOrSelectors)
    ? (elementOrSelectors as string[])
    : Array.isArray(options)
      ? (options as string[])
      : typeof elementOrSelectors === 'string'
        ? [elementOrSelectors]
        : [];
  console.log(
    `[getObservedElementInfoFunction] getting info for ${selectors.length} selectors ######`
  );
  return selectors.map(selector => {
    let element: Element | null;

    try {
      if (selector.startsWith('xpath=')) {
        const xpath = selector.substring(6);
        console.log(`[getObservedElementInfoFunction] evaluating xpath="${xpath}" ######`);
        element = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue as Element | null;
      } else {
        console.log(`[getObservedElementInfoFunction] querying selector="${selector}" ######`);
        element = document.querySelector(selector);
      }

      if (!element) {
        console.log(
          `[getObservedElementInfoFunction] element not found for selector="${selector}" ######`
        );
        return {
          selector,
          found: false,
        };
      }

      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(htmlElement);

      const info = {
        selector,
        found: true,
        tagName: element.tagName.toLowerCase(),
        id: element.id || undefined,
        className: element.className || undefined,
        textContent: element.textContent?.trim().slice(0, 100) || undefined,
        visible:
          computedStyle.display !== 'none' &&
          computedStyle.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0,
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      };
      console.log(
        `[getObservedElementInfoFunction] info for selector="${selector}": ${JSON.stringify(info)} ######`
      );
      return info;
    } catch (error) {
      console.error(
        `[getObservedElementInfoFunction] error processing selector="${selector}": ${error instanceof Error ? error.message : String(error)} ######`
      );
      return {
        selector,
        found: false,
      };
    }
  });
};

/**
 * Content script function to test XPath evaluation capabilities
 * Validates that XPath expressions can be properly evaluated in the content script context
 *
 * @param xpaths - Array of XPath expressions to test
 * @returns Test results for each XPath
 */
export const testXPathEvaluationFunction = (
  elementOrXPaths: unknown,
  options?: unknown
): Array<{
  xpath: string;
  success: boolean;
  error?: string;
  elementCount?: number;
  firstElementTag?: string;
}> => {
  const xpaths: string[] = Array.isArray(elementOrXPaths)
    ? (elementOrXPaths as string[])
    : Array.isArray(options)
      ? (options as string[])
      : typeof elementOrXPaths === 'string'
        ? [elementOrXPaths]
        : [];
  console.log(`[testXPathEvaluationFunction] testing ${xpaths.length} xpaths ######`);
  return xpaths.map(xpath => {
    try {
      console.log(`[testXPathEvaluationFunction] evaluating xpath="${xpath}" ######`);
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      const elementCount = result.snapshotLength;
      const firstElement = elementCount > 0 ? result.snapshotItem(0) : null;

      const evaluationResult = {
        xpath,
        success: true,
        elementCount,
        firstElementTag: firstElement?.nodeName.toLowerCase(),
      };
      console.log(
        `[testXPathEvaluationFunction] success for xpath="${xpath}": ${JSON.stringify(evaluationResult)} ######`
      );
      return evaluationResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[testXPathEvaluationFunction] error for xpath="${xpath}": ${errorMsg} ######`);
      return {
        xpath,
        success: false,
        error: errorMsg,
      };
    }
  });
};

/**
 * Content script function to validate overlay positioning and styling
 * Tests that overlays are correctly positioned and styled relative to target elements
 *
 * @param selectors - Array of selectors to test overlay positioning for
 * @returns Validation results for overlay positioning
 */
export const validateOverlayPositioningFunction = (
  elementOrSelectors: unknown,
  options?: unknown
): Array<{
  selector: string;
  elementFound: boolean;
  overlayCreated: boolean;
  positionCorrect?: boolean;
  styleCorrect?: boolean;
  overlayInfo?: {
    left: string;
    top: string;
    width: string;
    height: string;
    backgroundColor: string;
    zIndex: string;
  };
}> => {
  const selectors: string[] = Array.isArray(elementOrSelectors)
    ? (elementOrSelectors as string[])
    : Array.isArray(options)
      ? (options as string[])
      : typeof elementOrSelectors === 'string'
        ? [elementOrSelectors]
        : [];
  console.log(
    `[validateOverlayPositioningFunction] validating for ${selectors.length} selectors ######`
  );
  const results = selectors.map(selector => {
    let element: Element | null;

    try {
      if (selector.startsWith('xpath=')) {
        const xpath = selector.substring(6);
        console.log(`[validateOverlayPositioningFunction] evaluating xpath="${xpath}" ######`);
        element = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue as Element | null;
      } else {
        console.log(`[validateOverlayPositioningFunction] querying selector="${selector}" ######`);
        element = document.querySelector(selector);
      }

      if (!element || !(element instanceof HTMLElement)) {
        console.log(
          `[validateOverlayPositioningFunction] element not found for selector="${selector}" ######`
        );
        return {
          selector,
          elementFound: false,
          overlayCreated: false,
        };
      }

      // Create a test overlay
      console.log(
        `[validateOverlayPositioningFunction] creating test overlay for selector="${selector}" ######`
      );
      const overlay = document.createElement('div');
      overlay.setAttribute('stagehandObserveTest', 'true');
      const rect = element.getBoundingClientRect();
      overlay.style.position = 'absolute';
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '10000';
      document.body.appendChild(overlay);

      const overlayRect = overlay.getBoundingClientRect();
      const positionCorrect =
        Math.abs(overlayRect.left - rect.left) < 1 &&
        Math.abs(overlayRect.top - rect.top) < 1 &&
        Math.abs(overlayRect.width - rect.width) < 1 &&
        Math.abs(overlayRect.height - rect.height) < 1;

      const computedStyle = window.getComputedStyle(overlay);
      const styleCorrect =
        computedStyle.backgroundColor === 'rgba(255, 255, 0, 0.3)' &&
        computedStyle.position === 'absolute' &&
        computedStyle.pointerEvents === 'none' &&
        computedStyle.zIndex === '10000';

      const result = {
        selector,
        elementFound: true,
        overlayCreated: true,
        positionCorrect,
        styleCorrect,
        overlayInfo: {
          left: overlay.style.left,
          top: overlay.style.top,
          width: overlay.style.width,
          height: overlay.style.height,
          backgroundColor: overlay.style.backgroundColor,
          zIndex: overlay.style.zIndex,
        },
      };

      // Clean up test overlay
      overlay.remove();
      console.log(
        `[validateOverlayPositioningFunction] validation result for selector="${selector}": ${JSON.stringify(result)} ######`
      );
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[validateOverlayPositioningFunction] error processing selector="${selector}": ${errorMsg} ######`
      );
      return {
        selector,
        elementFound: false,
        overlayCreated: false,
      };
    }
  });

  return results;
};

// =============================================================================
// EXPORT ALL CONTENT SCRIPT FUNCTIONS
// =============================================================================

export {
  // Main overlay functions
  drawObserveOverlayFunction as observeDrawOverlayFunction,
  clearObserveOverlaysFunction as observeClearOverlaysFunction,

  // Testing and validation functions
  countObservableElementsFunction as observeCountElementsFunction,
  getObservedElementInfoFunction as observeGetElementInfoFunction,
  testXPathEvaluationFunction as observeTestXPathFunction,
  validateOverlayPositioningFunction as observeValidateOverlayFunction,
};
