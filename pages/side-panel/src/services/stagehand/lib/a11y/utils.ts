/**
 * Chrome Extension A11y Utilities
 *
 * This module provides Chrome extension-compatible versions of Stagehand's accessibility
 * functions, using browser-use DOM traversal patterns instead of CDP calls.
 */

import {
  AccessibilityNode,
  TreeResult,
  BackendIdMaps,
  CombinedA11yResult,
  EncodedId,
} from '../../types/context';
import { ChromeExtensionStagehandPage } from '../ChromeExtensionStagehandPage';
import { LogLine } from '../../types/log';
import { Frame } from '../../../cordyceps/frame';

// Type declaration for fallback functions
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
      iframes: unknown[];
      idToUrl: Record<string, string>;
      handleMap: Record<string, string>;
    }>;
  }
}

const PUA_START = 0xe000;
const PUA_END = 0xf8ff;

const NBSP_CHARS = new Set<number>([0x00a0, 0x202f, 0x2007, 0xfeff]);

/**
 * Clean a string by removing private-use unicode characters, normalizing whitespace,
 * and trimming the result.
 */
export function cleanText(input: string): string {
  let out = '';
  let prevWasSpace = false;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);

    // Skip private-use area glyphs
    if (code >= PUA_START && code <= PUA_END) {
      continue;
    }

    // Convert NBSP-family characters to a single space, collapsing repeats
    if (NBSP_CHARS.has(code)) {
      if (!prevWasSpace) {
        out += ' ';
        prevWasSpace = true;
      }
      continue;
    }

    // Append the character and update space tracker
    out += input[i];
    prevWasSpace = input[i] === ' ';
  }

  // Trim leading/trailing spaces before returning
  return out.trim();
}

/**
 * Generate a human-readable, indented outline of an accessibility node tree.
 */
export function formatSimplifiedTree(
  node: AccessibilityNode & { encodedId?: EncodedId },
  level = 0
): string {
  // Compute indentation based on depth level
  const indent = '  '.repeat(level);

  // Use encodedId if available, otherwise fallback to nodeId
  const idLabel = node.encodedId ?? node.nodeId;

  // Prepare the formatted name segment if present
  const namePart = node.name ? `: ${cleanText(node.name)}` : '';

  // Build current line and recurse into child nodes
  const currentLine = `${indent}[${idLabel}] ${node.role}${namePart}\n`;
  const childrenLines =
    node.children?.map(c => formatSimplifiedTree(c as typeof node, level + 1)).join('') ?? '';

  return currentLine + childrenLines;
}

/**
 * Build mappings from element IDs to HTML tag names and relative XPaths.
 * Chrome extension implementation using DOM traversal instead of CDP.
 */
