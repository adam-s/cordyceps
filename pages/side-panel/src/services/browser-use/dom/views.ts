/**
 * TypeScript implementation of browser-use DOM views
 */

/**
 * Viewport information for DOM nodes
 * Matches the Python implementation's viewport properties
 */
export class ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
  documentHeight: number;
  documentWidth: number;

  constructor(
    width: number = 1024,
    height: number = 768,
    scrollX: number = 0,
    scrollY: number = 0,
    devicePixelRatio: number = 1,
    documentHeight: number = 1024,
    documentWidth: number = 768,
  ) {
    this.width = width;
    this.height = height;
    this.scrollX = scrollX;
    this.scrollY = scrollY;
    this.devicePixelRatio = devicePixelRatio;
    this.documentHeight = documentHeight;
    this.documentWidth = documentWidth;
  }

  toDict(): Record<string, unknown> {
    return {
      width: this.width,
      height: this.height,
      scrollX: this.scrollX,
      scrollY: this.scrollY,
      devicePixelRatio: this.devicePixelRatio,
      documentHeight: this.documentHeight,
      documentWidth: this.documentWidth,
    };
  }
}

/**
 * Base class for DOM nodes
 */
export abstract class DOMBaseNode {
  isVisible: boolean;
  parent: DOMElementNode | null;

  constructor(isVisible: boolean = false, parent: DOMElementNode | null = null) {
    this.isVisible = isVisible;
    this.parent = parent;
  }

  abstract toDict(): Record<string, unknown>;
}

/**
 * Represents a DOM text node
 */
export class DOMTextNode extends DOMBaseNode {
  text: string;

  constructor(text: string, isVisible: boolean = false, parent: DOMElementNode | null = null) {
    super(isVisible, parent);
    this.text = text;
  }

  /**
   * Check if the node has a parent
   */
  hasParent(): boolean {
    return this.parent !== null;
  }

  /**
   * Get the parent element
   */
  getParent(): DOMElementNode | null {
    return this.parent;
  }

