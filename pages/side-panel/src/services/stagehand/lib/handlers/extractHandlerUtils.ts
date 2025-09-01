/**
 * Content Script Functions for ExtractHandler Redux
 *
 * This file contains all functions that execute in the browser content script context
 * for data extraction operations. These functions are extracted from the original
 * Playwright-based implementation and adapted for Chrome extension CSP compliance.
 */

// =============================================================================
// IFRAME & FRAME XPATH FUNCTIONS
// =============================================================================

/**
 * Generate absolute XPath for iframe elements within page context
 * Extracted from a11y/utils.ts getIframeXpath function
 */
export const getIframeXpathFunction = (node: Element): string => {
  function stepFor(el: Element): string {
    const tag = el.tagName.toLowerCase();
    let i = 1;
    for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName.toLowerCase() === tag) i++;
    }
    return `${tag}[${i}]`;
  }

  const segs: string[] = [];
  let el: Element | null = node;

  while (el) {
    segs.unshift(stepFor(el));
    if (el.parentElement) {
      el = el.parentElement;
      continue;
    }

    // Handle shadow DOM boundary
    if (el.parentNode && (el.parentNode as ShadowRoot).host) {
      el = (el.parentNode as ShadowRoot).host;
      continue;
    }

    break;
  }

  return `/${segs.join('/')}`;
};

/**
 * Generate root XPath for frame positioning
 * Extracted from a11y/utils.ts getFrameRootXpath function
 */
export const getFrameRootXpathFunction = (node: Element): string => {
  const pos = (el: Element) => {
    let i = 1;
    for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName === el.tagName) i += 1;
    }
    return i;
  };

  const segs: string[] = [];
  for (let el: Element | null = node; el; el = el.parentElement) {
    segs.unshift(`${el.tagName.toLowerCase()}[${pos(el)}]`);
  }

  return `/${segs.join('/')}`;
};

// =============================================================================
// SCROLLABLE ELEMENT DETECTION
// =============================================================================

/**
 * Find XPaths of scrollable elements on the page
 * Extracted from a11y/utils.ts findScrollableElementIds function
 */
export const getScrollableElementXpathsFunction = (): string[] => {
  // Check if the helper function is available (injected by StagehandPage)
  if (
    window.getScrollableElementXpathsExtract &&
    typeof window.getScrollableElementXpathsExtract === 'function'
  ) {
    // Call the synchronous version directly
    const result = window.getScrollableElementXpathsExtract();
    return Array.isArray(result) ? result : [];
  }

  // Fallback implementation for scrollable element detection
  const scrollableXpaths: string[] = [];
  const elements = document.querySelectorAll('*');

  elements.forEach(element => {
    const style = getComputedStyle(element);
    const isScrollable =
      style.overflow === 'scroll' ||
      style.overflow === 'auto' ||
      style.overflowX === 'scroll' ||
      style.overflowX === 'auto' ||
      style.overflowY === 'scroll' ||
      style.overflowY === 'auto';

    if (
      isScrollable &&
      (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)
    ) {
      // Generate simple XPath for the element
      const xpath = generateXPathForElement(element);
      if (xpath) {
        scrollableXpaths.push(xpath);
      }
    }
  });

  return scrollableXpaths;
};

/**
 * Helper function to generate XPath for an element
 */
function generateXPathForElement(element: Element): string | null {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  let xpath = '';
  let currentElement: Element | null = element;

  while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = currentElement.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === currentElement.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    const tagName = currentElement.tagName.toLowerCase();
    xpath = `/${tagName}[${index}]${xpath}`;
    currentElement = currentElement.parentElement;
  }

  return xpath ? xpath : null;
}

// =============================================================================
// XPATH RESOLUTION & DOM EVALUATION
// =============================================================================

/**
 * Resolve XPath to DOM element using document.evaluate
 * Extracted from a11y/utils.ts resolveObjectIdForXPath function
 */
export const resolveXPathToObjectIdFunction = (xpath: string): Element | null => {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  } catch (error) {
    console.warn(`Failed to evaluate XPath: ${xpath}`, error);
    return null;
  }
};

/**
 * Test XPath validity and return evaluation result
 * Enhanced version for testing XPath expressions
 */
export const testXPathEvaluationFunction = (
  xpath: string
): { success: boolean; elementCount: number } => {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    return {
      success: true,
      elementCount: result.snapshotLength,
    };
  } catch (error) {
    return {
      success: false,
      elementCount: 0,
    };
  }
};

// =============================================================================
// OVERLAY & VISUAL INDICATOR FUNCTIONS
// =============================================================================

/**
 * Remove visual overlays from the page
 * Extracted from StagehandPage.ts clearOverlays function
 */
export const clearOverlaysFunction = (): void => {
  try {
    const overlays = document.querySelectorAll('[data-stagehand-overlay]');
    overlays.forEach(overlay => overlay.remove());

    // Also remove any other extraction-related overlays
    const extractOverlays = document.querySelectorAll('[data-extract-overlay]');
    extractOverlays.forEach(overlay => overlay.remove());
  } catch (error) {
    console.warn('Failed to clear overlays:', error);
  }
};

/**
 * Draw extraction overlay on elements for visual feedback
 */