export async function buildBackendIdMaps(
  experimental: boolean,
  sp: ChromeExtensionStagehandPage,
  _targetFrame?: Frame
): Promise<BackendIdMaps> {
  try {
    // Wait a moment to ensure DOM is ready
    await new Promise(resolve => setTimeout(resolve, 10));

    // Use page.evaluate to build DOM mappings in the browser context
    const result = await sp.page.evaluate(() => {
      // Check if document is ready
      if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
        console.warn('buildBackendIdMaps: document not ready, state:', document.readyState);
        return null;
      }

      // Check if fallback function exists
      if (typeof window.__stagehand_fallback_buildBackendIdMaps === 'function') {
        try {
          return window.__stagehand_fallback_buildBackendIdMaps();
        } catch (error) {
          console.warn('buildBackendIdMaps: fallback function failed:', error);
          // Continue to inline implementation
        }
      }

      // Fallback implementation using browser-use approach
      function buildDomMappings(): {
        tagNameMap: Record<string, string>;
        xpathMap: Record<string, string>;
      } {
        const tagNameMap: Record<string, string> = {};
        const xpathMap: Record<string, string> = {};
        let idCounter = 0;

        // XPath generation function copied from browserUse.js
        function getElementXPath(element: Element): string {
          const segments: string[] = [];
          let currentElement: Element | null = element;

          while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
            // Get position among siblings of same tag
            const siblings = Array.from(currentElement.parentNode?.children || []).filter(
              child => child.tagName === currentElement!.tagName
            );
            const position = siblings.indexOf(currentElement) + 1;

            const tagName = currentElement.nodeName.toLowerCase();
            const xpathIndex = position > 1 ? `[${position}]` : '';
            segments.unshift(`${tagName}${xpathIndex}`);

            currentElement = currentElement.parentElement;
          }

          return '/' + segments.join('/');
        }

        // Traverse all elements in the document
        function traverseElements(root: Element): void {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);

          let node: Node | null;
          while ((node = walker.nextNode())) {
            const element = node as Element;
            const id = `${idCounter++}`;

            tagNameMap[id] = element.tagName.toLowerCase();
            xpathMap[id] = getElementXPath(element);
          }
        }

        // Start traversal from document root
        if (document.documentElement) {
          traverseElements(document.documentElement);
        }

        return { tagNameMap, xpathMap };
      }

      try {
        return buildDomMappings();
      } catch (error) {
        console.warn('buildBackendIdMaps: inline function failed:', error);
        return null;
      }
    });

    // Add null/undefined check with more detailed logging
    if (!result || typeof result !== 'object') {
      console.warn('buildBackendIdMaps: got invalid result from page.evaluate, using empty maps', {
        result,
        resultType: typeof result,
        isNull: result === null,
        isUndefined: result === undefined,
      });
      return {
        tagNameMap: {},
        xpathMap: {},
      };
    }

    return {
      tagNameMap: result.tagNameMap || {},
      xpathMap: result.xpathMap || {},
    };
  } catch (error) {
    console.error('Failed to build backend ID maps:', error, {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : 'No stack trace',
      experimental,
      hasPage: !!sp.page,
      targetFrame: _targetFrame,
    });
    return {
      tagNameMap: {},
      xpathMap: {},
    };
  }
}

/**
 * Recursively prune or collapse structural nodes in the AX tree to simplify hierarchy.
 * Chrome extension implementation using DOM-based accessibility tree.
 */
async function cleanStructuralNodes(
  node: AccessibilityNode & { encodedId?: EncodedId },
  tagNameMap: Record<EncodedId, string>,
  logger?: (l: LogLine) => void
): Promise<AccessibilityNode | null> {
  // 0. ignore negative pseudo-nodes
  if (node.nodeId && +node.nodeId < 0) return null;

  // 1. leaf check
  if (!node.children?.length) {
    return node.role === 'generic' || node.role === 'none' ? null : node;
  }

  // 2. recurse into children
  const cleanedChildren = (
    await Promise.all(node.children.map(c => cleanStructuralNodes(c, tagNameMap, logger)))
  ).filter(Boolean) as AccessibilityNode[];

  // 3. collapse / prune generic wrappers
  if (node.role === 'generic' || node.role === 'none') {
    if (cleanedChildren.length === 1) {
      // Collapse single-child structural node
      return cleanedChildren[0];
    } else if (cleanedChildren.length === 0) {
      // Remove empty structural node
      return null;
    }
  }

  // 4. replace generic role with real tag name (if we know it)
  if ((node.role === 'generic' || node.role === 'none') && node.encodedId !== undefined) {
    const tagName = tagNameMap[node.encodedId];
    if (tagName) node.role = tagName;
  }

  if (
    node.role === 'combobox' &&
    node.encodedId !== undefined &&
    tagNameMap[node.encodedId] === 'select'
  ) {
    node.role = 'select';
  }

  // 5. drop redundant StaticText children
  const pruned = removeRedundantStaticTextChildren(node, cleanedChildren);
  if (!pruned.length && (node.role === 'generic' || node.role === 'none')) {
    return null;
  }

  // 6. return updated node
  return { ...node, children: pruned };
}

/**
 * Convert a flat array of AccessibilityNodes into a cleaned, hierarchical tree.
 * Chrome extension implementation using browser-use DOM traversal.
 */
