/**
 * TypeScript implementation of browser-use DOM history tree processor views
 */

import type { DOMHistoryElementDict } from '../types';

/**
 * Hash of the DOM element to be used as a unique identifier
 */
export class HashedDomElement {
  branchPathHash: string;
  attributesHash: string;
  xpathHash: string;
  // textHash: string;

  constructor(branchPathHash: string, attributesHash: string, xpathHash: string) {
    this.branchPathHash = branchPathHash;
    this.attributesHash = attributesHash;
    this.xpathHash = xpathHash;
  }
}

/**
 * Represents coordinates in a 2D space
 */
export class Coordinates {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

/**
 * Represents a set of coordinates defining a rectangle
 */
export class CoordinateSet {
  topLeft: Coordinates;
  topRight: Coordinates;
  bottomLeft: Coordinates;
  bottomRight: Coordinates;
  center: Coordinates;
  width: number;
  height: number;

  constructor(
    topLeft: Coordinates,
    topRight: Coordinates,
    bottomLeft: Coordinates,
    bottomRight: Coordinates,
    center: Coordinates,
    width: number,
    height: number
  ) {
    this.topLeft = topLeft;
    this.topRight = topRight;
    this.bottomLeft = bottomLeft;
    this.bottomRight = bottomRight;
    this.center = center;
    this.width = width;
    this.height = height;
  }
}

/**
 * Information about the viewport
 */
export class ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;

  constructor(width: number, height: number, scrollX: number = 0, scrollY: number = 0) {
    this.width = width;
    this.height = height;
    this.scrollX = scrollX;
    this.scrollY = scrollY;
  }
}

/**
 * Represents a DOM element in history
 */
export class DOMHistoryElement {
  tagName: string;
  xpath: string;
  highlightIndex: number | null;
  entireParentBranchPath: string[];
  attributes: Record<string, string>;
  shadowRoot: boolean;
  cssSelector: string | null;
  pageCoordinates: CoordinateSet | null;
  viewportCoordinates: CoordinateSet | null;
  viewportInfo: ViewportInfo | null | undefined;

  constructor(
    tagName: string,
    xpath: string,
    highlightIndex: number | null,
    entireParentBranchPath: string[],
    attributes: Record<string, string>,
    shadowRoot: boolean = false,
    cssSelector: string | null = null,
    pageCoordinates: CoordinateSet | null = null,
    viewportCoordinates: CoordinateSet | null = null,
    viewportInfo: ViewportInfo | null | undefined = null
  ) {
    this.tagName = tagName;
    this.xpath = xpath;
    this.highlightIndex = highlightIndex;
    this.entireParentBranchPath = entireParentBranchPath;
    this.attributes = attributes;
    this.shadowRoot = shadowRoot;
    this.cssSelector = cssSelector;
    this.pageCoordinates = pageCoordinates;
    this.viewportCoordinates = viewportCoordinates;
    this.viewportInfo = viewportInfo;
  }

  /**
   * Convert the DOM history element to a plain object
   */
  toDict(): DOMHistoryElementDict {
    return {
      tag_name: this.tagName,
      xpath: this.xpath,
      highlight_index: this.highlightIndex,
      entire_parent_branch_path: this.entireParentBranchPath,
      attributes: this.attributes,
      shadow_root: this.shadowRoot,
      css_selector: this.cssSelector,
      page_coordinates: this.pageCoordinates
        ? {
            top_left: { x: this.pageCoordinates.topLeft.x, y: this.pageCoordinates.topLeft.y },
            top_right: { x: this.pageCoordinates.topRight.x, y: this.pageCoordinates.topRight.y },
            bottom_left: {
              x: this.pageCoordinates.bottomLeft.x,
              y: this.pageCoordinates.bottomLeft.y,
            },
            bottom_right: {
              x: this.pageCoordinates.bottomRight.x,
              y: this.pageCoordinates.bottomRight.y,
            },
            center: { x: this.pageCoordinates.center.x, y: this.pageCoordinates.center.y },
            width: this.pageCoordinates.width,
            height: this.pageCoordinates.height,
          }
        : null,
      viewport_coordinates: this.viewportCoordinates
        ? {
            top_left: {
              x: this.viewportCoordinates.topLeft.x,
              y: this.viewportCoordinates.topLeft.y,
            },
            top_right: {
              x: this.viewportCoordinates.topRight.x,
              y: this.viewportCoordinates.topRight.y,
            },
            bottom_left: {
              x: this.viewportCoordinates.bottomLeft.x,
              y: this.viewportCoordinates.bottomLeft.y,
            },
            bottom_right: {
              x: this.viewportCoordinates.bottomRight.x,
              y: this.viewportCoordinates.bottomRight.y,
            },
            center: { x: this.viewportCoordinates.center.x, y: this.viewportCoordinates.center.y },
            width: this.viewportCoordinates.width,
            height: this.viewportCoordinates.height,
          }
        : null,
      viewport_info: this.viewportInfo
        ? {
            scroll_x: this.viewportInfo.scrollX,
            scroll_y: this.viewportInfo.scrollY,
            width: this.viewportInfo.width,
            height: this.viewportInfo.height,
          }
        : null,
    };
  }
}
