/**
 * Stagehand DOM Utilities for Chrome Extension Content Script
 *
 * This script adapts Stagehand's DOM utility functions for use in a Chrome extension
 * content script environment. It provides the same functionality as the original
 * Stagehand DOM utilities but adapted for Chrome extension constraints.
 *
 * Key differences from Playwright environment:
 * - No dynamic eval() or new Function() due to CSP restrictions
 * - Direct function execution instead of string-based injection
 * - Integration with existing Cordyceps HandledInjectedScript system
 * - Chrome extension messaging for advanced features
 */

// ============================================================================
// Type Definitions and Constants
// ============================================================================

/**
 * @typedef {Object} XPathGenerationResult
 * @property {string[]} xpaths - Array of generated XPaths
 */

/**
 * @typedef {Object} ScrollableElementInfo
 * @property {HTMLElement} element - The scrollable element
 * @property {string} xpath - Primary XPath for the element
 */

// ============================================================================
// Element Check Utilities
// ============================================================================

function isElementNode(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isTextNode(node) {
  return node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim());
}

// ============================================================================
// XPath Generation Utilities
// ============================================================================

function getParentElement(node) {
  return isElementNode(node) ? node.parentElement : node.parentNode;
}

/**
 * Generates all possible combinations of a given array of attributes.
 * @param {Array<{attr: string, value: string}>} attributes - Array of attributes
 * @param {number} size - The size of each combination
 * @returns {Array<Array<{attr: string, value: string}>>} Array of attribute combinations
 */