export async function buildHierarchicalTree(
  nodes: AccessibilityNode[],
  tagNameMap: Record<EncodedId, string>,
  logger?: (l: LogLine) => void,
  xpathMap?: Record<EncodedId, string>
): Promise<TreeResult> {
  // Use browser-use approach adapted for Stagehand
  try {
    // Build tree structure from flat nodes list
    const nodeMap = new Map<string, AccessibilityNode>();
    const rootNodes: AccessibilityNode[] = [];
    const iframeList: AccessibilityNode[] = [];
    const idToUrl: Record<EncodedId, string> = {};

    // First pass: create node map
    for (const node of nodes) {
      if (node.nodeId) {
        nodeMap.set(node.nodeId, { ...node });

        // Track iframes
        if (node.role === 'Iframe') {
          iframeList.push(node);
        }

        // Extract URLs if available
        const url = extractUrlFromAXNode(node);
        const extendedNode = node as AccessibilityNode & { encodedId?: EncodedId };
        if (url && extendedNode.encodedId) {
          idToUrl[extendedNode.encodedId] = url;
        }
      }
    }

    // Second pass: build parent-child relationships
    for (const node of nodes) {
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        const current = nodeMap.get(node.nodeId || '');
        if (parent && current) {
          if (!parent.children) parent.children = [];
          parent.children.push(current);
        }
      } else if (node.nodeId) {
        // Root node
        const rootNode = nodeMap.get(node.nodeId);
        if (rootNode) rootNodes.push(rootNode);
      }
    }

    // Third pass: clean structural nodes
    const cleanedRoots = (
      await Promise.all(
        rootNodes.map(n =>
          cleanStructuralNodes(
            n as AccessibilityNode & { encodedId?: EncodedId },
            tagNameMap,
            logger
          )
        )
      )
    ).filter(Boolean) as AccessibilityNode[];

    // Generate simplified outline
    const simplified = cleanedRoots.map(formatSimplifiedTree).join('\n');

    return {
      tree: cleanedRoots,
      simplified,
      iframes: iframeList,
      idToUrl,
      xpathMap: xpathMap || {},
    };
  } catch (error) {
    logger?.({
      category: 'observation',
      message: `Error building hierarchical tree: ${error}`,
      level: 1,
    });

    return {
      tree: [],
      simplified: '',
      iframes: [],
      idToUrl: {},
      xpathMap: xpathMap || {},
    };
  }
}

/**
 * Resolve the frame identifier for a Chrome extension Frame.
 * Chrome extension implementation - simplified version.
 */
export async function getCDPFrameId(
  sp: ChromeExtensionStagehandPage,
  frame?: Frame
): Promise<string | undefined> {
  if (!frame) return undefined;

  // For Chrome extension, we use a simplified approach
  try {
    const frameUrl = frame.url();
    const frameId = await sp.page.evaluate((frameUrl: string) => {
      // Try to find frame by URL matching
      const frames = Array.from(document.querySelectorAll('iframe'));
      for (let i = 0; i < frames.length; i++) {
        const iframe = frames[i];
        if (iframe.src === frameUrl || iframe.contentWindow?.location.href === frameUrl) {
          return `frame-${i}`;
        }
      }
      return `frame-unknown`;
    }, frameUrl);

    return frameId;
  } catch (error) {
    return undefined;
  }
}

/**
 * Retrieve and build a cleaned accessibility tree for a document.
 * Chrome extension implementation using browser-use approach.
 */
