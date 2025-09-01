/**
 * Stagehand to Cordyceps Adapter
 *
 * This adapter provides a bridge between Stagehand's DOM utilities and the
 * Cordyceps HandleManager system in our Chrome extension environment.
 *
 * It maintains API compatibility with Stagehand while leveraging our existing
 * Cordyceps infrastructure for element management and interaction.
 */

import { HandleManager } from '@shared/utils/handleManager';

/**
 * Configuration options for the Stagehand adapter
 */
export interface StagehandAdapterConfig {
  maxScrollableElements?: number;
  scrollIdleTimeout?: number;
  shadowDOMSupport?: boolean;
  debug?: boolean;
}

/**
 * Result from XPath generation operations
 */
export interface XPathGenerationResult {
  element: Element;
  xpaths: string[];
  primaryXPath: string;
  handle?: string; // Cordyceps handle if available
}

/**
 * Information about a scrollable element
 */
export interface ScrollableElementInfo {
  element: HTMLElement;
  xpath: string;
  scrollHeight: number;
  clientHeight: number;
  handle?: string; // Cordyceps handle if available
}

/**
 * Stagehand to Cordyceps adapter class
 */
export class StagehandCordycepsAdapter {
  private handleManager: HandleManager;
  private config: Required<StagehandAdapterConfig>;
  private isInitialized: boolean = false;

  constructor(handleManager: HandleManager, config: StagehandAdapterConfig = {}) {
    this.handleManager = handleManager;
    this.config = {
      maxScrollableElements: config.maxScrollableElements ?? 10,
      scrollIdleTimeout: config.scrollIdleTimeout ?? 100,
      shadowDOMSupport: config.shadowDOMSupport ?? true,
      debug: config.debug ?? false,
    };
  }

  /**
   * Initialize the adapter and verify Stagehand utilities are available
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    // Check if Stagehand utilities are available
    const stagehandAvailable =
      window.__stagehandInjected &&
      typeof window.getScrollableElementXpaths === 'function' &&
      typeof window.generateXPathsForElement === 'function';

    if (!stagehandAvailable) {
      console.error('StagehandCordycepsAdapter: Stagehand utilities not available');
      return false;
    }

    if (this.config.debug) {
      console.log('🎭 StagehandCordycepsAdapter initialized with config:', this.config);
    }

    this.isInitialized = true;
    return true;
  }

  /**
   * Generate XPaths for an element using Stagehand utilities
   */
  async generateXPathsForElement(element: Element): Promise<XPathGenerationResult> {
    await this.ensureInitialized();

    if (!window.generateXPathsForElement) {
      throw new Error('Stagehand XPath generation not available');
    }

    const xpaths = await window.generateXPathsForElement(element);
    const primaryXPath = xpaths[0] || '';

    // Try to get or create a Cordyceps handle for this element
    let handle: string | undefined;
    try {
      handle = this.handleManager.getHandleForElement(element);
    } catch (error) {
      if (this.config.debug) {
        console.warn('Could not get Cordyceps handle for element:', error);
      }
    }

    return {
      element,
      xpaths,
      primaryXPath,
      handle,
    };
  }

  /**
   * Get scrollable elements with XPath information
   */
  async getScrollableElements(topN?: number): Promise<ScrollableElementInfo[]> {
    await this.ensureInitialized();

    if (!window.getScrollableElements || !window.generateXPathsForElement) {
      throw new Error('Stagehand scrollable element utilities not available');
    }

    const maxElements = topN ?? this.config.maxScrollableElements;
    const scrollableElements = window.getScrollableElements(maxElements);
    const results: ScrollableElementInfo[] = [];

    for (const element of scrollableElements) {
      try {
        const xpaths = await window.generateXPathsForElement(element);
        const xpath = xpaths[0] || '';

        // Try to get Cordyceps handle
        let handle: string | undefined;
        try {
          handle = this.handleManager.getHandleForElement(element);
        } catch (error) {
          // Handle creation might fail for some elements, that's OK
        }

        results.push({
          element,
          xpath,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          handle,
        });
      } catch (error) {
        if (this.config.debug) {
          console.warn('Failed to process scrollable element:', error);
        }
      }
    }

    return results;
  }

  /**
   * Get XPaths for scrollable elements (Stagehand-compatible API)
   */
  async getScrollableElementXpaths(topN?: number): Promise<string[]> {
    await this.ensureInitialized();

    if (!window.getScrollableElementXpaths) {
      throw new Error('Stagehand scrollable XPath utility not available');
    }

    const maxElements = topN ?? this.config.maxScrollableElements;
    return await window.getScrollableElementXpaths(maxElements);
  }