export const drawExtractionOverlayFunction = (selectors: string[]): number => {
  let overlayCount = 0;

  selectors.forEach((selector, index) => {
    try {
      let element: Element | null = null;

      // Handle XPath selectors
      if (selector.startsWith('xpath=')) {
        const xpath = selector.substring(6);
        element = resolveXPathToObjectIdFunction(xpath);
      } else {
        // Handle CSS selectors
        element = document.querySelector(selector);
      }

      if (element) {
        const rect = element.getBoundingClientRect();
        const overlay = document.createElement('div');

        overlay.setAttribute('data-extract-overlay', 'true');
        overlay.style.cssText = `
          position: fixed;
          top: ${rect.top + window.scrollY}px;
          left: ${rect.left + window.scrollX}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          border: 2px solid #00ff00;
          background-color: rgba(0, 255, 0, 0.1);
          pointer-events: none;
          z-index: 10000;
          box-sizing: border-box;
        `;

        // Add label
        const label = document.createElement('div');
        label.textContent = `Extract ${index + 1}`;
        label.style.cssText = `
          position: absolute;
          top: -20px;
          left: 0;
          background-color: #00ff00;
          color: black;
          padding: 2px 6px;
          font-size: 12px;
          font-family: monospace;
          border-radius: 3px;
        `;

        overlay.appendChild(label);
        document.body.appendChild(overlay);
        overlayCount++;
      }
    } catch (error) {
      console.warn(`Failed to create overlay for selector: ${selector}`, error);
    }
  });

  return overlayCount;
};

// =============================================================================
// STAGEHAND HELPER INJECTION & DETECTION
// =============================================================================

/**
 * Check if Stagehand helper scripts are already injected
 * Extracted from StagehandPage.ts ensureStagehandScript function
 */
export const checkStagehandInjectedFunction = (): boolean => {
  return !!window.__stagehandExtractInjected;
};

/**
 * Inject Stagehand helper functions into the page context
 * Extracted from StagehandPage.ts ensureStagehandScript function
 */
export const injectStagehandHelpersFunction = (): void => {
  if (window.__stagehandExtractInjected) {
    return;
  }

  window.__stagehandExtractInjected = true;

  // Basic helper functions for element interaction and extraction
  window.__stagehandExtractHelpers = {
    isElementVisible: (element: Element): boolean => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    },

    getElementText: (element: Element): string => {
      return element.textContent || (element as HTMLElement).innerText || '';
    },

    highlightElement: (element: Element, color = 'red'): void => {
      const originalOutline = (element as HTMLElement).style.outline;
      (element as HTMLElement).style.outline = `2px solid ${color}`;

      setTimeout(() => {
        (element as HTMLElement).style.outline = originalOutline;
      }, 2000);
    },

    getElementAttributes: (element: Element): Record<string, string> => {
      const attrs: Record<string, string> = {};
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attrs[attr.name] = attr.value;
      }
      return attrs;
    },

    isElementInteractive: (element: Element): boolean => {
      const tagName = element.tagName.toLowerCase();
      const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];

      if (interactiveTags.includes(tagName)) {
        return true;
      }

      const role = element.getAttribute('role');
      const interactiveRoles = ['button', 'link', 'menuitem', 'option', 'tab'];

      if (role && interactiveRoles.includes(role)) {
        return true;
      }

      return (
        element.hasAttribute('onclick') ||
        element.hasAttribute('onkeydown') ||
        (element as HTMLElement).tabIndex >= 0
      );
    },
  };

  // Enhanced scrollable element detection function
  window.getScrollableElementXpathsExtract = (): string[] => {
    return getScrollableElementXpathsFunction();
  };
};

// =============================================================================
// DATA EXTRACTION UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract structured data from elements based on selectors
 */
export const extractElementDataFunction = (
  selectors: string[]
): Array<{
  selector: string;
  found: boolean;
  data?: {
    tagName: string;
    id: string;
    className: string;
    textContent: string;
    attributes: Record<string, string>;
    boundingBox: DOMRect | null;
    visible: boolean;
  };
}> => {
  return selectors.map(selector => {
    try {
      let element: Element | null = null;

      // Handle XPath selectors
      if (selector.startsWith('xpath=')) {
        const xpath = selector.substring(6);
        element = resolveXPathToObjectIdFunction(xpath);
      } else {
        // Handle CSS selectors
        element = document.querySelector(selector);
      }

      if (!element) {
        return { selector, found: false };
      }

      const helpers = window.__stagehandExtractHelpers;
      const rect = element.getBoundingClientRect();

      return {
        selector,
        found: true,
        data: {
          tagName: element.tagName.toLowerCase(),
          id: element.id || '',
          className: element.className || '',
          textContent: helpers?.getElementText(element) || element.textContent || '',
          attributes: helpers?.getElementAttributes(element) || {},
          boundingBox: rect,
          visible: helpers?.isElementVisible(element) || false,
        },
      };
    } catch (error) {
      console.warn(`Failed to extract data for selector: ${selector}`, error);
      return { selector, found: false };
    }
  });
};

/**
 * Count elements matching extraction criteria
 */
export const countExtractableElementsFunction = (
  criteria?: string
): {
  totalElements: number;
  interactiveElements: number;
  visibleElements: number;
} => {
  const allElements = document.querySelectorAll(criteria || '*');
  const helpers = window.__stagehandExtractHelpers;

  let interactiveCount = 0;
  let visibleCount = 0;

  allElements.forEach(element => {
    if (helpers?.isElementInteractive(element)) {
      interactiveCount++;
    }
    if (helpers?.isElementVisible(element)) {
      visibleCount++;
    }
  });

  return {
    totalElements: allElements.length,
    interactiveElements: interactiveCount,
    visibleElements: visibleCount,
  };
};

// =============================================================================
// TYPE DECLARATIONS FOR WINDOW EXTENSIONS
// =============================================================================

declare global {
  interface Window {
    __stagehandExtractInjected?: boolean;
    __stagehandExtractHelpers?: {
      isElementVisible: (element: Element) => boolean;
      getElementText: (element: Element) => string;
      highlightElement: (element: Element, color?: string) => void;
      getElementAttributes: (element: Element) => Record<string, string>;
      isElementInteractive: (element: Element) => boolean;
    };
    getScrollableElementXpathsExtract?: () => string[];
  }
}
