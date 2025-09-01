/**
 * Stagehand CDP Fallbacks for Chrome Extension
 *
 * This module provides Chrome extension-compatible fallbacks for CDP-dependent
 * Stagehand functions that cannot be directly implemented due to extension security
 * constraints. It integrates with the Cordyceps handle system and provides the
 * same API surface as the original functions.
 */

import { HandleManager } from '@shared/utils/handleManager';

// Types to replace 'any' usage
interface AccessibilityNode {
  nodeId: string;
  backendNodeId?: number;
  role?: string;
  name?: string;
  value?: string;
  description?: string;
  keyshortcuts?: string;
  roledescription?: string;
  valuetext?: string;
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  modal?: boolean;
  multiline?: boolean;
  multiselectable?: boolean;
  readonly?: boolean;
  required?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  pressed?: boolean | 'mixed';
  level?: number;
  valuemin?: number;
  valuemax?: number;
  autocomplete?: string;
  haspopup?: string;
  invalid?: string;
  orientation?: string;
  children?: AccessibilityNode[];
  [key: string]: unknown;
}

interface FrameInfo {
  id?: string;
  parentId?: string;
  url?: string;
  name?: string;
  securityOrigin?: string;
  mimeType?: string;
  role?: string;
  nodeId?: string;
  // element?: Element; // Removed to prevent memory leaks
  handle?: string;
  [key: string]: unknown;
}

interface DecoratedElement {
  // element?: Element; // Removed to prevent memory leaks
  handle?: string;
  xpath?: string;
  role?: string;
  text?: string;
  nodeId?: string;
  [key: string]: unknown;
}

export {};

// Global declarations to expose fallbacks to the window object
declare global {
  interface Window {
    __stagehand_fallback_buildBackendIdMaps?: (targetFrame?: string) => Promise<{
      tagNameMap: Record<string, string>;
      xpathMap: Record<string, string>;
    }>;
    __stagehand_fallback_buildHierarchicalTree?: (
      elements: Element[],
      options?: { decorateScrollable?: boolean }
    ) => Promise<{
      tree: AccessibilityNode[];
      simplified: string;
      iframes: FrameInfo[];
      idToUrl: Record<string, string>;
      handleMap: Record<string, string>;
    }>;
    __stagehand_fallback_getCDPFrameId?: (frameElement?: Element) => string | null;
    __stagehand_fallback_getAccessibilityTreeWithFrames?: (
      rootXPath?: string,
      options?: { includeIframes?: boolean }
    ) => Promise<{
      combinedTree: string;
      combinedXpathMap: Record<string, string>;
      combinedUrlMap: Record<string, string>;
      handleMap: Record<string, string>;
    }>;
    __stagehand_fallback_filterAXTreeByXPath?: (
      xpath: string,
      options?: { createHandle?: boolean }
    ) => Promise<{
      elements: Element[];
      handles: string[];
      xpaths: string[];
    }>;
    __stagehand_fallback_decorateRoles?: (
      elements: Element[],
      scrollableElements?: Element[]
    ) => Promise<{
      decoratedElements: DecoratedElement[];
      handleMap: Record<string, string>;
    }>;
    __stagehand_fallback_getFrameExecutionContextId?: (frameElement?: Element) => string | null;
    __stagehand_fallbackImplementation?: StagehandFallbackImplementation;
  }
}

declare global {
  interface Window {
    // Stagehand fallback functions that return handles
    __stagehand_fallback_buildBackendIdMaps?: (
      targetFrame?: string
    ) => Promise<{ tagNameMap: Record<string, string>; xpathMap: Record<string, string> }>;

    __stagehand_fallback_buildHierarchicalTree?: (
      elements: Element[],
      options?: { decorateScrollable?: boolean }
    ) => Promise<{
      tree: AccessibilityNode[];
      simplified: string;
      iframes: FrameInfo[];
      idToUrl: Record<string, string>;
      handleMap: Record<string, string>; // element ID -> handle
    }>;

    __stagehand_fallback_getCDPFrameId?: (frameElement?: Element) => string | null;

    __stagehand_fallback_getAccessibilityTreeWithFrames?: (
      rootXPath?: string,
      options?: { includeIframes?: boolean }
    ) => Promise<{
      combinedTree: string;
      combinedXpathMap: Record<string, string>;
      combinedUrlMap: Record<string, string>;
      handleMap: Record<string, string>;
    }>;

    __stagehand_fallback_filterAXTreeByXPath?: (
      xpath: string,
      options?: { createHandle?: boolean }
    ) => Promise<{
      elements: Element[];
      handles: string[];
      xpaths: string[];
    }>;

    __stagehand_fallback_decorateRoles?: (
      elements: Element[],
      scrollableElements?: Element[]
    ) => Promise<{
      decoratedElements: DecoratedElement[];
      handleMap: Record<string, string>;
    }>;

    __stagehand_fallback_getFrameExecutionContextId?: (frameElement?: Element) => string | null;
  }
}