  /**
   * Check if the node has a parent with a highlight index
   * This matches the Python implementation's has_parent_with_highlight_index method
   */
  hasParentWithHighlightIndex(): boolean {
    let current = this.parent;
    while (current !== null) {
      // Stop if the element has a highlight index (will be handled separately)
      if (current.highlightIndex !== undefined) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  toDict(): Record<string, unknown> {
    return {
      type: 'TEXT_NODE',
      text: this.text,
      isVisible: this.isVisible,
      parent: this.parent?.toDict(),
    };
  }
}

/**
 * Represents a DOM element node
 */
export class DOMElementNode extends DOMBaseNode {
  tagName: string;
  xpath: string;
  attributes: Record<string, string>;
  children: Array<DOMElementNode | DOMTextNode>;
  isInteractive: boolean;
  isTopElement: boolean;
  isInViewport: boolean;
  hasShadowRoot: boolean;
  highlightIndex: number | undefined;
  viewportInfo: ViewportInfo | undefined;
  pageCoordinates: { x: number; y: number; width: number; height: number } | null;
  viewportCoordinates: { x: number; y: number; width: number; height: number } | null;

  constructor(
    tag: string,
    xpath: string,
    attributes: Record<string, string> = {},
    children: Array<DOMElementNode | DOMTextNode> = [],
    isVisible: boolean = false,
    isInteractive: boolean = false,
    isTopElement: boolean = false,
    isInViewport: boolean = false,
    hasShadowRoot: boolean = false,
    highlightIndex?: number,
    parent: DOMElementNode | null = null,
    viewportInfo?: ViewportInfo,
    pageCoordinates: { x: number; y: number; width: number; height: number } | null = null,
    viewportCoordinates: { x: number; y: number; width: number; height: number } | null = null,
  ) {
    super(isVisible, parent);
    this.tagName = tag.toLowerCase();
    this.xpath = xpath;
    this.attributes = attributes;
    this.children = children;
    this.isInteractive = isInteractive;
    this.isTopElement = isTopElement;
    this.isInViewport = isInViewport;
    this.hasShadowRoot = hasShadowRoot;
    this.highlightIndex = highlightIndex;
    this.viewportInfo = viewportInfo;
    this.pageCoordinates = pageCoordinates;
    this.viewportCoordinates = viewportCoordinates;
  }

  /**
   * Get the text content of the node
   */
  getTextContent(): string {
    let text = '';
    for (const child of this.children) {
      if (child instanceof DOMTextNode) {
        text += child.text + ' ';
      } else if (child instanceof DOMElementNode) {
        text += child.getTextContent() + ' ';
      }
    }
    return text.trim();
  }

  /**
   * Get the ID attribute of the node
   */
  getId(): string | null {
    return this.attributes['id'] || null;
  }

  /**
   * Get the class attribute of the node
   */
  getClass(): string | null {
    return this.attributes['class'] || null;
  }

  /**
   * Check if the node is clickable
   */
  isClickable(): boolean {
    return this.isInteractive && this.isVisible && this.isTopElement && this.isInViewport;
  }

  /**
   * Check if the node is editable
   */
  isEditable(): boolean {
    const editableTags = ['input', 'textarea', 'select'];
    const contentEditable = this.attributes['contenteditable'] === 'true';
    return (editableTags.includes(this.tagName) || contentEditable) && this.isVisible;
  }

  /**
   * Get all text until the next clickable element
   * This is used in the clickableElementsToString method
   * @param maxDepth Maximum depth to search for text
   * @returns All text until the next clickable element
   */
  getAllTextTillNextClickableElement(maxDepth: number = -1): string {
    const textParts: string[] = [];

    const collectText = (node: DOMBaseNode, currentDepth: number): void => {
      if (maxDepth !== -1 && currentDepth > maxDepth) {
        return;
      }

      // Skip this branch if we hit a highlighted element (except for the current node)
      if (node instanceof DOMElementNode && node !== this && node.highlightIndex !== undefined) {
        return;
      }

      if (node instanceof DOMTextNode) {
        textParts.push(node.text);
      } else if (node instanceof DOMElementNode) {
        for (const child of node.children) {
          collectText(child, currentDepth + 1);
        }
      }
    };

    collectText(this, 0);
    return textParts.join('\n').trim();
  }

  /**
   * Convert the DOM tree to a string representation of clickable elements
   * This exactly matches the Python implementation's clickable_elements_to_string method
   * @param includeAttributes Optional list of attributes to include in the output
   * @returns String representation of clickable elements
   */
  clickableElementsToString(includeAttributes: string[] | null = null): string {
    const formattedText: string[] = [];

    const processNode = (node: DOMBaseNode, depth: number): void => {
      if (node instanceof DOMElementNode) {
        // Add element with highlight_index
        if (node.highlightIndex !== undefined) {
          let attributesStr = '';
          // Use get_all_text_till_next_clickable_element() to match Python exactly
          const text = node.getAllTextTillNextClickableElement();

          if (includeAttributes) {
            // This exactly matches the Python implementation's attribute filtering logic
            const attributes = Array.from(
              new Set(
                Object.entries(node.attributes)
                  .filter(
                    ([key, value]) => includeAttributes.includes(key) && value !== node.tagName,
                  )
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  .map(([_, value]) => String(value)),
              ),
            );

            // Remove text from attributes if it matches to avoid duplication
            if (text && attributes.includes(text)) {
              attributes.splice(attributes.indexOf(text), 1);
            }

            attributesStr = attributes.join(';');
          }

          // Format the line exactly as in Python
          let line = `[${node.highlightIndex}]<${node.tagName} `;

          if (attributesStr) {
            line += `${attributesStr}`;
          }

          if (text) {
            if (attributesStr) {
              line += `>${text}`;
            } else {
              line += `${text}`;
            }
          }

          line += '/>';
          formattedText.push(line);
        }

        // Process children regardless
        for (const child of node.children) {
          processNode(child, depth + 1);
        }
      } else if (node instanceof DOMTextNode) {
        // Add text only if it doesn't have a highlighted parent and is visible
        // This exactly matches Python's implementation
        if (!node.hasParentWithHighlightIndex() && node.isVisible) {
          formattedText.push(`${node.text}`);
        }
      }
    };

    processNode(this, 0);
    return formattedText.join('\n');
  }

  toDict(): Record<string, unknown> {
    return {
      tag: this.tagName,
      xpath: this.xpath,
      attributes: this.attributes,
      children: this.children.map(child => child.toDict()),
      isVisible: this.isVisible,
      isInteractive: this.isInteractive,
      isTopElement: this.isTopElement,
      isInViewport: this.isInViewport,
      hasShadowRoot: this.hasShadowRoot,
      highlightIndex: this.highlightIndex,
      viewportInfo: this.viewportInfo?.toDict(),
      textContent: this.getTextContent(),
    };
  }
}

/**
 * Represents a DOM history element
 */
export class DOMHistoryElement {
  tag: string;
  attributes: Record<string, string>;
  textContent: string;
  cssSelector: string;
  xpath: string;
  boundingBox: { x: number; y: number; width: number; height: number } | undefined;

  constructor(
    tag: string,
    attributes: Record<string, string>,
    textContent: string,
    cssSelector: string = '',
    xpath: string = '',
    boundingBox?: { x: number; y: number; width: number; height: number },
  ) {
    this.tag = tag;
    this.attributes = attributes;
    this.textContent = textContent;
    this.cssSelector = cssSelector;
    this.xpath = xpath;
    this.boundingBox = boundingBox;
  }

  toDict(): Record<string, unknown> {
    return {
      tag: this.tag,
      attributes: this.attributes,
      textContent: this.textContent,
      cssSelector: this.cssSelector,
      xpath: this.xpath,
      boundingBox: this.boundingBox,
    };
  }
}

/**
 * Represents a selector map
 */
export interface SelectorMap {
  [key: string]: DOMElementNode;
}

/**
 * Base class for DOM state
 * Matches the original Python implementation
 */
export class DOMState {
  rootElement: DOMElementNode;
  selectorMap: SelectorMap;
  elementTree?: DOMElementNode;

  constructor(rootElement: DOMElementNode, selectorMap: SelectorMap, elementTree?: DOMElementNode) {
    this.rootElement = rootElement;
    this.selectorMap = selectorMap;
    if (elementTree !== undefined) {
      this.elementTree = elementTree;
    } else {
      // If elementTree is not provided, use rootElement as the default
      this.elementTree = rootElement;
    }
  }

  toDict(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      rootElement: this.rootElement.toDict(),
      selectorMap: Object.fromEntries(
        Object.entries(this.selectorMap).map(([key, value]) => [key, value.toDict()]),
      ),
    };

    if (this.elementTree !== undefined) {
      result['elementTree'] = this.elementTree;
    }

    return result;
  }
}
