/**
 * Navigation history tracker for MAIN world context.
 * Tracks same-document navigation events (pushState, replaceState, popstate, hashchange)
 * that chrome.webNavigation API doesn't catch.
 */

export {}; // Ensure this file is treated as a module

import { HandleManager } from '@shared/utils/handleManager';
import { createStagehandAdapter, type StagehandCordycepsAdapter } from './stagehandAdapter';
import { HandledInjectedScript } from './handledInjectedScript';
import { initializeStagehandFallbacks } from './stagehandFallbacks';
import './browserUse.js';
import './stagehand.js';

declare global {
  interface Window {
    __cordyceps_historyTracker?: HistoryTracker;
    __cordyceps_handleManager_main?: HandleManager;
    __stagehandCordycepsAdapter_main?: StagehandCordycepsAdapter;
    __handledInjectedScript_main?: HandledInjectedScript;
    __cordyceps_handledInjectedScript?: HandledInjectedScript;

    // BrowserUse DOM tree functionality
    __cordyceps_buildDomTree?: (args?: {
      doHighlightElements?: boolean;
      focusHighlightIndex?: number;
      viewportExpansion?: number;
      debugMode?: boolean;
    }) => { rootId: string; map: Record<string, unknown> };

    // Expose Stagehand adapter methods to MAIN world
    __cordyceps_main_getScrollableXPaths?: (topN?: number) => Promise<string[]>;
    __cordyceps_main_generateXPathsForElement?: (element: Element) => Promise<string[]>;
    __cordyceps_main_getElementByXPath?: (xpath: string) => Element | null;
    __cordyceps_main_interactWithElement?: (
      xpath: string,
      action: 'click' | 'fill' | 'type' | 'scroll',
      options?: Record<string, unknown>
    ) => Promise<{ success: boolean; error?: string; handle?: string }>;

    // Expose HandledInjectedScript methods to MAIN world
    __cordyceps_main_querySelector?: (
      selector: string,
      root?: Node,
      strict?: boolean
    ) => string | null;
    __cordyceps_main_querySelectorAll?: (selector: string, root?: Node) => string[];
    __cordyceps_main_getElementByHandle?: (handle: string) => Element | undefined;
    __cordyceps_main_getHandleForElement?: (element: Element) => string;
    __cordyceps_main_clickElement?: (handle: string) => { success: boolean; error?: string };
    __cordyceps_main_tapElement?: (handle: string) => { success: boolean; error?: string };
    __cordyceps_main_getBoundingBox?: (
      handle: string
    ) => { x: number; y: number; width: number; height: number } | null;
    __cordyceps_main_isChecked?: (handle: string) => boolean;
    __cordyceps_main_setChecked?: (
      handle: string,
      state: boolean
    ) => { success: boolean; error?: string; needsClick: boolean; currentState: boolean };
    __cordyceps_main_dispatchEvent?: (
      handle: string,
      type: string,
      eventInit?: Record<string, unknown>
    ) => { success: boolean; error?: string };

    // Stagehand fallback test functions
    __stagehand_runFallbackTests?: () => Promise<{
      success: boolean;
      results: Record<string, { success: boolean; result?: unknown; error?: string }>;
    }>;
    __stagehand_quickFallbackTest?: () => Promise<boolean>;
    __stagehand_testHandleIntegration?: () => Promise<{
      success: boolean;
      handlesCreated: number;
      handlesRetrieved: number;
      elementsProcessed: number;
    }>;
  }
}

interface NavigationEventDetail {
  type: 'pushState' | 'replaceState' | 'popstate' | 'hashchange';
  url: string;
  timestamp: number;
}

class HistoryTracker {
  private _isInstalled = false;

  constructor() {
    this.install();
  }

  install(): void {
    if (this._isInstalled) return;
    this._isInstalled = true;

    // Hook history.pushState
    const originalPushState = history.pushState;
    history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
      const result = originalPushState.call(this, state, title, url);
      const finalUrl = url ? String(url) : location.href;
      HistoryTracker.dispatchNavigationEvent('pushState', finalUrl);
      return result;
    };