/**
 * Fallback configuration options
 */
interface FallbackConfig {
  maxDepth?: number;
  includeInvisible?: boolean;
  createHandles?: boolean;
  debug?: boolean;
}

/**
 * Simulated backend node ID structure
 */
interface BackendNodeInfo {
  id: string;
  tagName: string;
  xpath: string;
  handle?: string;
  element: Element;
}

/**
 * Accessibility node fallback structure (memory-safe)
 */
interface AccessibilityNodeFallback {
  role: string;
  name?: string;
  description?: string;
  value?: string;
  nodeId: string;
  handle?: string;
  // element?: Element; // Removed to prevent memory leaks
  children?: AccessibilityNodeFallback[];
  [key: string]: unknown;
}

/**
 * Main fallback implementation class with memory leak prevention
 */
class StagehandFallbackImplementation {
  private handleManager: HandleManager;
  private config: Required<FallbackConfig>;
  private backendNodeCounter = 0;
  private frameCounter = 0;

  // Use WeakMaps to prevent memory leaks - elements can be garbage collected
  private elementToNodeId = new WeakMap<Element, string>();
  private elementToHandle = new WeakMap<Element, string>();
  private frameToId = new WeakMap<HTMLIFrameElement, string>();
  private frameToContextId = new WeakMap<HTMLIFrameElement, string>();

  // Use WeakSet for tracking processed elements without holding strong references
  private processedElements = new WeakSet<Element>();

  // Cleanup tracking
  private isDisposed = false;
  private cleanupCallbacks: (() => void)[] = [];

  constructor(handleManager: HandleManager, config: FallbackConfig = {}) {
    this.handleManager = handleManager;
    this.config = {
      maxDepth: config.maxDepth ?? 10,
      includeInvisible: config.includeInvisible ?? false,
      createHandles: config.createHandles ?? true,
      debug: config.debug ?? false,
    };

    // Setup cleanup on page unload to prevent memory leaks
    const cleanup = () => this.dispose();
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
    this.cleanupCallbacks.push(() => {
      window.removeEventListener('beforeunload', cleanup);
      window.removeEventListener('pagehide', cleanup);
    });
  }

