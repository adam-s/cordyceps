import { Disposable } from 'vs/base/common/lifecycle';
import { Frame, NavigationAbortedError } from './frame';
import { Progress } from './core/progress';
import { Page } from './page';
import { LongStandingScope, ManualPromise } from '@injected/isomorphic/manualPromise';
import { DocumentInfo } from './utilities/types';

class SignalBarrier {
  private _progress: Progress;
  private _protectCount = 0;
  private _promise = new ManualPromise<void>();

  constructor(progress: Progress) {
    this._progress = progress;
    this.retain();
  }

  waitFor(): PromiseLike<void> {
    this.release();
    return this._progress.race(this._promise);
  }

  addFrameNavigation(frame: Frame) {
    // Auto-wait top-level navigations only.
    if (frame.parentFrame()) return;
    this.retain();

    // Use the new event system instead of helper.waitForEvent
    const disposable = frame.onInternalNavigation(ev => {
      if (this._progress) {
        this._progress.log(`  navigated to "${ev.url}"`);
      }
      disposable.dispose();
      this.release();
    });

    // Ensure cleanup if frame gets detached or page gets closed
    LongStandingScope.raceMultiple(
      [frame.frameManager.page.openScope, frame._detachedScope],
      Promise.resolve() // Immediate resolution since we handle cleanup via event subscription
    )
      .catch(() => {})
      .finally(() => {
        disposable.dispose();
        this.release();
      });
  }

  retain() {
    ++this._protectCount;
  }

  release() {
    --this._protectCount;
    if (!this._protectCount) this._promise.resolve();
  }
}
export class FrameManager extends Disposable {
  private _frames = new Map<number, Frame>();
  private _mainFrame?: Frame;
  private _mainFrameResolve!: (frame: Frame) => void;
  private _mainFramePromise: Promise<Frame>;
  readonly _signalBarriers = new Set<SignalBarrier>();

  constructor(public readonly page: Page) {
    super();
    this._mainFramePromise = new Promise(resolve => (this._mainFrameResolve = resolve));
  }

  /** Tab ID for this manager */
  public get tabId(): number {
    return this.page.tabId;
  }

  dispose(): void {
    super.dispose();
  }

  public mainFrame(): Frame {
    if (!this._mainFrame) {
      throw new Error('Main frame is not yet attached.');
    }
    return this._mainFrame;
  }

  public async waitForMainFrame(progress?: Progress): Promise<Frame> {
    progress?.log('Waiting for main frame attachment');
    const frame = await (progress?.race(this._mainFramePromise) || this._mainFramePromise);
    progress?.log('Main frame attached successfully');
    return frame;
  }

  public frames() {
    const frames: Frame[] = [];
    if (this._mainFrame) {
      collect(this._mainFrame);
    }
    return frames;

    function collect(frame: Frame) {
      frames.push(frame);
      for (const subframe of frame.childFrames()) collect(subframe);
    }
  }

  public clearFrames(): void {
    // Dispose all frames except main frame
    for (const frame of this._frames.values()) {
      if (frame !== this._mainFrame) {
        frame.dispose();
      }
    }
    this._frames.clear();

    // Reset main frame if it exists
    if (this._mainFrame) {
      // Clear all child frames from main frame
      this._mainFrame.clearChildFrames();
      this._frames.set(this._mainFrame.frameId, this._mainFrame);
    }
  }

  public frame(frameId: number): Frame | null {
    const frame = this._frames.get(frameId) || null;
    return frame;
  }

  public frameAttached(
    frameId: number,
    parentFrameId: number | null | undefined,
    url?: string
  ): Frame {
    // Check if frame already exists
    const existingFrame = this._frames.get(frameId);
    if (existingFrame) {
      // Update URL if provided
      if (url) {
        existingFrame.setUrl(url);
      }
      return existingFrame;
    }

    const isMainFrame =
      parentFrameId === null || parentFrameId === undefined || parentFrameId === -1;
    if (isMainFrame) {
      return this._attachMainFrame(frameId, url);
    }
    return this._attachChildFrame(frameId, parentFrameId, url);
  }

  private _attachMainFrame(frameId: number, url?: string): Frame {
    if (this._mainFrame) {
      // If it's the same frame ID, just update the URL and return existing frame
      if (this._mainFrame.frameId === frameId) {
        if (url) {
          this._mainFrame.setUrl(url);
        }
        return this._mainFrame;
      }

      // Different frame ID - dispose old frame and create new promise
      this._mainFrame.dispose();
      this._frames.delete(this._mainFrame.frameId);
      // Create a new promise for the new main frame
      this._mainFramePromise = new Promise(resolve => (this._mainFrameResolve = resolve));
    }

    // Create a new main frame
    this._mainFrame = this._register(new Frame(frameId, this, null, url));
    this._mainFrameResolve(this._mainFrame);

    this._frames.set(frameId, this._mainFrame);

    // Create execution context immediately for main frame
    this.page.createExecutionContext(this._mainFrame);

    // If we're on an already-loaded page, mark the load event as fired
    this._mainFrame._markAlreadyLoadedPage();

    return this._mainFrame;
  }