    // Hook history.replaceState
    const originalReplaceState = history.replaceState;
    history.replaceState = function (state: unknown, title: string, url?: string | URL | null) {
      const result = originalReplaceState.call(this, state, title, url);
      const finalUrl = url ? String(url) : location.href;
      HistoryTracker.dispatchNavigationEvent('replaceState', finalUrl);
      return result;
    };

    // Listen for popstate events (back/forward button, history.back/forward calls)
    window.addEventListener(
      'popstate',
      () => {
        HistoryTracker.dispatchNavigationEvent('popstate', location.href);
      },
      { passive: true }
    );

    // Listen for hashchange events
    window.addEventListener(
      'hashchange',
      () => {
        HistoryTracker.dispatchNavigationEvent('hashchange', location.href);
      },
      { passive: true }
    );

    console.debug('🔗 Navigation history hooks installed in MAIN world');
  }

  private static dispatchNavigationEvent(type: string, url: string): void {
    // Dispatch on document so ISOLATED world can listen
    document.dispatchEvent(
      new CustomEvent('__cordyceps:navigation', {
        detail: {
          type,
          url,
          timestamp: performance.now(),
        } as NavigationEventDetail,
      })
    );
  }

  get isInstalled(): boolean {
    return this._isInstalled;
  }
}

function bootstrapHandleManager(): HandleManager {
  if (window.__cordyceps_handleManager_main) return window.__cordyceps_handleManager_main;

  const handleManager = new HandleManager();
  window.__cordyceps_handleManager_main = handleManager;
  return handleManager;
}

function bootstrapHistoryTracker(): HistoryTracker {
  if (window.__cordyceps_historyTracker) return window.__cordyceps_historyTracker;

  const tracker = new HistoryTracker();
  window.__cordyceps_historyTracker = tracker;
  return tracker;
}

function bootstrapHandledInjectedScript(handleManager: HandleManager): HandledInjectedScript {
  if (window.__handledInjectedScript_main) return window.__handledInjectedScript_main;

  const handledInjectedScript = new HandledInjectedScript(
    window,
    false, // isUnderTest
    'javascript', // sdkLanguage
    'data-testid', // testIdAttributeName
    2, // stableRafCount
    'chromium', // browserName
    [], // customEngines
    handleManager
  );

  window.__handledInjectedScript_main = handledInjectedScript;
  window.__cordyceps_handledInjectedScript = handledInjectedScript;
  return handledInjectedScript;
}

