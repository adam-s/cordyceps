/**
 * DOM element node type definitions
 */

export interface ElementHash {
  branchPathHash: string;
  // Add other hash properties as needed
}

export interface DOMElementNode {
  tag: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  children?: DOMElementNode[];
  index?: number;
  parent?: DOMElementNode;
  isVisible?: boolean;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  xpath?: string;
  selector?: string;
  hash?: ElementHash;
}

export interface DOMTreeOptions {
  includeAttributes?: string[];
  useHighlights?: boolean;
  includeScreenshot?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * Serialized element structure from toDict() method
 */
export interface ElementNodeDict {
  tag: string; // from toDict() method in DOMElementNode
  tag_name?: string; // for backward compatibility with existing code
  xpath: string;
  attributes?: Record<string, string>;
  highlightIndex?: number;
  parent?: ElementNodeDict;
  children?: ElementNodeDict[];
  isVisible?: boolean;
  isInteractive?: boolean;
  isTopElement?: boolean;
  isInViewport?: boolean;
  hasShadowRoot?: boolean;
  textContent?: string;
  viewportInfo?: Record<string, unknown>;
}

/**
 * Interface for element objects used in CSS selector generation
 */
export interface ElementForSelector {
  xpath: string;
  tag_name?: string;
  highlight_index?: number;
  attributes?: Record<string, string>;
}

/**
 * Union type for all possible element node representations
 * This handles the different ways elements can be passed around in the system:
 * - DOMElementNode: Class instances with tagName property
 * - ElementNodeDict: Serialized objects from toDict() with tag property
 * - ElementForSelector: Interface for CSS selector generation with tag_name property
 */
export type ElementNode = DOMElementNode | ElementNodeDict | ElementForSelector;

/**
 * Serialized representations used by history tree processor
 */
export interface CoordinateDict {
  x: number;
  y: number;
}

export interface CoordinateSetDict {
  top_left: CoordinateDict;
  top_right: CoordinateDict;
  bottom_left: CoordinateDict;
  bottom_right: CoordinateDict;
  center: CoordinateDict;
  width: number;
  height: number;
}

export interface ViewportInfoDict {
  scroll_x: number;
  scroll_y: number;
  width: number;
  height: number;
}

export interface DOMHistoryElementDict {
  tag_name: string;
  xpath: string;
  highlight_index: number | null;
  entire_parent_branch_path: string[];
  attributes: Record<string, string>;
  shadow_root: boolean;
  css_selector: string | null;
  page_coordinates: CoordinateSetDict | null;
  viewport_coordinates: CoordinateSetDict | null;
  viewport_info: ViewportInfoDict | null;
}
