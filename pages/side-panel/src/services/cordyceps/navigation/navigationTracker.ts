import { Emitter, Event } from 'vs/base/common/event';
import {
  CRX_DEEP_RESEARCH_NAVIGATION_EVENT,
  type INavigationEventMessage,
} from '@shared/utils/message';
import type { LifecycleEvent } from '../utilities/types';
import { ContentScriptReadinessManager } from './contentScriptReadiness';

export interface InternalNavigation {
  tabId: number;
  frameId: number; // 0 = top frame
  url: string;
  newDocument?: { documentId: string };
}

type FrameKey = string; // `${tabId}:${frameId}`

interface FrameState {
  tabId: number;
  frameId: number;
  url: string;
  currentDocumentId?: string;
  lifecycle: Set<LifecycleEvent>;
}

/**
 * Tracks navigation and lifecycle events using chrome.webNavigation and emits a unified
 * InternalNavigation event similar to Playwright.
 *
 * Kept as a singleton via getNavigationTracker() to avoid multiple global listeners.
 */
export class NavigationTracker {
  private readonly _frames = new Map<FrameKey, FrameState>();
  private readonly _onInternalNavigation = new Emitter<InternalNavigation>();
  public readonly onInternalNavigation: Event<InternalNavigation> =
    this._onInternalNavigation.event;

  public constructor() {
    // Listen to chrome.webNavigation events (new-document navigation)
    chrome.webNavigation.onCommitted.addListener(this._onCommitted);
    chrome.webNavigation.onDOMContentLoaded.addListener(this._onDOMContentLoaded);
    chrome.webNavigation.onCompleted.addListener(this._onCompleted);
    chrome.webNavigation.onHistoryStateUpdated.addListener(this._onSameDocument);
    chrome.webNavigation.onReferenceFragmentUpdated.addListener(this._onSameDocument);

    // Listen to navigation events from content scripts (same-document navigation)
    this._setupNavigationMessageListener();

    // Start health monitoring
    this._startHealthMonitoring();
  }

  /**
   * Monitor system health and log metrics periodically
   */
  private _startHealthMonitoring(): void {
    setInterval(() => {
      const frameCount = this._frames.size;
      const frameEntries = Array.from(this._frames.entries());
      const staleFrames = frameEntries.filter(([, state]) => !state.url).length;

      // System health warnings
      if (frameCount > 300) {
        // High frame count detected - potential memory leak
      }
      if (staleFrames > 50) {
        // Many stale frames detected - cleanup may be needed
      }
    }, 60000); // Every minute
  }