function getCombinations(attributes, size) {
  const results = [];

  function helper(start, combo) {
    if (combo.length === size) {
      results.push([...combo]);
      return;
    }

    for (let i = start; i < attributes.length; i++) {
      combo.push(attributes[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  helper(0, []);
  return results;
}

/**
 * Checks if the generated XPath uniquely identifies the target element.
 * @param {string} xpath - The XPath string to test
 * @param {Element} target - The target DOM element
 * @returns {boolean} True if unique, else false
 */
function isXPathFirstResultElement(xpath, target) {
  try {
    const result = document.evaluate(
      xpath,
      document.documentElement,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    return result.snapshotItem(0) === target;
  } catch (error) {
    console.warn(`Invalid XPath expression: ${xpath}`, error);
    return false;
  }
}

/**
 * Escapes a string for use in an XPath expression.
 * Handles special characters, including single and double quotes.
 * @param {string} value - The string to escape
 * @returns {string} The escaped string safe for XPath
 */
function escapeXPathString(value) {
  if (value.includes("'")) {
    if (value.includes('"')) {
      // Contains both single and double quotes, use concat
      const parts = value.split("'");
      return `concat('${parts.join("', \"'\", '")}')`;
    } else {
      // Contains single quotes only, use double quotes
      return `"${value}"`;
    }
  } else {
    // Contains no single quotes, use single quotes
    return `'${value}'`;
  }
}

/**
 * Generates multiple XPath expressions for a given DOM element.
 * @param {Node} element - The target DOM element
 * @returns {Promise<string[]>} Promise resolving to array of XPaths
 */
async function generateXPathsForElement(element) {
  if (!element) return [];

  const [complexXPath, standardXPath, idBasedXPath] = await Promise.all([
    generateComplexXPath(element),
    generateStandardXPath(element),
    generateIdBasedXPath(element),
  ]);

  // Return in order from most accurate on current page to most cacheable
  return [standardXPath, ...(idBasedXPath ? [idBasedXPath] : []), complexXPath];
}

/**
 * Generates a complex XPath with attribute-based selectors.
 * @param {Node} element - The target DOM element
 * @returns {Promise<string>} Promise resolving to complex XPath
 */
async function generateComplexXPath(element) {
  const parts = [];
  let currentElement = element;

  while (currentElement && (isTextNode(currentElement) || isElementNode(currentElement))) {
    if (isElementNode(currentElement)) {
      const el = currentElement;
      let selector = el.tagName.toLowerCase();

      // List of attributes to consider for uniqueness
      const attributePriority = [
        'data-qa',
        'data-component',
        'data-role',
        'role',
        'aria-role',
        'type',
        'name',
        'aria-label',
        'placeholder',
        'title',
        'alt',
      ];

      // Collect attributes present on the element
      const attributes = attributePriority
        .map(attr => {
          let value = el.getAttribute(attr);
          if (attr === 'href-full' && value) {
            value = el.getAttribute('href');
          }
          return value ? { attr: attr === 'href-full' ? 'href' : attr, value } : null;
        })
        .filter(attr => attr !== null);

      // Attempt to find a combination of attributes that uniquely identifies the element
      let uniqueSelector = '';
      for (let i = 1; i <= attributes.length; i++) {
        const combinations = getCombinations(attributes, i);
        for (const combo of combinations) {
          const conditions = combo
            .map(a => `@${a.attr}=${escapeXPathString(a.value)}`)
            .join(' and ');
          const xpath = `//${selector}[${conditions}]`;
          if (isXPathFirstResultElement(xpath, el)) {
            uniqueSelector = xpath;
            break;
          }
        }
        if (uniqueSelector) break;
      }

      if (uniqueSelector) {
        parts.unshift(uniqueSelector.replace('//', ''));
        break;
      } else {
        // Fallback to positional selector
        const parent = getParentElement(el);
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            sibling => sibling.tagName === el.tagName
          );
          const index = siblings.indexOf(el) + 1;
          selector += siblings.length > 1 ? `[${index}]` : '';
        }
        parts.unshift(selector);
      }
    }

    currentElement = getParentElement(currentElement);
  }

  const xpath = '//' + parts.join('/');
  return xpath;
}

/**
 * Generates a standard positional XPath for a given DOM element.
 * @param {Node} element - The target DOM element
 * @returns {Promise<string>} Promise resolving to standard XPath
 */
async function generateStandardXPath(element) {
  const parts = [];

  while (element && (isTextNode(element) || isElementNode(element))) {
    let index = 0;
    let hasSameTypeSiblings = false;
    const siblings = element.parentElement ? Array.from(element.parentElement.childNodes) : [];

    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling.nodeType === element.nodeType && sibling.nodeName === element.nodeName) {
        index = index + 1;
        hasSameTypeSiblings = true;
        if (sibling.isSameNode(element)) {
          break;
        }
      }
    }

    // Text nodes are selected differently than elements with XPaths
    if (element.nodeName !== '#text') {
      const tagName = element.nodeName.toLowerCase();
      const pathIndex = hasSameTypeSiblings ? `[${index}]` : '';
      parts.unshift(`${tagName}${pathIndex}`);
    }

    element = element.parentElement;
  }

  return parts.length ? `/${parts.join('/')}` : '';
}

/**
 * Generates an ID-based XPath if the element has an ID.
 * @param {Node} element - The target DOM element
 * @returns {Promise<string|null>} Promise resolving to ID-based XPath or null
 */
async function generateIdBasedXPath(element) {
  if (isElementNode(element) && element.id) {
    return `//*[@id='${element.id}']`;
  }
  return null;
}

// ============================================================================
// DOM Interaction Utilities
// ============================================================================

/**
 * Tests if the element actually responds to .scrollTo(...) and that scrollTop changes as expected.
 * @param {HTMLElement} elem - The element to test
 * @returns {boolean} True if element can scroll, false otherwise
 */
function canElementScroll(elem) {
  // Quick check if scrollTo is a function
  if (typeof elem.scrollTo !== 'function') {
    console.warn('canElementScroll: .scrollTo is not a function.');
    return false;
  }

  try {
    const originalTop = elem.scrollTop;

    // Try to scroll
    elem.scrollTo({
      top: originalTop + 100,
      left: 0,
      behavior: 'instant',
    });

    // If scrollTop never changed, consider it unscrollable
    if (elem.scrollTop === originalTop) {
      return false;
    }

    // Scroll back to original place
    elem.scrollTo({
      top: originalTop,
      left: 0,
      behavior: 'instant',
    });

    return true;
  } catch (error) {
    console.warn('canElementScroll error:', error.message || error);
    return false;
  }
}

/**
 * Gets a DOM node from an XPath expression.
 * @param {string} xpath - The XPath expression
 * @returns {Node|null} The DOM node or null if not found
 */
function getNodeFromXpath(xpath) {
  return document.evaluate(
    xpath,
    document.documentElement,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
}

/**
 * Waits for an element to stop scrolling.
 * @param {HTMLElement} element - The element to monitor
 * @param {number} idleMs - Milliseconds to wait for idle state
 * @returns {Promise<void>} Promise that resolves when scrolling stops
 */
function waitForElementScrollEnd(element, idleMs = 100) {
  return new Promise(resolve => {
    let scrollEndTimer;

    const handleScroll = () => {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        element.removeEventListener('scroll', handleScroll);
        resolve();
      }, idleMs);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  });
}

// ============================================================================
// Scrollable Element Detection
// ============================================================================

/**
 * Finds and returns a list of scrollable elements on the page,
 * ordered from the element with the largest scrollHeight to the smallest.
 * @param {number} [topN] - Optional maximum number of scrollable elements to return
 * @returns {HTMLElement[]} Array of HTMLElements sorted by descending scrollHeight
 */
function getScrollableElements(topN) {
  // Get the root <html> element
  const docEl = document.documentElement;

  // Initialize an array to hold all scrollable elements
  // Always include the root <html> element as a fallback
  const scrollableElements = [docEl];

  // Scan all elements to find potential scrollable containers
  const allElements = document.querySelectorAll('*');
  for (const elem of allElements) {
    const style = window.getComputedStyle(elem);
    const overflowY = style.overflowY;

    const isPotentiallyScrollable =
      overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';

    if (isPotentiallyScrollable) {
      const candidateScrollDiff = elem.scrollHeight - elem.clientHeight;
      // Only consider this element if it actually has extra scrollable content
      // and it can truly scroll
      if (candidateScrollDiff > 0 && canElementScroll(elem)) {
        scrollableElements.push(elem);
      }
    }
  }

  // Sort the scrollable elements from largest scrollHeight to smallest
  scrollableElements.sort((a, b) => b.scrollHeight - a.scrollHeight);

  // If a topN limit is specified, return only the first topN elements
  if (topN !== undefined) {
    return scrollableElements.slice(0, topN);
  }

  // Return all found scrollable elements if no limit is provided
  return scrollableElements;
}

/**
 * Gets XPath expressions for scrollable elements.
 * @param {number} [topN] - Optional limit on how many scrollable elements to process
 * @returns {Promise<string[]>} Promise resolving to array of XPaths
 */
async function getScrollableElementXpaths(topN) {
  const scrollableElems = getScrollableElements(topN);
  const xpaths = [];

  for (const elem of scrollableElems) {
    const allXPaths = await generateXPathsForElement(elem);
    const firstXPath = allXPaths?.[0] || '';
    xpaths.push(firstXPath);
  }

  return xpaths;
}

// ============================================================================
// Shadow DOM Support
// ============================================================================

/**
 * Enhanced shadow DOM support for Chrome extension environment.
 * This provides a backdoor to access closed shadow roots and query within them.
 */
(function setupShadowDOMSupport() {
  const closedRoots = new WeakMap();
  const nativeAttachShadow = Element.prototype.attachShadow;

  Element.prototype.attachShadow = function (init) {
    const root = nativeAttachShadow.call(this, init);
    if (init.mode === 'closed') {
      closedRoots.set(this, root);
    }
    return root;
  };

  const backdoor = {
    getClosedRoot: host => closedRoots.get(host),
    queryClosed: (host, selector) => {
      const root = closedRoots.get(host);
      return root ? root.querySelector(selector) : null;
    },
    xpathClosed: (host, xpath) => {
      const root = closedRoots.get(host);
      if (!root) return null;

      const result = document.evaluate(
        xpath,
        root,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    },
  };

  // Expose backdoor globally for Chrome extension environment
  if (!('__stagehand__' in window)) {
    Object.defineProperty(window, '__stagehand__', {
      value: backdoor,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
})();

// ============================================================================
// Global API Exposure
// ============================================================================

/**
 * Expose Stagehand utilities to the global window object for use by
 * the Chrome extension's content script and side panel communication.
 */
window.getScrollableElementXpaths = getScrollableElementXpaths;
window.getNodeFromXpath = getNodeFromXpath;
window.waitForElementScrollEnd = waitForElementScrollEnd;
window.generateXPathsForElement = generateXPathsForElement;
window.getScrollableElements = getScrollableElements;
window.canElementScroll = canElementScroll;

// Mark that Stagehand utilities are injected
window.__stagehandInjected = true;

console.log('🎭 Stagehand DOM utilities loaded in Chrome extension content script');
