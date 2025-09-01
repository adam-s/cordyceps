/**
 * Chrome Extension implementation of browser-use DOM service
 *
 * This service integrates with our custom Chrome extension architecture using
 * FrameExecutionContext to evaluate code in content scripts. The browserUse.js
 * module is loaded in the content script's ISOLATED world and exposes the
 * window.__cordyceps_buildDomTree function for DOM tree building.
 */

import { DOMElementNode, DOMTextNode, SelectorMap, ViewportInfo } from './views';
import { Page } from '@src/services/cordyceps/page';

// Extend the global Window interface to include our custom properties
declare global {
  interface Window {
    __cordyceps_buildDomTree?: (args: BuildDomTreeArgs) => BuildDomTreeResult;
    _highlightCleanupFunctions?: (() => void)[];
  }
}

/**
 * Result from the window.__cordyceps_buildDomTree function
 */
interface BuildDomTreeResult {
  rootId: string;
  map: Record<string, unknown>;
}

/**
 * Arguments for the buildDomTree function
 */
interface BuildDomTreeArgs {
  doHighlightElements: boolean;
  focusHighlightIndex: number;
  viewportExpansion: number;
  debugMode: boolean;
}

/**
 * Service for DOM operations using Chrome extension content script evaluation
 */
export class DOMService {
  private readonly _page: Page;

  constructor(page: Page) {
    this._page = page;
  }

  /**
   * Get clickable elements from the page
   * Matches the Python implementation's approach to element identification
   * @param highlightElements Whether to highlight elements
   * @param focusElement Index of element to focus on (-1 for all)
   * @param viewportExpansion How much to expand the viewport (pixels beyond viewport, -1 for no limit)
   */
  async getClickableElements(
    highlightElements: boolean = true,
    focusElement: number = -1,
    viewportExpansion: number = 500 // Default matches Python implementation
  ): Promise<{
    elementTree: DOMElementNode;
    rootElement: DOMElementNode;
    selectorMap: SelectorMap;
    viewportInfo?: ViewportInfo;
  }> {
    const [rootElement, selectorMap] = await this.buildDomTree(
      highlightElements,
      focusElement,
      viewportExpansion
    );

    // In the Python implementation, elementTree is the same as rootElement
    // This is a key difference that was causing token count issues
    const elementTree = rootElement;

    // Get viewport information from the page
    const viewportInfo = await this.getViewportInfo();
    return {
      elementTree,
      rootElement,
      selectorMap,
      viewportInfo,
    };
  }

  /**
   * Clear DOM tree highlights
   */
  async clearDomTree(): Promise<void> {
    try {
      await this._page.evaluate(() => {
        // Remove highlight container if it exists
        const container = document.getElementById('playwright-highlight-container');
        if (container) {
          container.remove();
        }

        // Clean up any highlight cleanup functions
        if (window._highlightCleanupFunctions && window._highlightCleanupFunctions.length) {
          window._highlightCleanupFunctions.forEach((fn: () => void) => fn());
          window._highlightCleanupFunctions = [];
        }
      });
    } catch (error) {
      console.error('Error clearing DOM tree highlights:', error);
    }
  }