  private _attachChildFrame(frameId: number, parentFrameId: number, url?: string): Frame {
    const parentFrame = this._frames.get(parentFrameId);

    // If parent frame doesn't exist, this could be due to timing issues or API inconsistencies
    if (parentFrame === undefined) {
      throw new Error(
        `Parent frame ${parentFrameId} not found when attaching child frame ${frameId}`
      );
    }

    // Normal case: parent frame exists
    // Double-check frame doesn't exist (should be caught by frameAttached, but defensive)
    if (this._frames.has(frameId)) {
      throw new Error(`Frame ${frameId} already exists`);
    }

    const frame = this._register(new Frame(frameId, this, parentFrame, url));
    this._frames.set(frameId, frame);

    this.page.createExecutionContext(frame);

    // Emit FrameAttached event similar to Playwright
    this.page._fireFrameAttached(frame);

    return frame;
  }

  async waitForSignalsCreatedBy<T>(
    progress: Progress,
    waitAfter: boolean,
    action: () => Promise<T>
  ): Promise<T> {
    if (!waitAfter) return action();
    const barrier = new SignalBarrier(progress);
    this._signalBarriers.add(barrier);
    progress.cleanupWhenAborted(() => this._signalBarriers.delete(barrier));
    const result = await action();
    // await progress.race(this.page.delegate.inputActionEpilogue());
    await barrier.waitFor();
    this._signalBarriers.delete(barrier);
    // Resolve in the next task, after all waitForNavigations.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    return result;
  }

  frameWillPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers) barrier.retain();
  }

  frameDidPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers) barrier.release();
  }

  frameRequestedNavigation(frameId: number, documentId?: string) {
    const frame = this._frames.get(frameId);
    if (!frame) return;
    for (const barrier of this._signalBarriers) barrier.addFrameNavigation(frame);
    if (frame.pendingDocument() && frame.pendingDocument()!.documentId === documentId) {
      // Do not override request with undefined.
      return;
    }

    // Network tracking has been removed - no longer track inflight requests
    const request = undefined;
    frame.setPendingDocument({ documentId, request });
  }

  frameCommittedNewDocumentNavigation(
    frameId: number,
    url: string,
    name: string,
    documentId: string,
    initial: boolean
  ) {
    const frame = this._frames.get(frameId)!;
    this.removeChildFramesRecursively(frame);
    frame.setUrl(url);
    frame.setName(name);

    let keepPending: DocumentInfo | undefined;
    const pendingDocument = frame.pendingDocument();
    if (pendingDocument) {
      if (pendingDocument.documentId === undefined) {
        // Pending with unknown documentId - assume it is the one being committed.
        pendingDocument.documentId = documentId;
      }
      if (pendingDocument.documentId === documentId) {
        // Committing a pending document.
        frame._currentDocument = pendingDocument;
      } else {
        // Sometimes, we already have a new pending when the old one commits.
        // An example would be Chromium error page followed by a new navigation request,
        // where the error page commit arrives after Network.requestWillBeSent for the
        // new navigation.
        // We commit, but keep the pending request since it's not done yet.
        keepPending = pendingDocument;
        frame._currentDocument = { documentId, request: undefined };
      }
      frame.setPendingDocument(undefined);
    } else {
      // No pending - just commit a new document.
      frame._currentDocument = { documentId, request: undefined };
    }

    frame._onClearLifecycle();
    frame._fireInternalNavigation(url, name, frame._currentDocument, undefined, true);
    if (!initial) {
      this.page.frameNavigatedToNewDocument(frame);
    }
    // Restore pending if any - see comments above about keepPending.
    frame.setPendingDocument(keepPending);
  }

  removeChildFramesRecursively(frame: Frame) {
    for (const child of frame.childFrames()) this._removeFramesRecursively(child);
  }

  private _removeFramesRecursively(frame: Frame) {
    this.removeChildFramesRecursively(frame);
    frame._onDetached();
    this._frames.delete(frame.frameId);
    if (!this.page.isClosed()) this.page._fireFrameDetached(frame);
  }

  frameCommittedSameDocumentNavigation(frameId: number, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame) return;
    const pending = frame.pendingDocument();
    if (pending && pending.documentId === undefined && pending.request === undefined) {
      // WebKit has notified about the same-document navigation being requested, so clear it.
      frame.setPendingDocument(undefined);
    }
    frame.setUrl(url);
    frame._fireInternalNavigation(url, frame.name(), undefined, undefined, true);
  }

  frameAbortedNavigation(frameId: number, errorText: string, documentId?: string) {
    const frame = this._frames.get(frameId);
    if (!frame || !frame.pendingDocument()) return;
    if (documentId !== undefined && frame.pendingDocument()!.documentId !== documentId) return;

    const error = new NavigationAbortedError(documentId, errorText);
    const isPublic = !(documentId && frame._redirectedNavigations.has(documentId));

    frame.setPendingDocument(undefined);
    frame._fireInternalNavigation(
      frame.url() || '',
      frame.name(),
      frame.pendingDocument(),
      error,
      isPublic
    );
  }
}