export async function getAccessibilityTree(
  experimental: boolean,
  stagehandPage: ChromeExtensionStagehandPage,
  logger?: (logLine: LogLine) => void,
  selector?: string,
  _shouldScreenshot?: boolean
): Promise<TreeResult> {
  try {
    // 0. DOM helpers (maps, xpath)
    const backendIdMapsResult = await buildBackendIdMaps(
      experimental,
      stagehandPage,
      undefined // targetFrame not used in Chrome extension implementation
    );

    if (!backendIdMapsResult) {
      throw new Error('buildBackendIdMaps returned null or undefined');
    }

    const { tagNameMap, xpathMap } = backendIdMapsResult;

    // 1. Use page.evaluate to get accessibility tree from browser
    const axResult = await stagehandPage.page.evaluate((selectorParam?: string) => {
      // Check for fallback function first
      if (typeof window.__stagehand_fallback_buildHierarchicalTree === 'function') {
        // Get all elements for accessibility tree
        const elements = Array.from(document.querySelectorAll('*'));
        return window.__stagehand_fallback_buildHierarchicalTree(elements, {
          decorateScrollable: true,
        });
      }

      // Fallback: build basic accessibility tree
      // const nodes: AccessibilityNode[] = [];
      let nodeId = 0;

      function processElement(element: Element, parentId?: string): AccessibilityNode {
        const id = `${nodeId++}`;
        const role = element.getAttribute('role') || getImplicitRole(element);

        const node: AccessibilityNode = {
          nodeId: id,
          role: role,
          name: getAccessibleName(element),
          parentId: parentId,
          children: [],
        };

        // Process children
        const childElements = Array.from(element.children);
        for (const child of childElements) {
          const childNode = processElement(child, id);
          if (childNode) {
            node.children?.push(childNode);
          }
        }

        return node;
      }

      function getImplicitRole(element: Element): string {
        const tagName = element.tagName.toLowerCase();
        switch (tagName) {
          case 'button':
            return 'button';
          case 'a':
            return element.hasAttribute('href') ? 'link' : 'generic';
          case 'input': {
            const type = element.getAttribute('type')?.toLowerCase() || 'text';
            switch (type) {
              case 'button':
              case 'submit':
              case 'reset':
                return 'button';
              case 'checkbox':
                return 'checkbox';
              case 'radio':
                return 'radio';
              default:
                return 'textbox';
            }
          }
          case 'textarea':
            return 'textbox';
          case 'select':
            return 'combobox';
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            return 'heading';
          case 'img':
            return 'img';
          case 'nav':
            return 'navigation';
          case 'main':
            return 'main';
          case 'article':
            return 'article';
          case 'section':
            return 'region';
          case 'aside':
            return 'complementary';
          case 'header':
            return 'banner';
          case 'footer':
            return 'contentinfo';
          case 'ul':
          case 'ol':
            return 'list';
          case 'li':
            return 'listitem';
          case 'table':
            return 'table';
          case 'tr':
            return 'row';
          case 'td':
          case 'th':
            return 'cell';
          default:
            return 'generic';
        }
      }

      function getAccessibleName(element: Element): string | undefined {
        // Check aria-label first
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        // Check aria-labelledby
        const labelledBy = element.getAttribute('aria-labelledby');
        if (labelledBy) {
          const labelElement = document.getElementById(labelledBy);
          if (labelElement) return labelElement.textContent?.trim();
        }

        // For buttons, use textContent
        if (element.tagName.toLowerCase() === 'button') {
          return element.textContent?.trim();
        }

        // For inputs, check labels
        if (element.tagName.toLowerCase() === 'input') {
          const labels = document.querySelectorAll(`label[for="${element.id}"]`);
          if (labels.length > 0) {
            return labels[0].textContent?.trim();
          }
        }

        // For images, use alt text
        if (element.tagName.toLowerCase() === 'img') {
          return element.getAttribute('alt') || undefined;
        }

        return undefined;
      }

      // Start from document body or specific selector
      let rootElement = document.body;
      if (selectorParam) {
        const selected = document.querySelector(selectorParam);
        if (selected) rootElement = selected as HTMLElement;
      }

      const rootNode = processElement(rootElement);
      return {
        tree: [rootNode],
        simplified: '',
        iframes: [],
        idToUrl: {},
        handleMap: {},
      };
    }, selector);

    // 2. Convert result to expected format
    let nodes: AccessibilityNode[] = (axResult?.tree || []) as AccessibilityNode[];

    // 3. Filter by xpath if provided
    if (selector && nodes.length > 0) {
      // For now, just use the first node if selector is provided
      nodes = [nodes[0]];
    }

    // 4. Build hierarchical tree
    const start = Date.now();
    const tree = await buildHierarchicalTree(nodes, tagNameMap, logger, xpathMap);

    logger?.({
      category: 'observation',
      message: `got accessibility tree in ${Date.now() - start} ms`,
      level: 1,
    });

    return tree;
  } catch (error) {
    logger?.({
      category: 'observation',
      message: `Error getting accessibility tree: ${error}`,
      level: 1,
    });

    return {
      tree: [],
      simplified: '',
      iframes: [],
      idToUrl: {},
      xpathMap: {},
    };
  }
}