async function bootstrapStagehandAdapter(
  handleManager: HandleManager
): Promise<StagehandCordycepsAdapter | null> {
  // eslint-disable-next-line max-len
  console.log(
    `[bootstrapStagehandAdapter] Starting adapter bootstrap with stagehand availability check ######`
  );
  // eslint-disable-next-line max-len
  console.log(
    `[bootstrapStagehandAdapter] Window.__stagehandInjected: ${!!window.__stagehandInjected} ######`
  );
  const w = window as unknown as Record<string, unknown>;
  // eslint-disable-next-line max-len
  console.log(
    `[bootstrapStagehandAdapter] generateXPathsForElement: ${typeof w.generateXPathsForElement} ######`
  );
  // eslint-disable-next-line max-len
  console.log(
    `[bootstrapStagehandAdapter] getScrollableElementXpaths: ${typeof w.getScrollableElementXpaths} ######`
  );

  if (window.__stagehandCordycepsAdapter_main) return window.__stagehandCordycepsAdapter_main;

  try {
    const adapter = createStagehandAdapter(handleManager, {
      debug: true,
      maxScrollableElements: 10,
      shadowDOMSupport: true,
    });

    const initialized = await adapter.initialize();

    if (initialized) {
      window.__stagehandCordycepsAdapter_main = adapter;
      console.log('🎭 StagehandCordycepsAdapter initialized in MAIN world');
      return adapter;
    } else {
      console.warn('⚠️ Failed to initialize StagehandCordycepsAdapter in MAIN world');
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating StagehandCordycepsAdapter in MAIN world:', error);
    return null;
  }
}

const loader = async (): Promise<void> => {
  // Initialize handle manager for MAIN world
  const handleManager = bootstrapHandleManager();

  // Initialize history tracker following the bootstrap pattern
  const historyTracker = bootstrapHistoryTracker();

  // Initialize HandledInjectedScript for DOM operations
  const handledInjectedScript = bootstrapHandledInjectedScript(handleManager);

  // BrowserUse script functionality is loaded via import
  console.log('🌳 BrowserUse DOM tree functionality loaded');

  // Initialize Stagehand adapter
  const stagehandAdapter = await bootstrapStagehandAdapter(handleManager);

  // Initialize Stagehand fallbacks for CDP functions
  try {
    initializeStagehandFallbacks(handleManager);
    console.log('🔧 Stagehand CDP fallbacks initialized with test functions');
  } catch (error) {
    console.error('❌ Failed to initialize Stagehand fallbacks:', error);
  }

  console.log('🔧 Content cordyceps main loaded with:', {
    historyTracker,
    handleManager,
    handledInjectedScript,
    stagehandAdapter: !!stagehandAdapter,
    browserUse: !!window.__cordyceps_buildDomTree,
  });

  // Expose HandledInjectedScript methods to MAIN world for cross-world communication
  window.__cordyceps_main_querySelector = (selector: string, root?: Node, strict = false) => {
    try {
      const parsedSelector = handledInjectedScript.parseSelector(selector);
      return handledInjectedScript.querySelector(parsedSelector, root || document, strict);
    } catch (error) {
      console.error('Error in querySelector:', error);
      return null;
    }
  };

  window.__cordyceps_main_querySelectorAll = (selector: string, root?: Node) => {
    try {
      const parsedSelector = handledInjectedScript.parseSelector(selector);
      return handledInjectedScript.querySelectorAll(parsedSelector, root || document);
    } catch (error) {
      console.error('Error in querySelectorAll:', error);
      return [];
    }
  };

  window.__cordyceps_main_getElementByHandle = (handle: string) => {
    return handledInjectedScript.getElementByHandle(handle);
  };

  window.__cordyceps_main_getHandleForElement = (element: Element) => {
    return handledInjectedScript.getHandleForElement(element);
  };

  window.__cordyceps_main_clickElement = (handle: string) => {
    return handledInjectedScript.clickElement(handle);
  };

  window.__cordyceps_main_tapElement = (handle: string) => {
    return handledInjectedScript.tapElement(handle);
  };

  window.__cordyceps_main_getBoundingBox = (handle: string) => {
    return handledInjectedScript.getBoundingBox(handle);
  };

  window.__cordyceps_main_isChecked = (handle: string) => {
    return handledInjectedScript.isChecked(handle);
  };

  window.__cordyceps_main_setChecked = (handle: string, state: boolean) => {
    return handledInjectedScript.setChecked(handle, state);
  };

  window.__cordyceps_main_dispatchEvent = (
    handle: string,
    type: string,
    eventInit: Record<string, unknown> = {}
  ) => {
    return handledInjectedScript.dispatchEvent(handle, type, eventInit);
  };

  // Expose Stagehand adapter methods to MAIN world for cross-world communication
  if (stagehandAdapter) {
    window.__cordyceps_main_getScrollableXPaths = async (topN?: number) => {
      return await stagehandAdapter.getScrollableElementXpaths(topN);
    };

    window.__cordyceps_main_generateXPathsForElement = async (element: Element) => {
      const result = await stagehandAdapter.generateXPathsForElement(element);
      return result.xpaths;
    };

    window.__cordyceps_main_getElementByXPath = (xpath: string) => {
      const node = stagehandAdapter.getNodeFromXPath(xpath);
      return node instanceof Element ? node : null;
    };

    window.__cordyceps_main_interactWithElement = async (
      xpath: string,
      action: 'click' | 'fill' | 'type' | 'scroll',
      options: Record<string, unknown> = {}
    ) => {
      return await stagehandAdapter.interactWithElementByXPath(xpath, action, options);
    };

    console.log('🌐 Stagehand adapter methods exposed to MAIN world');
  }

  console.log('🎭 HandledInjectedScript methods exposed to MAIN world');
};

try {
  loader().catch(error => {
    console.error('Failed to load content cordyceps main:', error);
  });
} catch (error) {
  console.error('Synchronous error in content cordyceps main:', error);
}