  public waitForNavigation(
    tabId: number,
    frameId = 0,
    opts?: { toUrl?: string; waitUntil?: LifecycleEvent; timeoutMs?: number }
  ): Promise<InternalNavigation> {
    const toUrl = opts?.toUrl ? normalize(opts.toUrl) : undefined;
    const waitUntil: LifecycleEvent = opts?.waitUntil ?? 'load';
    const timeoutMs = opts?.timeoutMs ?? 15000;

    const k = key(tabId, frameId);
    const st = this._ensure(k, tabId, frameId);

    return new Promise<InternalNavigation>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Navigation timeout after ${timeoutMs} ms${toUrl ? ` → ${toUrl}` : ''}`));
      }, timeoutMs);

      const listener = (ev: InternalNavigation) => {
        if (ev.tabId !== tabId || ev.frameId !== frameId) {
          return;
        }
        if (toUrl && normalize(ev.url) !== toUrl) {
          return;
        }

        this._waitForLifecycle(k, waitUntil, timeoutMs)
          .then(() => {
            cleanup();
            resolve(ev);
          })
          .catch(err => {
            cleanup();
            reject(err);
          });
      };

      const disposable = this.onInternalNavigation(listener);

      // Fast-path: already at URL and lifecycle achieved
      const nowUrl = st.url ? normalize(st.url) : undefined;

      // Only use fast-path if we have a specific toUrl requirement that matches current URL
      // This prevents resolving with stale state when a new navigation is pending
      const shouldUseFastPath = toUrl && nowUrl === toUrl && st.lifecycle.has(waitUntil);

      if (shouldUseFastPath) {
        clearTimeout(timer);
        disposable.dispose();
        resolve({
          tabId,
          frameId,
          url: st.url,
          newDocument: st.currentDocumentId ? { documentId: st.currentDocumentId } : undefined,
        });
        return;
      }

      function cleanup() {
        clearTimeout(timer);
        disposable.dispose();
      }
    });
  }

  // Event handlers ----------------------------------------------------------

  private _onCommitted = (d: chrome.webNavigation.WebNavigationTransitionCallbackDetails): void => {
    const st = this._ensure(key(d.tabId, d.frameId), d.tabId, d.frameId);
    const isCrossDoc = !!d.documentId && d.documentId !== st.currentDocumentId;

    st.url = d.url;

    if (isCrossDoc) {
      st.currentDocumentId = d.documentId!;
      st.lifecycle.clear();

      // Reset content script readiness barrier for new document to prevent race condition
      ContentScriptReadinessManager.getInstance().resetBarrier(d.tabId, d.frameId);

      this._markLifecycle(st, 'commit');
      this._onInternalNavigation.fire({
        tabId: d.tabId,
        frameId: d.frameId,
        url: d.url,
        newDocument: { documentId: d.documentId! },
      });
    } else {
      this._markLifecycle(st, 'commit');
      this._onInternalNavigation.fire({ tabId: d.tabId, frameId: d.frameId, url: d.url });
    }
  };

  private _onSameDocument = (
    d: chrome.webNavigation.WebNavigationTransitionCallbackDetails
  ): void => {
    const st = this._ensure(key(d.tabId, d.frameId), d.tabId, d.frameId);
    st.url = d.url;
    this._markLifecycle(st, 'commit');
    this._onInternalNavigation.fire({ tabId: d.tabId, frameId: d.frameId, url: d.url });
  };

  private _onDOMContentLoaded = (
    d: chrome.webNavigation.WebNavigationFramedCallbackDetails
  ): void => {
    const st = this._ensure(key(d.tabId, d.frameId), d.tabId, d.frameId);
    st.url = d.url;
    this._markLifecycle(st, 'domcontentloaded');
  };

  private _onCompleted = (d: chrome.webNavigation.WebNavigationFramedCallbackDetails): void => {
    const st = this._ensure(key(d.tabId, d.frameId), d.tabId, d.frameId);
    st.url = d.url;
    this._markLifecycle(st, 'load');
  };

  private _setupNavigationMessageListener(): void {
    const messageListener = (
      message: INavigationEventMessage,
      sender: chrome.runtime.MessageSender
    ) => {
      if (message.type === CRX_DEEP_RESEARCH_NAVIGATION_EVENT) {
        // Extract tab and frame info from sender
        const tabId = sender.tab?.id;
        const frameId = sender.frameId;

        if (tabId !== undefined && frameId !== undefined) {
          // Treat content script navigation events as same-document navigation
          const st = this._ensure(key(tabId, frameId), tabId, frameId);
          st.url = message.detail.url;
          this._markLifecycle(st, 'commit');
          this._onInternalNavigation.fire({
            tabId,
            frameId,
            url: message.detail.url,
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
  }

  // Lifecycle helpers -------------------------------------------------------

  private _waitForLifecycle(k: FrameKey, state: LifecycleEvent, timeoutMs: number): Promise<void> {
    const st = this._frames.get(k);
    if (st && st.lifecycle.has(state)) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const t = setInterval(() => {
        const s = this._frames.get(k);
        if (s && s.lifecycle.has(state)) {
          clearInterval(t);
          resolve();
          return;
        }
        const elapsed = Date.now() - start;
        if (elapsed > timeoutMs) {
          clearInterval(t);
          reject(new Error(`Timeout waiting for lifecycle "${state}"`));
        }
      }, 50);
    });
  }

  private _markLifecycle(st: FrameState, ev: LifecycleEvent): void {
    st.lifecycle.add(ev);
  }

  private _ensure(k: FrameKey, tabId: number, frameId: number): FrameState {
    let st = this._frames.get(k);
    if (!st) {
      st = { tabId, frameId, url: '', lifecycle: new Set<LifecycleEvent>() };
      this._frames.set(k, st);

      // Memory management: limit total frames tracked
      if (this._frames.size > 500) {
        const entries = Array.from(this._frames.entries());
        const toRemove = entries.slice(0, 100); // Remove oldest 100
        for (const [key] of toRemove) {
          this._frames.delete(key);
        }
      }
    }
    return st;
  }
}

// Singleton accessor to avoid duplicate listeners in the process.
let _singleton: NavigationTracker | undefined;
export function getNavigationTracker(): NavigationTracker {
  if (!_singleton) {
    _singleton = new NavigationTracker();
  }
  return _singleton;
}

function key(tabId: number, frameId: number): FrameKey {
  return `${tabId}:${frameId}`;
}

function normalize(u: string): string {
  try {
    return new URL(u, 'http://x/').href;
  } catch {
    return u;
  }
}
