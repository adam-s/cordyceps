/**
 * TypeScript implementation of browser-use browser views
 */

import { DOMState, DOMHistoryElement, DOMElementNode, SelectorMap } from '../dom/views';

/**
 * Represents information about a browser tab
 */
export interface TabInfo {
  pageId: number;
  url: string;
  title: string;
}

/**
 * Represents the state of the browser
 * This matches the original Python implementation
 */
export class BrowserState extends DOMState {
  url: string;
  title: string;
  tabs: TabInfo[];
  screenshot: string | undefined;
  pixelsAbove: number = 0;
  pixelsBelow: number = 0;
  browserErrors: string[] = [];
  // elementTree is inherited from DOMState

  constructor(
    url: string,
    title: string,
    tabs: TabInfo[],
    screenshot?: string,
    pixelsAbove: number = 0,
    pixelsBelow: number = 0,
    browserErrors: string[] = [],
    elementTree?: DOMElementNode,
    rootElement?: DOMElementNode,
    selectorMap?: SelectorMap
  ) {
    // Initialize with empty DOM elements if not provided
    super(rootElement || ({} as DOMElementNode), selectorMap || {});
    this.url = url;
    this.title = title;
    this.tabs = tabs;
    this.screenshot = screenshot;
    this.pixelsAbove = pixelsAbove;
    this.pixelsBelow = pixelsBelow;
    this.browserErrors = browserErrors;
    if (elementTree !== undefined) {
      this.elementTree = elementTree;
    }
  }
}

/**
 * Represents the history of browser states
 */
export class BrowserStateHistory {
  url: string;
  title: string;
  tabs: TabInfo[];
  interactedElement: (DOMHistoryElement | null)[];
  screenshot: string | undefined;

  constructor(
    url: string,
    title: string,
    tabs: TabInfo[],
    interactedElement: (DOMHistoryElement | null)[],
    screenshot?: string
  ) {
    this.url = url;
    this.title = title;
    this.tabs = tabs;
    this.interactedElement = interactedElement;
    this.screenshot = screenshot;
  }

  toDict(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    data['tabs'] = this.tabs;
    data['screenshot'] = this.screenshot;
    data['interactedElement'] = this.interactedElement.map(el => (el ? el.toDict() : null));
    data['url'] = this.url;
    data['title'] = this.title;
    return data;
  }
}

/**
 * Base class for all browser errors
 */
export class BrowserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserError';
  }
}

/**
 * Error raised when a URL is not allowed
 */
export class URLNotAllowedError extends BrowserError {
  constructor(message: string) {
    super(message);
    this.name = 'URLNotAllowedError';
  }
}