  /**
   * Get viewport information from the page using Chrome extension evaluation
   * This is important for matching Python implementation's viewport handling
   */
  private async getViewportInfo(): Promise<ViewportInfo> {
    try {
      // Get viewport information directly from the page using our Page.evaluate method
      const pageData = await this._page.evaluate(() => {
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          devicePixelRatio: window.devicePixelRatio || 1,
          documentHeight: document.documentElement.scrollHeight,
          documentWidth: document.documentElement.scrollWidth,
        };
      });

      // Create a ViewportInfo instance with data from the page
      return new ViewportInfo(
        pageData.width,
        pageData.height,
        pageData.scrollX,
        pageData.scrollY,
        pageData.devicePixelRatio,
        pageData.documentHeight,
        pageData.documentWidth
      );
    } catch (error) {
      console.error('Error getting viewport info:', error);
      // Return default viewport info instance if there was an error
      return new ViewportInfo(
        1024, // default width
        768, // default height
        0, // default scrollX
        0, // default scrollY
        1, // default devicePixelRatio
        1024, // default documentHeight
        768 // default documentWidth
      );
    }
  }

  // Note: The generateElementTreeString method has been removed as it's no longer needed
  // We now use the clickableElementsToString method from the DOMElementNode class instead
  // This is more aligned with the Python implementation

  /**
   * Build a DOM tree from the page using Chrome extension content script evaluation
   * @param highlightElements Whether to highlight elements
   * @param focusElement Index of element to focus on (-1 for all)
   * @param viewportExpansion How much to expand the viewport
   */
  private async buildDomTree(
    highlightElements: boolean,
    focusElement: number,
    viewportExpansion: number
  ): Promise<[DOMElementNode, SelectorMap]> {
    // Verify that JavaScript evaluation works in our Chrome extension context
    if ((await this._page.evaluate(() => 1 + 1)) !== 2) {
      throw new Error('The page cannot evaluate JavaScript code properly');
    }

    // Ensure viewportExpansion matches Python implementation conventions
    // -1 means include all elements regardless of viewport position (no limit)
    // Positive values indicate pixels beyond viewport boundaries to include
    // Using the same convention as Python for consistency
    const viewportExpansionValue = viewportExpansion === undefined ? 500 : viewportExpansion;

    const args: BuildDomTreeArgs = {
      doHighlightElements: highlightElements,
      focusHighlightIndex: focusElement,
      viewportExpansion: viewportExpansionValue,
      debugMode: process.env && process.env['NODE_ENV'] === 'development',
    };
    const domTreeResult = await this._page.evaluate((buildArgs: BuildDomTreeArgs) => {
      if (typeof window.__cordyceps_buildDomTree !== 'function') {
        throw new Error(
          'window.__cordyceps_buildDomTree not found; ensure browserUse.js is loaded in content script.'
        );
      }
      return window.__cordyceps_buildDomTree(buildArgs);
    }, args);

    if (!domTreeResult || !domTreeResult.rootId || !domTreeResult.map) {
      throw new Error('Invalid DOM tree result from content script');
    }

    // Construct our TypeScript DOM tree from the JavaScript result
    const result = this.constructDomTree(domTreeResult as BuildDomTreeResult);
    return result;
  }

  /**
   * Construct TypeScript DOM tree from JavaScript evaluation result
   * @param domTreeResult Result from window.__cordyceps_buildDomTree function
   */
  private async constructDomTree(
    domTreeResult: BuildDomTreeResult
  ): Promise<[DOMElementNode, SelectorMap]> {
    const { rootId, map } = domTreeResult;

    // Build a mapping of node IDs to our TypeScript DOM nodes
    const nodeMap: Record<string, DOMElementNode | DOMTextNode> = {};
    const selectorMap: SelectorMap = {};

    // First pass: create all nodes
    for (const [nodeId, nodeData] of Object.entries(map)) {
      const [node, childrenIds] = this.parseNode(nodeData);
      if (node) {
        nodeMap[nodeId] = node;

        // Build selector map for elements with highlight indices
        if (node instanceof DOMElementNode && node.highlightIndex !== undefined) {
          selectorMap[node.highlightIndex.toString()] = node;
        }

        // Store children IDs for second pass
        if (node instanceof DOMElementNode) {
          (node as unknown as { _childrenIds: string[] })._childrenIds = childrenIds;
        }
      }
    }

    // Second pass: link children
    for (const node of Object.values(nodeMap)) {
      if (node instanceof DOMElementNode) {
        const childrenIds = (node as unknown as { _childrenIds?: string[] })._childrenIds || [];
        for (const childId of childrenIds) {
          const childNode = nodeMap[childId];
          if (childNode) {
            node.children.push(childNode);
          }
        }
        // Clean up temporary property
        delete (node as unknown as { _childrenIds?: string[] })._childrenIds;
      }
    }

    const rootElement = nodeMap[rootId] as DOMElementNode;

    if (!rootElement) {
      throw new Error(`Root element with ID ${rootId} not found in parsed nodes`);
    }

    if (!(rootElement instanceof DOMElementNode)) {
      throw new Error(`Root element is not a DOMElementNode: ${typeof rootElement}`);
    }

    return [rootElement, selectorMap];
  }

  /**
   * Parse a node data object from the JavaScript result into our TypeScript DOM node
   * @param nodeData The node data from the JavaScript buildDomTree result
   */
  private parseNode(nodeData: unknown): [DOMElementNode | DOMTextNode | null, string[]] {
    if (!nodeData || typeof nodeData !== 'object') {
      return [null, []];
    }

    const data = nodeData as Record<string, unknown>;

    // Handle text nodes
    if (data.nodeType === 3 && typeof data.textContent === 'string') {
      const textNode = new DOMTextNode(data.textContent);
      return [textNode, []];
    }

    // Handle element nodes
    if (data.tagName && typeof data.tagName === 'string') {
      const tagName = data.tagName.toLowerCase();
      const attributes = (data.attributes as Record<string, string>) || {};
      const children: (DOMElementNode | DOMTextNode)[] = []; // Will be populated in second pass
      const childrenIds = (data.children as string[]) || [];

      // Create element node with the data structure from browserUse.js
      const elementNode = new DOMElementNode(
        tagName,
        (data.xpath as string) || '',
        attributes,
        children,
        (data.isVisible as boolean) || false,
        (data.isInteractive as boolean) || false,
        (data.isTopElement as boolean) || false,
        (data.isInViewport as boolean) || false,
        (data.shadowRoot as boolean) || false,
        data.highlightIndex as number | undefined,
        null, // parent will be set later
        undefined, // viewportInfo
        null, // pageCoordinates
        null // viewportCoordinates
      );

      return [elementNode, childrenIds];
    }

    return [null, []];
  }
}
