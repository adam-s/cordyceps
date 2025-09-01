import { ManualPromise } from '@injected/isomorphic/manualPromise';
import { Progress } from '../core/progress';
import { Disposable } from 'vs/base/common/lifecycle';

/**
 * Simple readiness barrier that waits for content script navigation events
 * instead of complex network request tracking. This is much more reliable
 * as it indicates that both MAIN and ISOLATED contexts are ready.
 */
export class ContentScriptReadinessBarrier extends Disposable {
  private _readyPromise: ManualPromise<void> | null = null;
  private _isReady = false;

  constructor(
    public readonly frameId: number,
    public readonly tabId: number
  ) {
    super();
    this._readyPromise = new ManualPromise<void>();
  }

  /**
   * Mark this frame as ready (called when CRX_DEEP_RESEARCH_NAVIGATION_EVENT is received)
   */
  markReady(): void {
    if (this._isReady) {
      return;
    }

    this._isReady = true;
    if (this._readyPromise) {
      this._readyPromise.resolve();
    }
  }

  /**
   * Check if the frame is already ready
   */
  isReady(): boolean {
    return this._isReady;
  }

  /**
   * Reset barrier to not-ready state for new navigation
   * CRITICAL: Fixes barrier reuse race condition
   */
  reset(): void {
    try {
      this._isReady = false;
      if (this._readyPromise) {
        try {
          this._readyPromise.reject(new Error('Barrier reset for new navigation'));
        } catch (error) {
          // Promise might already be resolved/rejected - this is safe to ignore
        }
      }
      this._readyPromise = new ManualPromise<void>();
    } catch (error) {
      // Force fresh state even if error occurred
      this._isReady = false;
      this._readyPromise = new ManualPromise<void>();
    }
  }

  /**
   * Wait for the frame to be ready with optional timeout via Progress
   */
  async waitForReady(progress?: Progress): Promise<void> {
    if (this._isReady) {
      return;
    }

    if (!this._readyPromise) {
      this._readyPromise = new ManualPromise<void>();
    }

    if (progress) {
      return await progress.race(this._readyPromise);
    } else {
      return await this._readyPromise;
    }
  }

  dispose(): void {
    this._readyPromise?.reject(new Error('ContentScriptReadinessBarrier disposed'));
    super.dispose();
  }
}

/**
 * Manager for content script readiness barriers across frames and tabs
 */
export class ContentScriptReadinessManager extends Disposable {
  private static _instance: ContentScriptReadinessManager | null = null;

