// Global window extensions for Stagehand
declare global {
  interface Window {
    __stagehandInjected?: boolean;
    __stagehand__?: unknown;
    getScrollableElementXpaths?: () => string[];
    generateXPathsForElement?: (element: Element) => string[];
  }
}

export {};