  /**
   * Dispose of the fallback instance and clean up memory
   */
  dispose(): void {
    if (this.isDisposed) return;

    this.isDisposed = true;

    // Run all cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Error during fallback cleanup:', error);
      }
    });
    this.cleanupCallbacks = [];

    if (this.config.debug) {
      console.log('🧹 Stagehand fallbacks disposed and cleaned up');
    }
  }

  /**
   * Check if instance is disposed
   */
  private checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error('StagehandFallbackImplementation has been disposed');
    }
  }

  /**
   * Fallback for buildBackendIdMaps - creates simulated backend ID mappings
   */
  async buildBackendIdMaps(targetFrame?: string): Promise<{
    tagNameMap: Record<string, string>;
    xpathMap: Record<string, string>;
  }> {
    this.checkDisposed();

    const tagNameMap: Record<string, string> = {};
    const xpathMap: Record<string, string> = {};

    try {
      // Get root element - use frame if specified, otherwise document
      let rootElement: Element = document.documentElement;

      if (targetFrame) {
        const frameElement = this.getFrameElementById(targetFrame);
        if (frameElement?.contentDocument) {
          rootElement = frameElement.contentDocument.documentElement;
        }
      }

      // Traverse DOM tree and create mappings
      const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (node: Node) => {
          const element = node as Element;
          return this.shouldIncludeElement(element)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });

      let currentNode = walker.currentNode as Element;
      while (currentNode) {
        // Check if we've already processed this element (prevents infinite loops)
        if (this.processedElements.has(currentNode)) {
          currentNode = walker.nextNode() as Element;
          continue;
        }

        this.processedElements.add(currentNode);

        const backendId = this.generateBackendNodeId();
        const encodedId = this.encodeWithFrameId(targetFrame || 'main', backendId);

        tagNameMap[encodedId] = currentNode.tagName.toLowerCase();
        xpathMap[encodedId] = this.generateXPathForElement(currentNode);

        // Create handle if configured - use WeakMap for memory safety
        if (this.config.createHandles) {
          try {
            const handle = this.handleManager.getHandleForElement(currentNode);
            this.elementToHandle.set(currentNode, handle);
          } catch (error) {
            if (this.config.debug) {
              console.warn('Failed to create handle for element:', error);
            }
          }
        }

        currentNode = walker.nextNode() as Element;
      }

      if (this.config.debug) {
        console.log('🗺️ Built backend ID maps:', {
          tagNameEntries: Object.keys(tagNameMap).length,
          xpathEntries: Object.keys(xpathMap).length,
        });
      }

      return { tagNameMap, xpathMap };
    } catch (error) {
      console.error('Error in buildBackendIdMaps fallback:', error);
      return { tagNameMap: {}, xpathMap: {} };
    }
  }

  /**
   * Fallback for buildHierarchicalTree - creates accessibility tree from DOM elements
   */
  async buildHierarchicalTree(
    elements: Element[],
    options: { decorateScrollable?: boolean } = {}
  ): Promise<{
    tree: AccessibilityNode[];
    simplified: string;
    iframes: FrameInfo[];
    idToUrl: Record<string, string>;
    handleMap: Record<string, string>;
  }> {
    this.checkDisposed();

    const tree: AccessibilityNodeFallback[] = [];
    const iframes: FrameInfo[] = [];
    const idToUrl: Record<string, string> = {};
    // Use a regular object for handleMap as it needs to be returned
    // but store weak references internally
    const handleMap: Record<string, string> = {};

    try {
      // Get scrollable elements if decoration is requested
      let scrollableElements: Set<Element> = new Set();
      if (options.decorateScrollable && window.getScrollableElements) {
        const scrollables = window.getScrollableElements();
        scrollableElements = new Set(scrollables);
      }

      // Process each element
      for (const element of elements) {
        // Skip if already processed in this session to prevent duplication
        const node = await this.createAccessibilityNodeFromElement(
          element,
          scrollableElements,
          handleMap
        );

        if (node) {
          tree.push(node);
        }

        // Check for iframes - but don't store element reference in returned object
        if (element.tagName.toLowerCase() === 'iframe') {
          iframes.push({
            role: 'Iframe',
            nodeId: node?.nodeId || this.generateNodeId(),
            // Don't store element reference to prevent memory leaks
            handle: node?.handle,
          });
        }

        // Extract URL if available
        const url = this.extractUrlFromElement(element);
        if (url && node?.nodeId) {
          idToUrl[node.nodeId] = url;
        }
      }

      // Generate simplified text representation
      const simplified = this.generateSimplifiedTree(tree);

      if (this.config.debug) {
        console.log('🌳 Built hierarchical tree:', {
          treeNodes: tree.length,
          iframes: iframes.length,
          urlMappings: Object.keys(idToUrl).length,
          handles: Object.keys(handleMap).length,
        });
      }

      return { tree, simplified, iframes, idToUrl, handleMap };
    } catch (error) {
      console.error('Error in buildHierarchicalTree fallback:', error);
      return { tree: [], simplified: '', iframes: [], idToUrl: {}, handleMap: {} };
    }
  }

  /**
   * Fallback for getCDPFrameId - generates simulated frame IDs
   */
  getCDPFrameId(frameElement?: Element): string | null {
    this.checkDisposed();

    if (!frameElement) {
      return null; // Main frame
    }

    if (frameElement.tagName.toLowerCase() !== 'iframe') {
      return null;
    }

    // Use WeakMap to avoid memory leaks from storing frame references
    const iframe = frameElement as HTMLIFrameElement;

    // Check if we already have a frame ID for this element
    let frameId = this.frameToId.get(iframe);
    if (!frameId) {
      frameId = `frame-${this.generateFrameId()}`;
      this.frameToId.set(iframe, frameId);
    }

    return frameId;
  }

  /**
   * Fallback for getAccessibilityTreeWithFrames - combines main and iframe trees
   */
  async getAccessibilityTreeWithFrames(
    rootXPath?: string,
    options: { includeIframes?: boolean } = {}
  ): Promise<{
    combinedTree: string;
    combinedXpathMap: Record<string, string>;
    combinedUrlMap: Record<string, string>;
    handleMap: Record<string, string>;
  }> {
    const combinedXpathMap: Record<string, string> = {};
    const combinedUrlMap: Record<string, string> = {};
    const handleMap: Record<string, string> = {};
    let combinedTree = '';

    try {
      // Start with main frame
      let rootElement: Element = document.documentElement;

      // If rootXPath is provided, try to find the specific element
      if (rootXPath) {
        const element = this.getElementByXPath(rootXPath);
        if (element) {
          rootElement = element;
        }
      }

      // Get main frame tree
      const mainElements = this.getAllElementsUnder(rootElement);
      const mainTree = await this.buildHierarchicalTree(mainElements, {
        decorateScrollable: true,
      });

      combinedTree = mainTree.simplified;
      Object.assign(combinedXpathMap, this.generateXPathMappings(mainElements));
      Object.assign(combinedUrlMap, mainTree.idToUrl);
      Object.assign(handleMap, mainTree.handleMap);

      // Process iframes if requested
      if (options.includeIframes) {
        const iframes = document.querySelectorAll('iframe');

        for (const iframe of iframes) {
          try {
            const frameId = this.getCDPFrameId(iframe);
            const frameTree = await this.processIframeTree(iframe, frameId);

            if (frameTree) {
              // Inject iframe tree into combined tree
              combinedTree = this.injectIframeTree(combinedTree, frameTree);
              Object.assign(combinedXpathMap, frameTree.xpathMap);
              Object.assign(combinedUrlMap, frameTree.urlMap);
              Object.assign(handleMap, frameTree.handleMap);
            }
          } catch (error) {
            if (this.config.debug) {
              console.warn('Failed to process iframe:', error);
            }
          }
        }
      }

      if (this.config.debug) {
        console.log('🔗 Built combined tree with frames:', {
          combinedTreeLength: combinedTree.length,
          xpathMappings: Object.keys(combinedXpathMap).length,
          urlMappings: Object.keys(combinedUrlMap).length,
          handles: Object.keys(handleMap).length,
        });
      }

      return { combinedTree, combinedXpathMap, combinedUrlMap, handleMap };
    } catch (error) {
      console.error('Error in getAccessibilityTreeWithFrames fallback:', error);
      return { combinedTree: '', combinedXpathMap: {}, combinedUrlMap: {}, handleMap: {} };
    }
  }

  /**
   * Fallback for filterAXTreeByXPath - filters elements by XPath
   */
  async filterAXTreeByXPath(
    xpath: string,
    options: { createHandle?: boolean } = {}
  ): Promise<{
    elements: Element[];
    handles: string[];
    xpaths: string[];
  }> {
    const elements: Element[] = [];
    const handles: string[] = [];
    const xpaths: string[] = [];

    try {
      // Find all elements matching the XPath
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
      );

      let node = result.iterateNext();
      while (node) {
        if (node instanceof Element) {
          elements.push(node);

          // Generate XPath for this specific element
          const elementXPath = this.generateXPathForElement(node);
          xpaths.push(elementXPath);

          // Create handle if requested
          if (options.createHandle || this.config.createHandles) {
            try {
              const handle = this.handleManager.getHandleForElement(node);
              handles.push(handle);
            } catch (error) {
              if (this.config.debug) {
                console.warn('Failed to create handle for filtered element:', error);
              }
              handles.push(''); // Placeholder
            }
          }
        }
        node = result.iterateNext();
      }

      if (this.config.debug) {
        console.log('🔍 Filtered elements by XPath:', {
          xpath,
          elementsFound: elements.length,
          handlesCreated: handles.filter(h => h).length,
        });
      }

      return { elements, handles, xpaths };
    } catch (error) {
      console.error('Error in filterAXTreeByXPath fallback:', error);
      return { elements: [], handles: [], xpaths: [] };
    }
  }

  /**
   * Fallback for decorateRoles - adds scrollable decoration to roles
   */
  async decorateRoles(
    elements: Element[],
    scrollableElements?: Element[]
  ): Promise<{
    decoratedElements: DecoratedElement[];
    handleMap: Record<string, string>;
  }> {
    const decoratedElements: DecoratedElement[] = [];
    const handleMap: Record<string, string> = {};

    try {
      // Get scrollable elements if not provided
      let scrollables: Set<Element> = new Set();
      if (scrollableElements) {
        scrollables = new Set(scrollableElements);
      } else if (window.getScrollableElements) {
        const scrollableElems = window.getScrollableElements();
        scrollables = new Set(scrollableElems);
      }

      // Process each element
      for (const element of elements) {
        const node = await this.createAccessibilityNodeFromElement(element, scrollables, handleMap);

        if (node) {
          decoratedElements.push(node);
        }
      }

      if (this.config.debug) {
        console.log('🎨 Decorated roles:', {
          elementsDecorated: decoratedElements.length,
          scrollableDecorations: Array.from(scrollables).length,
          handlesCreated: Object.keys(handleMap).length,
        });
      }

      return { decoratedElements, handleMap };
    } catch (error) {
      console.error('Error in decorateRoles fallback:', error);
      return { decoratedElements: [], handleMap: {} };
    }
  }

  /**
   * Fallback for getFrameExecutionContextId - generates simulated context IDs
   */
  getFrameExecutionContextId(frameElement?: Element): string | null {
    this.checkDisposed();

    if (!frameElement || frameElement.tagName.toLowerCase() !== 'iframe') {
      return null; // Main context
    }

    // Use WeakMap to avoid memory leaks from storing frame references
    const iframe = frameElement as HTMLIFrameElement;

    // Check if we already have a context ID for this element
    let contextId = this.frameToContextId.get(iframe);
    if (!contextId) {
      contextId = `context-${this.generateContextId()}`;
      this.frameToContextId.set(iframe, contextId);
    }

    return contextId;
  }

  // Helper methods

  private shouldIncludeElement(element: Element): boolean {
    if (!this.config.includeInvisible && !this.isElementVisible(element)) {
      return false;
    }

    // Skip script, style, and other non-interactive elements
    const skipTags = new Set(['script', 'style', 'meta', 'link', 'title']);
    return !skipTags.has(element.tagName.toLowerCase());
  }

  private isElementVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  private generateBackendNodeId(): number {
    this.backendNodeCounter++;
    // Reset counter if it gets too large to prevent memory issues
    if (this.backendNodeCounter > 1000000) {
      this.backendNodeCounter = 1;
    }
    return this.backendNodeCounter;
  }

  private generateFrameId(): string {
    this.frameCounter++;
    // Reset counter if it gets too large
    if (this.frameCounter > 1000000) {
      this.frameCounter = 1;
    }
    return this.frameCounter.toString();
  }

  private generateContextId(): string {
    return `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNodeId(): string {
    return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private encodeWithFrameId(frameId: string, backendId: number): string {
    return `${frameId}-${backendId}`;
  }

  private generateXPathForElement(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.documentElement) {
      let index = 1;
      let sibling = current.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const tagName = current.tagName.toLowerCase();
      parts.unshift(index === 1 ? tagName : `${tagName}[${index}]`);
      current = current.parentElement;
    }

    return parts.length > 0 ? `/${parts.join('/')}` : '/';
  }

  private getElementByXPath(xpath: string): Element | null {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );

    const node = result.singleNodeValue;
    return node instanceof Element ? node : null;
  }

  private getAllElementsUnder(root: Element): Element[] {
    const elements: Element[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node: Node) => {
        const element = node as Element;
        return this.shouldIncludeElement(element)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });

    let currentNode = walker.currentNode as Element;
    while (currentNode) {
      elements.push(currentNode);
      currentNode = walker.nextNode() as Element;
    }

    return elements;
  }

  private async createAccessibilityNodeFromElement(
    element: Element,
    scrollableElements: Set<Element>,
    handleMap: Record<string, string>
  ): Promise<AccessibilityNodeFallback | null> {
    try {
      // Check if we already have a node ID for this element
      let nodeId = this.elementToNodeId.get(element);
      if (!nodeId) {
        nodeId = this.generateNodeId();
        this.elementToNodeId.set(element, nodeId);
      }

      // Get basic properties
      let role = this.getElementRole(element);

      // Decorate scrollable elements
      if (scrollableElements.has(element)) {
        role = role && role !== 'generic' ? `scrollable, ${role}` : 'scrollable';
      }

      // Create handle if configured
      let handle: string | undefined;
      if (this.config.createHandles) {
        try {
          // Check if we already have a handle for this element
          handle = this.elementToHandle.get(element);
          if (!handle) {
            handle = this.handleManager.getHandleForElement(element);
            this.elementToHandle.set(element, handle);
          }
          handleMap[nodeId] = handle;
        } catch (error) {
          if (this.config.debug) {
            console.warn('Failed to create handle for accessibility node:', error);
          }
        }
      }

      // Return node without storing element reference to prevent memory leaks
      return {
        role,
        name: this.getElementName(element),
        description: this.getElementDescription(element),
        value: this.getElementValue(element),
        nodeId,
        handle,
        // Don't store element reference in the returned object to prevent memory leaks
        // element property removed from return
      };
    } catch (error) {
      console.error('Error creating accessibility node:', error);
      return null;
    }
  }

  private getElementRole(element: Element): string {
    // Check explicit role attribute
    const explicitRole = element.getAttribute('role');
    if (explicitRole) return explicitRole;

    // Map common HTML elements to roles
    const tagName = element.tagName.toLowerCase();
    const roleMap: Record<string, string> = {
      button: 'button',
      a: 'link',
      input: this.getInputRole(element as HTMLInputElement),
      select: 'combobox',
      textarea: 'textbox',
      img: 'img',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading',
      nav: 'navigation',
      main: 'main',
      section: 'region',
      article: 'article',
      aside: 'complementary',
      header: 'banner',
      footer: 'contentinfo',
    };

    return roleMap[tagName] || 'generic';
  }

  private getInputRole(input: HTMLInputElement): string {
    const type = input.type.toLowerCase();
    const roleMap: Record<string, string> = {
      button: 'button',
      submit: 'button',
      reset: 'button',
      checkbox: 'checkbox',
      radio: 'radio',
      range: 'slider',
      email: 'textbox',
      password: 'textbox',
      search: 'searchbox',
      tel: 'textbox',
      url: 'textbox',
      text: 'textbox',
    };

    return roleMap[type] || 'textbox';
  }

  private getElementName(element: Element): string | undefined {
    // Try different sources for accessible name
    const sources = [
      () => element.getAttribute('aria-label'),
      () =>
        element.getAttribute('aria-labelledby') &&
        this.getTextFromIds(element.getAttribute('aria-labelledby')!),
      () => element.getAttribute('alt'),
      () => element.getAttribute('title'),
      () => (element as HTMLElement).innerText?.trim(),
      () => element.textContent?.trim(),
    ];

    for (const getSource of sources) {
      try {
        const value = getSource();
        if (value && value.length > 0) {
          return value;
        }
      } catch (error) {
        // Continue to next source
      }
    }

    return undefined;
  }

  private getElementDescription(element: Element): string | undefined {
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy) {
      return this.getTextFromIds(describedBy);
    }
    return undefined;
  }

  private getElementValue(element: Element): string | undefined {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    if (element instanceof HTMLSelectElement) {
      return element.value;
    }
    return element.getAttribute('aria-valuenow') || undefined;
  }

  private getTextFromIds(ids: string): string {
    return ids
      .split(/\s+/)
      .map(id => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');
  }

  private generateSimplifiedTree(nodes: AccessibilityNodeFallback[]): string {
    const lines: string[] = [];

    const processNode = (node: AccessibilityNodeFallback, indent = 0) => {
      const indentStr = '  '.repeat(indent);
      const nameStr = node.name ? `: ${node.name}` : '';
      const handleStr = node.handle ? ` [${node.handle}]` : '';

      lines.push(`${indentStr}[${node.nodeId}] ${node.role}${nameStr}${handleStr}`);

      if (node.children) {
        node.children.forEach(child => processNode(child, indent + 1));
      }
    };

    nodes.forEach(node => processNode(node));
    return lines.join('\n');
  }

  private generateXPathMappings(elements: Element[]): Record<string, string> {
    const mappings: Record<string, string> = {};

    elements.forEach(element => {
      const nodeId = this.generateNodeId();
      const xpath = this.generateXPathForElement(element);
      mappings[nodeId] = xpath;
    });

    return mappings;
  }

  private extractUrlFromElement(element: Element): string | undefined {
    if (element instanceof HTMLAnchorElement && element.href) {
      return element.href;
    }
    if (element instanceof HTMLAreaElement && element.href) {
      return element.href;
    }
    return undefined;
  }

  private getFrameElementById(frameId: string): HTMLIFrameElement | null {
    // Search through our WeakMap to find the iframe with the given ID
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe instanceof HTMLIFrameElement) {
        const storedId = this.frameToId.get(iframe);
        if (storedId === frameId) {
          return iframe;
        }
      }
    }
    return null;
  }

  private async processIframeTree(
    iframe: HTMLIFrameElement,
    _frameId: string | null
  ): Promise<{
    tree: string;
    xpathMap: Record<string, string>;
    urlMap: Record<string, string>;
    handleMap: Record<string, string>;
  } | null> {
    try {
      // Try to access iframe content (will fail for cross-origin)
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) return null;

      const iframeElements = this.getAllElementsUnder(iframeDoc.documentElement);
      const iframeTree = await this.buildHierarchicalTree(iframeElements);

      return {
        tree: iframeTree.simplified,
        xpathMap: this.generateXPathMappings(iframeElements),
        urlMap: iframeTree.idToUrl,
        handleMap: iframeTree.handleMap,
      };
    } catch (error) {
      if (this.config.debug) {
        console.warn('Cannot access iframe content (likely cross-origin):', error);
      }
      return null;
    }
  }

  private injectIframeTree(mainTree: string, iframeTree: { tree: string }): string {
    // Simple injection - in a real implementation, this would be more sophisticated
    return mainTree + '\n' + iframeTree.tree;
  }
}

/**
 * Global fallback instance
 */
let fallbackInstance: StagehandFallbackImplementation | null = null;

/**
 * Initialize the fallback system with memory leak prevention
 */
function initializeStagehandFallbacks(
  handleManager: HandleManager,
  config: FallbackConfig = {}
): void {
  // Dispose existing instance first to prevent memory leaks
  if (fallbackInstance) {
    fallbackInstance.dispose();
    fallbackInstance = null;
  }

  fallbackInstance = new StagehandFallbackImplementation(handleManager, config);

  // Expose fallback functions to global window
  window.__stagehand_fallback_buildBackendIdMaps = (targetFrame?: string) =>
    fallbackInstance!.buildBackendIdMaps(targetFrame);

  window.__stagehand_fallback_buildHierarchicalTree = (elements: Element[], options?) =>
    fallbackInstance!.buildHierarchicalTree(elements, options);

  window.__stagehand_fallback_getCDPFrameId = (frameElement?: Element) =>
    fallbackInstance!.getCDPFrameId(frameElement);

  window.__stagehand_fallback_getAccessibilityTreeWithFrames = (rootXPath?: string, options?) =>
    fallbackInstance!.getAccessibilityTreeWithFrames(rootXPath, options);

  window.__stagehand_fallback_filterAXTreeByXPath = (xpath: string, options?) =>
    fallbackInstance!.filterAXTreeByXPath(xpath, options);

  window.__stagehand_fallback_decorateRoles = (elements: Element[], scrollableElements?) =>
    fallbackInstance!.decorateRoles(elements, scrollableElements);

  window.__stagehand_fallback_getFrameExecutionContextId = (frameElement?: Element) =>
    fallbackInstance!.getFrameExecutionContextId(frameElement);

  // Store reference for cleanup
  window.__stagehand_fallbackImplementation = fallbackInstance;

  console.log('🔧 Stagehand CDP fallbacks initialized with memory leak prevention');
}

/**
 * Dispose of the fallback system and clean up memory
 */
function disposeStagehandFallbacks(): void {
  if (fallbackInstance) {
    fallbackInstance.dispose();
    fallbackInstance = null;
  }

  // Clean up global references
  delete window.__stagehand_fallback_buildBackendIdMaps;
  delete window.__stagehand_fallback_buildHierarchicalTree;
  delete window.__stagehand_fallback_getCDPFrameId;
  delete window.__stagehand_fallback_getAccessibilityTreeWithFrames;
  delete window.__stagehand_fallback_filterAXTreeByXPath;
  delete window.__stagehand_fallback_decorateRoles;
  delete window.__stagehand_fallback_getFrameExecutionContextId;
  delete window.__stagehand_fallbackImplementation;

  console.log('🧹 Stagehand CDP fallbacks disposed and cleaned up');
}

/**
 * Get the current fallback instance
 */
function getStagehandFallbacks(): StagehandFallbackImplementation | null {
  return fallbackInstance;
}

// Export for use in other modules
export {
  StagehandFallbackImplementation,
  initializeStagehandFallbacks,
  disposeStagehandFallbacks,
  getStagehandFallbacks,
  type FallbackConfig,
  type BackendNodeInfo,
  type AccessibilityNodeFallback,
};