/**
 * Chrome extension stub for frame root XPath.
 */
export async function getFrameRootXpath(frame: Frame | undefined): Promise<string> {
  if (!frame) return '/';

  // Simplified implementation for Chrome extension
  return `//iframe[@src="${frame.url() || ''}"]`;
}

/**
 * Chrome extension stub for frame root XPath with shadow DOM support.
 */
export async function getFrameRootXpathWithShadow(frame: Frame | undefined): Promise<string> {
  // For Chrome extension, same as regular version for now
  return getFrameRootXpath(frame);
}

/**
 * Retrieve and merge accessibility trees for the main document.
 * Chrome extension implementation.
 */
export async function getAccessibilityTreeWithFrames(
  experimental: boolean,
  stagehandPage: ChromeExtensionStagehandPage,
  logger: (l: LogLine) => void,
  rootXPath?: string
): Promise<CombinedA11yResult> {
  try {
    // Simplified implementation for Chrome extension
    const tree = await getAccessibilityTree(experimental, stagehandPage, logger, rootXPath);

    return {
      combinedTree: tree.simplified,
      combinedXpathMap: tree.xpathMap || {},
      combinedUrlMap: tree.idToUrl || {},
    };
  } catch (error) {
    logger({
      category: 'observation',
      message: `Error getting accessibility tree with frames: ${error}`,
      level: 1,
    });

    return {
      combinedTree: '',
      combinedXpathMap: {},
      combinedUrlMap: {},
    };
  }
}

/**
 * Helper functions
 */

/**
 * Collapse consecutive whitespace characters into single ASCII spaces.
 */
function normaliseSpaces(s: string): string {
  let out = '';
  let inWs = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    const isWs = ch === 32 || ch === 9 || ch === 10 || ch === 13;

    if (isWs) {
      if (!inWs) {
        out += ' ';
        inWs = true;
      }
    } else {
      out += s[i];
      inWs = false;
    }
  }

  return out;
}

/**
 * Remove StaticText children whose combined text matches the parent's accessible name.
 */
function removeRedundantStaticTextChildren(
  parent: AccessibilityNode,
  children: AccessibilityNode[]
): AccessibilityNode[] {
  if (!parent.name) return children;

  const parentNorm = normaliseSpaces(parent.name).trim();
  let combinedText = '';

  for (const child of children) {
    if (child.role === 'StaticText' && child.name) {
      combinedText += normaliseSpaces(child.name).trim();
    }
  }

  if (combinedText === parentNorm) {
    return children.filter(c => c.role !== 'StaticText');
  }
  return children;
}

/**
 * Extract the URL string from an AccessibilityNode's properties, if present.
 */
function extractUrlFromAXNode(axNode: AccessibilityNode): string | undefined {
  if (!axNode.properties) return undefined;

  const urlProp = axNode.properties.find(prop => prop.name === 'url');
  if (urlProp && urlProp.value && typeof urlProp.value.value === 'string') {
    return urlProp.value.value.trim();
  }
  return undefined;
}

/**
 * Inject simplified subtree outlines into the main frame outline for nested iframes.
 */
export function injectSubtrees(tree: string, _idToTree: Map<EncodedId, string>): string {
  // Simplified implementation for Chrome extension
  return tree;
}

/**
 * Resolve a chain of iframe frames from an absolute XPath.
 * Chrome extension implementation.
 */
export async function resolveFrameChain(
  sp: ChromeExtensionStagehandPage,
  absPath: string
): Promise<{ frames: Frame[]; rest: string }> {
  // Simplified implementation for Chrome extension
  return {
    frames: [],
    rest: absPath,
  };
}