  /**
   * Get DOM node from XPath using Stagehand utilities
   */
  getNodeFromXPath(xpath: string): Node | null {
    if (!this.isInitialized || !window.getNodeFromXpath) {
      throw new Error('Stagehand adapter not initialized or XPath utility not available');
    }

    return window.getNodeFromXpath(xpath);
  }

  /**
   * Wait for element scroll to end
   */
  async waitForElementScrollEnd(element: HTMLElement, idleMs?: number): Promise<void> {
    await this.ensureInitialized();

    if (!window.waitForElementScrollEnd) {
      throw new Error('Stagehand scroll utility not available');
    }

    const timeout = idleMs ?? this.config.scrollIdleTimeout;
    return await window.waitForElementScrollEnd(element, timeout);
  }

  /**
   * Test if an element can scroll using Stagehand utilities
   */
  canElementScroll(element: HTMLElement): boolean {
    if (!this.isInitialized || !window.canElementScroll) {
      throw new Error('Stagehand adapter not initialized or scroll test utility not available');
    }

    return window.canElementScroll(element);
  }

  /**
   * Access shadow DOM backdoor (if available and enabled)
   */
  getShadowDOMBackdoor() {
    if (!this.config.shadowDOMSupport || !window.__stagehand__) {
      return null;
    }

    return window.__stagehand__;
  }

  /**
   * Get element from XPath and create Cordyceps handle
   */
  async getElementByXPathWithHandle(
    xpath: string
  ): Promise<{ element: Element; handle: string } | null> {
    await this.ensureInitialized();

    const element = this.getNodeFromXPath(xpath);
    if (!element || !(element instanceof Element)) {
      return null;
    }

    try {
      const handle = this.handleManager.getHandleForElement(element);
      return { element, handle };
    } catch (error) {
      if (this.config.debug) {
        console.warn('Failed to create Cordyceps handle for XPath element:', error);
      }
      return null;
    }
  }

  /**
   * Enhanced element interaction using both Stagehand XPath and Cordyceps handles
   */
  async interactWithElementByXPath(
    xpath: string,
    action: 'click' | 'fill' | 'type' | 'scroll',
    options: Record<string, unknown> = {}
  ): Promise<{ success: boolean; error?: string; handle?: string }> {
    await this.ensureInitialized();

    const elementInfo = await this.getElementByXPathWithHandle(xpath);
    if (!elementInfo) {
      return { success: false, error: 'Element not found for XPath' };
    }

    const { element, handle } = elementInfo;

    try {
      switch (action) {
        case 'click': {
          if (element instanceof HTMLElement) {
            element.click();
            return { success: true, handle };
          } else {
            return { success: false, error: 'Element is not an HTMLElement', handle };
          }
        }

        case 'fill':
        case 'type': {
          if (typeof options.text !== 'string') {
            return { success: false, error: 'Text option required for fill/type actions' };
          }

          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.value = options.text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, handle };
          } else {
            return { success: false, error: 'Element is not a text input element', handle };
          }
        }

        case 'scroll': {
          if (element instanceof HTMLElement && this.canElementScroll(element)) {
            await this.waitForElementScrollEnd(element);
            return { success: true, handle };
          } else {
            return { success: false, error: 'Element is not scrollable', handle };
          }
        }

        default:
          return { success: false, error: `Unsupported action: ${action}`, handle };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        handle,
      };
    }
  }

  /**
   * Batch generate XPaths for multiple elements
   */
  async generateXPathsForElements(elements: Element[]): Promise<XPathGenerationResult[]> {
    await this.ensureInitialized();

    const results: XPathGenerationResult[] = [];

    for (const element of elements) {
      try {
        const result = await this.generateXPathsForElement(element);
        results.push(result);
      } catch (error) {
        if (this.config.debug) {
          console.warn('Failed to generate XPaths for element:', error);
        }
      }
    }

    return results;
  }

  /**
   * Get adapter status and diagnostics
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      stagehandAvailable: !!window.__stagehandInjected,
      utilitiesAvailable: {
        getScrollableElementXpaths: typeof window.getScrollableElementXpaths,
        generateXPathsForElement: typeof window.generateXPathsForElement,
        getNodeFromXpath: typeof window.getNodeFromXpath,
        waitForElementScrollEnd: typeof window.waitForElementScrollEnd,
        canElementScroll: typeof window.canElementScroll,
        shadowDOMBackdoor: typeof window.__stagehand__,
      },
      config: this.config,
      cordycepsHandlesCount: this.handleManager.cacheSize,
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize StagehandCordycepsAdapter');
      }
    }
  }
}

/**
 * Create a Stagehand adapter instance for the current page
 */
export function createStagehandAdapter(
  handleManager?: HandleManager,
  config?: StagehandAdapterConfig
): StagehandCordycepsAdapter {
  const manager = handleManager || new HandleManager();

  return new StagehandCordycepsAdapter(manager, config);
}

// Export types for external use