  private readonly _barriers = new Map<string, ContentScriptReadinessBarrier>();
  private readonly _frameLifecycle = new Map<string, { created: number; lastSeen: number }>();
  private _cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this._setupNavigationListener();
    this._setupFrameLifecycleTracking();
    this._startPeriodicCleanup();
  }

  public static getInstance(): ContentScriptReadinessManager {
    if (!ContentScriptReadinessManager._instance) {
      ContentScriptReadinessManager._instance = new ContentScriptReadinessManager();
    }
    return ContentScriptReadinessManager._instance;
  }

  /**
   * Get or create a barrier for a specific frame
   */
  getBarrier(tabId: number, frameId: number): ContentScriptReadinessBarrier {
    const key = `${tabId}:${frameId}`;

    // Track frame activity
    this._trackFrameActivity(tabId, frameId);

    let barrier = this._barriers.get(key);
    if (!barrier) {
      barrier = this._register(new ContentScriptReadinessBarrier(frameId, tabId));
      this._barriers.set(key, barrier);
    }

    return barrier;
  }

  /**
   * Reset a barrier to not-ready state for new navigation
   * CRITICAL: Fixes barrier reuse race condition
   */
  resetBarrier(tabId: number, frameId: number): void {
    const key = `${tabId}:${frameId}`;

    const barrier = this._barriers.get(key);
    if (barrier) {
      barrier.reset();
    }
  }

  /**
   * Remove barrier for a frame (cleanup)
   */
  removeBarrier(tabId: number, frameId: number): void {
    const key = `${tabId}:${frameId}`;
    const barrier = this._barriers.get(key);
    if (barrier) {
      barrier.dispose();
      this._barriers.delete(key);
    }
  }

  /**
   * Remove all barriers for a tab (when tab is closed)
   */
  removeTabBarriers(tabId: number): void {
    const keysToRemove: string[] = [];
    for (const [key, barrier] of this._barriers) {
      if (key.startsWith(`${tabId}:`)) {
        barrier.dispose();
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => this._barriers.delete(key));
  }

  /**
   * Clean up a specific frame barrier (internal method)
   */
  private _cleanupFrameBarrier(tabId: number, frameId: number, _reason: string): void {
    const key = `${tabId}:${frameId}`;
    const barrier = this._barriers.get(key);
    if (barrier) {
      barrier.dispose();
      this._barriers.delete(key);
    }

    // Also clean up lifecycle tracking
    this._frameLifecycle.delete(key);
  }

  /**
   * Track frame creation and update last seen timestamp
   */
  private _trackFrameActivity(tabId: number, frameId: number): void {
    const key = `${tabId}:${frameId}`;
    const now = Date.now();
    const existing = this._frameLifecycle.get(key);

    if (!existing) {
      this._frameLifecycle.set(key, { created: now, lastSeen: now });
    } else {
      existing.lastSeen = now;
    }
  }

  /**
   * Set up frame lifecycle tracking using Chrome APIs
   */
  private _setupFrameLifecycleTracking(): void {
    if (chrome.webNavigation) {
      // Track when frames are committed (created/navigated)
      chrome.webNavigation.onCommitted?.addListener(details => {
        this._trackFrameActivity(details.tabId, details.frameId);
      });

      // Track when frames encounter errors
      chrome.webNavigation.onErrorOccurred?.addListener(details => {
        if (details.frameId !== 0) {
          this._cleanupFrameBarrier(
            details.tabId,
            details.frameId,
            `navigation error: ${details.error}`
          );
        }
      });

      // Track when frames are about to navigate (potential destruction)
      chrome.webNavigation.onBeforeNavigate?.addListener(details => {
        if (details.frameId !== 0) {
          // Frame navigation event - no action needed
        }
      });

      // Track when frames are destroyed during document lifecycle
      chrome.webNavigation.onDOMContentLoaded?.addListener(details => {
        this._trackFrameActivity(details.tabId, details.frameId);
      });
    }

    // Track tab closure
    if (chrome.tabs) {
      chrome.tabs.onRemoved?.addListener(tabId => {
        this.removeTabBarriers(tabId);
      });
    }
  }

  /**
   * Start periodic cleanup of stale barriers
   */
  private _startPeriodicCleanup(): void {
    const CLEANUP_INTERVAL = 15000; // 15 seconds (more aggressive)
    const STALE_THRESHOLD = 45000; // 45 seconds (tighter threshold)
    const MAX_BARRIERS = 200; // Memory safety limit

    this._cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleFrames: string[] = [];
      const barrierCount = this._barriers.size;

      // Find stale frames
      for (const [key, lifecycle] of this._frameLifecycle) {
        if (now - lifecycle.lastSeen > STALE_THRESHOLD) {
          staleFrames.push(key);
        }
      }

      // Emergency cleanup if too many barriers exist
      if (barrierCount > MAX_BARRIERS) {
        const sortedFrames = Array.from(this._frameLifecycle.entries())
          .sort(([, a], [, b]) => a.lastSeen - b.lastSeen)
          .slice(0, barrierCount - MAX_BARRIERS + 20); // Remove oldest + buffer

        for (const [key] of sortedFrames) {
          staleFrames.push(key);
        }
      }

      // Clean up stale barriers
      if (staleFrames.length > 0) {
        for (const key of staleFrames) {
          const [tabId, frameId] = key.split(':').map(Number);
          this._cleanupFrameBarrier(tabId, frameId, 'stale frame cleanup');
        }
      }
    }, CLEANUP_INTERVAL);
  }

  private _setupNavigationListener(): void {
    // Listen for the navigation events that indicate content script is ready
    const messageListener = (
      message: { type: string; detail?: { url: string } },
      sender: chrome.runtime.MessageSender
    ) => {
      if (message.type === 'cordyceps:navigation-event') {
        const tabId = sender.tab?.id;
        const frameId = sender.frameId;

        if (tabId !== undefined && frameId !== undefined) {
          const barrier = this.getBarrier(tabId, frameId);
          barrier.markReady();
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // FRAME LIFECYCLE TRACKING: Listen for tab/frame destruction
    if (chrome.webNavigation) {
      // Track when frames are created
      chrome.webNavigation.onCommitted?.addListener(details => {
        if (details.frameId !== 0) {
          // Only track sub-frames
          this._trackFrameActivity(details.tabId, details.frameId);
        }
      });

      // Track when frames are destroyed
      chrome.webNavigation.onErrorOccurred?.addListener(details => {
        if (details.frameId !== 0) {
          this._cleanupFrameBarrier(details.tabId, details.frameId, 'navigation error');
        }
      });

      // Track when frames are removed
      chrome.webNavigation.onBeforeNavigate?.addListener(details => {
        if (details.frameId !== 0) {
          // Update activity but don't cleanup yet - wait for actual completion
          this._trackFrameActivity(details.tabId, details.frameId);
        }
      });
    }

    // Cleanup listener on dispose
    this._register({
      dispose: () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      },
    });
  }

  dispose(): void {
    // Stop periodic cleanup timer
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }

    // Dispose all barriers
    for (const barrier of this._barriers.values()) {
      try {
        barrier.dispose();
      } catch (error) {
        // Error disposing barrier - continue with cleanup
      }
    }
    this._barriers.clear();

    // Clear frame lifecycle tracking
    this._frameLifecycle.clear();

    // Dispose parent (handles navigation listeners)
    super.dispose();

    // Clear singleton instance
    ContentScriptReadinessManager._instance = null;
  }
}
