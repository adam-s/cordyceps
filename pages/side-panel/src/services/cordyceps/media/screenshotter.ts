/** @file Screenshot capture + stitcher (browser only). */

import { assert } from '@injected/isomorphic/assert';
import { Page } from '../page';
import { Rect, ScreenshotOptions, Size } from '../utilities/types';
import { Progress } from '../core/progress';
import { ElementHandle } from '../elementHandle';
import { Frame } from '../frame';
import { MultiMap } from '@injected/isomorphic/multimap';
import { ParsedSelector } from '@injected/isomorphic/selectorParser';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CAPTURE_INTERVAL_MS = 700;
const MAX_CAPTURE_INTERVAL_MS = 2500;
const SEGMENT_SETTLE_DELAY_MS = 400;

// ============================================================================
// PURE UTILITIES - ENCODING
// ============================================================================

export class ScreenshotEncoding {
  static base64ToU8(input: string): Uint8Array {
    const binaryString = atob(input);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  static u8ToBase64(bytes: Uint8Array): string {
    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryString);
  }

  static dataUrl(mime: string, base64: string): string {
    return `data:${mime};base64,${base64}`;
  }

  static qualityPercent(quality?: number): number | undefined {
    return typeof quality === 'number' ? quality / 100 : undefined;
  }

  static inferMime(format: 'png' | 'jpeg'): string {
    return format === 'png' ? 'image/png' : 'image/jpeg';
  }
}

// ============================================================================
// PURE UTILITIES - GEOMETRY & MATH
// ============================================================================

export class ScreenshotMath {
  static devicePx(cssPixels: number, dpr: number): number {
    return Math.round(cssPixels * dpr);
  }

  static scaleRect(rect: Rect, dpr: number): Rect {
    return {
      x: ScreenshotMath.devicePx(rect.x, dpr),
      y: ScreenshotMath.devicePx(rect.y, dpr),
      width: ScreenshotMath.devicePx(rect.width, dpr),
      height: ScreenshotMath.devicePx(rect.height, dpr),
    };
  }

  static computeSegments(
    totalWidth: number,
    totalHeight: number,
    viewportWidth: number,
    viewportHeight: number
  ): { xSegments: number; ySegments: number } {
    return {
      xSegments: Math.ceil(totalWidth / viewportWidth),
      ySegments: Math.ceil(totalHeight / viewportHeight),
    };
  }

  static lastSegmentClamp(
    index: number,
    totalSegments: number,
    viewportSize: number,
    totalSize: number
  ): number {
    if (index === totalSegments - 1) {
      return Math.max(0, totalSize - viewportSize);
    }
    return index * viewportSize;
  }

  static clampRectToSize(rect: Rect, size: Size): Rect {
    const p1 = {
      x: Math.max(0, Math.min(rect.x, size.width)),
      y: Math.max(0, Math.min(rect.y, size.height)),
    };
    const p2 = {
      x: Math.max(0, Math.min(rect.x + rect.width, size.width)),
      y: Math.max(0, Math.min(rect.y + rect.height, size.height)),
    };
    const result = { x: p1.x, y: p1.y, width: p2.x - p1.x, height: p2.y - p1.y };
    assert(
      result.width && result.height,
      'Clipped area is either empty or outside the resulting image'
    );
    return result;
  }
}

// ============================================================================
// PURE UTILITIES - COLLECTIONS & TIMING
// ============================================================================

export class ScreenshotUtils {
  static concatU8(list: Uint8Array[]): Uint8Array {
    const total = list.reduce((n, arr) => n + arr.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const arr of list) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static nextBackoffMs(current: number): number {
    return Math.min(
      MAX_CAPTURE_INTERVAL_MS,
      Math.floor(current * 1.5) + Math.floor(Math.random() * 120)
    );
  }
}

// ============================================================================
// PURE UTILITIES - VALIDATION
// ============================================================================

// moved to PURE UTILITIES - VALIDATION near the top

// ============================================================================
// BROWSER BUFFER POLYFILL
// ============================================================================

class BrowserBuffer {
  private _data: Uint8Array;

  constructor(data: Uint8Array) {
    this._data = data;
  }

  static from(input: string, encoding: 'base64' | 'utf8' = 'utf8'): BrowserBuffer {
    let bytes: Uint8Array;
    if (encoding === 'base64') {
      bytes = ScreenshotEncoding.base64ToU8(input);
    } else {
      const encoder = new TextEncoder();
      bytes = encoder.encode(input);
    }

    const result = new BrowserBuffer(bytes);
    return result;
  }

  toString(encoding: 'base64' | 'utf8' = 'utf8'): string {
    if (encoding === 'base64') {
      const result = ScreenshotEncoding.u8ToBase64(this._data);
      return result;
    } else {
      const decoder = new TextDecoder();
      const result = decoder.decode(this._data);
      return result;
    }
  }

  get length(): number {
    return this._data.length;
  }

  // Common Buffer static methods that tests/external code might use
  static isBuffer(obj: unknown): boolean {
    return obj instanceof BrowserBuffer;
  }

  static byteLength(str: string, encoding: 'utf8' | 'base64' = 'utf8'): number {
    return BrowserBuffer.from(str, encoding)._data.length;
  }

  static concat(list: BrowserBuffer[]): BrowserBuffer {
    const arrays = list.map(b => b._data);
    const concatenated = ScreenshotUtils.concatU8(arrays);
    return new BrowserBuffer(concatenated);
  }
}

// Make a global Buffer shim for browser callers/tests that expect Node's Buffer
(function ensureGlobalBuffer() {
  const g = globalThis as unknown as { Buffer?: typeof BrowserBuffer };
  if (!g.Buffer) {
    g.Buffer = BrowserBuffer;
  }
})();

// Use our polyfill instead of Node.js Buffer
const BufferPolyfill: typeof BrowserBuffer = (
  globalThis as unknown as { Buffer: typeof BrowserBuffer }
).Buffer;

// Type alias for our buffer implementation
type BufferLike = BrowserBuffer;

// ============================================================================
// BOUNDARY CODE - CANVAS HELPERS
// ============================================================================

export class ScreenshotCanvas {
  static async imageFromBase64(base64: string, mime: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image with MIME: ${mime}`));
      img.src = ScreenshotEncoding.dataUrl(mime, base64);
    });
  }

  static async canvasToBlob(
    canvas: HTMLCanvasElement,
    mime: string,
    quality?: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        mime,
        quality
      );
    });
  }

  static drawSegment(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void {
    if (dw > 0 && dh > 0) {
      ctx.drawImage(img, 0, 0, dw, dh, dx, dy, dw, dh);
    }
  }

  static async blobToBuffer(blob: Blob): Promise<BrowserBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return new BrowserBuffer(uint8Array);
  }

  /**
   * Resize an image buffer to the target size. Dimensions are provided in CSS pixels.
   * Optionally specify output format/quality and device pixel ratio.
   */
  static async resizeImageBuffer(
    buffer: BrowserBuffer,
    targetWidthCss: number,
    targetHeightCss: number,
    options: {
      sourceFormat: 'png' | 'jpeg';
      outputFormat?: 'png' | 'jpeg';
      quality?: number; // 0-100
      dpr?: number; // defaults to 1
    }
  ): Promise<BrowserBuffer> {
    const dpr = options.dpr ?? 1;
    const sourceMime = ScreenshotEncoding.inferMime(options.sourceFormat);
    const outputFormat = options.outputFormat ?? options.sourceFormat;
    const outputMime = ScreenshotEncoding.inferMime(outputFormat);
    const qualityPercent = ScreenshotEncoding.qualityPercent(options.quality);

    // Load source image from buffer
    const base64 = buffer.toString('base64');
    const img = await ScreenshotCanvas.imageFromBase64(base64, sourceMime);

    // Create canvas in device pixels
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas 2D context');

    const width = ScreenshotMath.devicePx(targetWidthCss, dpr);
    const height = ScreenshotMath.devicePx(targetHeightCss, dpr);
    canvas.width = width;
    canvas.height = height;

    // Draw scaled
    ctx.drawImage(img, 0, 0, width, height);

    // Encode
    const blob = await ScreenshotCanvas.canvasToBlob(canvas, outputMime, qualityPercent);
    return await ScreenshotCanvas.blobToBuffer(blob);
  }
}

// ============================================================================
// BOUNDARY CODE - CHROME CAPTURE WITH RATE LIMITING
// ============================================================================

class CaptureRateLimiter {
  private minIntervalMs = DEFAULT_CAPTURE_INTERVAL_MS;
  private next = 0;

  async wait(): Promise<void> {
    const now = Date.now();
    const delay = Math.max(0, this.next - now);
    if (delay) await ScreenshotUtils.sleep(delay);
    this.next = Date.now() + this.minIntervalMs;
  }

  backoff(): void {
    this.minIntervalMs = ScreenshotUtils.nextBackoffMs(this.minIntervalMs);
  }
}

const captureLimiter = new CaptureRateLimiter();

async function safeCaptureVisibleTab(
  opts: chrome.tabs.CaptureVisibleTabOptions,
  maxRetries = 4
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await captureLimiter.wait();
    try {
      return await chrome.tabs.captureVisibleTab(opts);
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      if (msg.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
        captureLimiter.backoff();
        if (attempt === maxRetries) throw err;
        // small extra wait before retrying
        await ScreenshotUtils.sleep(250 + attempt * 150);
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}

// ============================================================================
// BOUNDARY CODE - DOM IN-PAGE FUNCTIONS
// ============================================================================

declare global {
  interface Window {
    __pwCleanupScreenshot?: () => void;
    __scrollCaptureState?: {
      originalScrollX: number;
      originalScrollY: number;
      originalScrollBehavior: string;
      viewportWidth: number;
      viewportHeight: number;
    };
  }
}

function inPagePrepareForScreenshots(
  screenshotStyle: string,
  hideCaret: boolean,
  disableAnimations: boolean,
  syncAnimations: boolean
) {
  // In WebKit, sync the animations.
  if (syncAnimations) {
    const style = document.createElement('style');
    style.textContent = 'body {}';
    document.head.appendChild(style);
    document.documentElement.getBoundingClientRect();
    style.remove();
  }

  if (!screenshotStyle && !hideCaret && !disableAnimations) return;

  const collectRoots = (
    root: Document | ShadowRoot,
    roots: (Document | ShadowRoot)[] = []
  ): (Document | ShadowRoot)[] => {
    roots.push(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    do {
      const node = walker.currentNode;
      const shadowRoot = node instanceof Element ? node.shadowRoot : null;
      if (shadowRoot) collectRoots(shadowRoot, roots);
    } while (walker.nextNode());
    return roots;
  };

  const roots = collectRoots(document);
  const cleanupCallbacks: (() => void)[] = [];

  if (screenshotStyle) {
    for (const root of roots) {
      const styleTag = document.createElement('style');
      styleTag.textContent = screenshotStyle;
      if (root === document) document.documentElement.append(styleTag);
      else root.append(styleTag);

      cleanupCallbacks.push(() => {
        styleTag.remove();
      });
    }
  }

  if (hideCaret) {
    const elements = new Map<HTMLElement, { value: string; priority: string }>();
    for (const root of roots) {
      root.querySelectorAll('input,textarea,[contenteditable]').forEach(element => {
        elements.set(element as HTMLElement, {
          value: (element as HTMLElement).style.getPropertyValue('caret-color'),
          priority: (element as HTMLElement).style.getPropertyPriority('caret-color'),
        });
        (element as HTMLElement).style.setProperty('caret-color', 'transparent', 'important');
      });
    }
    cleanupCallbacks.push(() => {
      for (const [element, value] of elements)
        element.style.setProperty('caret-color', value.value, value.priority);
    });
  }

  if (disableAnimations) {
    const infiniteAnimationsToResume: Set<Animation> = new Set();
    const handleAnimations = (root: Document | ShadowRoot): void => {
      for (const animation of root.getAnimations()) {
        if (
          !animation.effect ||
          animation.playbackRate === 0 ||
          infiniteAnimationsToResume.has(animation)
        )
          continue;
        const endTime = animation.effect.getComputedTiming().endTime;
        if (Number.isFinite(endTime)) {
          try {
            animation.finish();
          } catch (e) {
            // animation.finish() should not throw for
            // finite animations, but we'd like to be on the
            // safe side.
          }
        } else {
          try {
            animation.cancel();
            infiniteAnimationsToResume.add(animation);
          } catch (e) {
            // animation.cancel() should not throw for
            // infinite animations, but we'd like to be on the
            // safe side.
          }
        }
      }
    };
    for (const root of roots) {
      const handleRootAnimations: () => void = handleAnimations.bind(null, root);
      handleRootAnimations();
      root.addEventListener('transitionrun', handleRootAnimations);
      root.addEventListener('animationstart', handleRootAnimations);
      cleanupCallbacks.push(() => {
        root.removeEventListener('transitionrun', handleRootAnimations);
        root.removeEventListener('animationstart', handleRootAnimations);
      });
    }
    cleanupCallbacks.push(() => {
      for (const animation of infiniteAnimationsToResume) {
        try {
          animation.play();
        } catch (e) {
          // animation.play() should never throw, but
          // we'd like to be on the safe side.
        }
      }
    });
  }

  window.__pwCleanupScreenshot = () => {
    for (const cleanupCallback of cleanupCallbacks) cleanupCallback();
    delete window.__pwCleanupScreenshot;
  };
}

function inPageScrollAndCapture() {
  const originalScrollX = window.scrollX;
  const originalScrollY = window.scrollY;

  // Disable smooth scrolling for faster, more predictable scrolling
  const originalScrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';

  // Get page dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const totalWidth = Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth,
    document.body.clientWidth,
    document.documentElement.clientWidth
  );
  const totalHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.body.clientHeight,
    document.documentElement.clientHeight
  );

  // Calculate segments needed (self-contained, no external references)
  const xSegments = Math.ceil(totalWidth / viewportWidth);
  const ySegments = Math.ceil(totalHeight / viewportHeight);

  // Store state in window for later use
  window.__scrollCaptureState = {
    originalScrollX,
    originalScrollY,
    originalScrollBehavior,
    viewportWidth,
    viewportHeight,
  };

  const result = {
    viewportWidth,
    viewportHeight,
    totalWidth,
    totalHeight,
    xSegments,
    ySegments,
  };

  return result;
}

function inPageScrollToSegment(xIndex: number, yIndex: number) {
  const state = window.__scrollCaptureState;
  if (!state) {
    throw new Error('Scroll capture not initialized');
  }

  // Compute page dimensions locally (no external dependencies)
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const totalWidth = Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth,
    document.body.clientWidth,
    document.documentElement.clientWidth
  );
  const totalHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.body.clientHeight,
    document.documentElement.clientHeight
  );

  const xSegments = Math.ceil(totalWidth / viewportWidth);
  const ySegments = Math.ceil(totalHeight / viewportHeight);

  // Use clamping to prevent fractional scroll positions on last segments
  const lastClamp = (index: number, totalSegs: number, viewportSize: number, totalSize: number) => {
    if (index === totalSegs - 1) return Math.max(0, totalSize - viewportSize);
    return index * viewportSize;
  };
  const x = lastClamp(xIndex, xSegments, state.viewportWidth, totalWidth);
  const y = lastClamp(yIndex, ySegments, state.viewportHeight, totalHeight);

  window.scrollTo(x, y);

  const actualPosition = {
    x: window.scrollX,
    y: window.scrollY,
    xIndex,
    yIndex,
  };

  // Return actual scroll position (might be constrained)
  return actualPosition;
}

function inPageRestoreScroll() {
  const state = window.__scrollCaptureState;
  if (!state) {
    return;
  }

  document.documentElement.style.scrollBehavior = state.originalScrollBehavior;
  window.scrollTo(state.originalScrollX, state.originalScrollY);

  // Clean up
  delete window.__scrollCaptureState;
}

// ============================================================================
// CORE SERVICES
// ============================================================================

class TaskQueue {
  private _chain: Promise<unknown>;

  constructor() {
    this._chain = Promise.resolve();
  }

  postTask<T>(task: () => T | Promise<T>): Promise<T> {
    const result = this._chain.then(task);
    this._chain = result.catch(() => {});
    return result;
  }
}

// ============================================================================
// SCREENSHOTTER CLASS - PUBLIC INTERFACE UNCHANGED
// ============================================================================

export class Screenshotter {
  private _queue: TaskQueue;
  private _page: Page;

  constructor(page: Page) {
    this._page = page;
    this._queue = new TaskQueue();
  }

  async screenshotPage(progress: Progress, options: ScreenshotOptions): Promise<BufferLike> {
    const format = validateScreenshotOptions(options);
    return this._queue.postTask(async () => {
      progress.log('taking page screenshot');
      const viewportSize = await this._originalViewportSize(progress);
      await this._preparePageForScreenshot(
        progress,
        this._page.mainFrame(),
        options.style,
        options.caret !== 'initial',
        options.animations === 'disabled'
      );
      if (options.fullPage) {
        const fullPageSize = await this._fullPageSize(progress);

        let documentRect = { x: 0, y: 0, width: fullPageSize.width, height: fullPageSize.height };
        const fitsViewport =
          fullPageSize.width <= viewportSize.width && fullPageSize.height <= viewportSize.height;
        if (options.clip) {
          documentRect = ScreenshotMath.clampRectToSize(options.clip, documentRect);
        }
        const buffer = await this._screenshot(
          progress,
          format,
          documentRect,
          undefined,
          fitsViewport,
          options
        );
        await this._restorePageAfterScreenshot();
        return buffer;
      }
      const viewportRect = options.clip
        ? ScreenshotMath.clampRectToSize(options.clip, viewportSize)
        : { x: 0, y: 0, ...viewportSize };
      const buffer = await this._screenshot(
        progress,
        format,
        undefined,
        viewportRect,
        true,
        options
      );
      await this._restorePageAfterScreenshot();
      return buffer;
    });
  }

  private async _screenshot(
    progress: Progress,
    format: 'png' | 'jpeg',
    documentRect: Rect | undefined,
    viewportRect: Rect | undefined,
    fitsViewport: boolean,
    options: ScreenshotOptions
  ): Promise<BufferLike> {
    const cleanupHighlight = await this._maskElements(progress, options);
    const quality = format === 'jpeg' ? (options.quality ?? 80) : undefined;
    const buffer = await this.takeScreenshot(
      progress,
      format,
      documentRect,
      viewportRect,
      quality,
      fitsViewport,
      options.scale || 'device'
    );
    await cleanupHighlight();
    return buffer;
  }

  async _preparePageForScreenshot(
    progress: Progress,
    frame: Frame,
    screenshotStyle: string | undefined,
    hideCaret: boolean,
    disableAnimations: boolean
  ) {
    if (disableAnimations) progress.log('  disabled all CSS animations');
    const syncAnimations = true;
    progress.cleanupWhenAborted(() => this._restorePageAfterScreenshot());
    await this._page.safeNonStallingEvaluateInAllFrames(
      inPagePrepareForScreenshots,
      'MAIN',
      {},
      screenshotStyle || '',
      hideCaret,
      disableAnimations,
      syncAnimations
    );
  }

  async _restorePageAfterScreenshot() {
    await this._page.safeNonStallingEvaluateInAllFrames(() => {
      if (window.__pwCleanupScreenshot) {
        window.__pwCleanupScreenshot();
      }
    }, 'MAIN');
  }

  async _maskElements(
    progress: Progress,
    options: ScreenshotOptions
  ): Promise<() => Promise<void>> {
    if (!options.mask || !options.mask.length) return () => Promise.resolve();

    const framesToParsedSelectors: MultiMap<Frame, ParsedSelector> = new MultiMap();

    const cleanup = async () => {
      await Promise.all(
        [...framesToParsedSelectors.keys()].map(async frame => {
          await frame.hideHighlight();
        })
      );
    };
    progress.cleanupWhenAborted(cleanup);

    await progress.race(
      Promise.all(
        (options.mask || []).map(async ({ frame, selector }) => {
          const pair = await frame.selectors.resolveFrameForSelector(selector);
          if (pair) framesToParsedSelectors.set(pair.frame, pair.info.parsed);
        })
      )
    );

    await progress.race(
      Promise.all(
        [...framesToParsedSelectors.keys()].map(async frame => {
          await frame.maskSelectors(
            framesToParsedSelectors.get(frame),
            options.maskColor || '#F0F'
          );
        })
      )
    );
    return cleanup;
  }

  async screenshotElement(
    progress: Progress,
    handle: ElementHandle,
    options: ScreenshotOptions
  ): Promise<BufferLike> {
    progress.log('taking element screenshot');

    // Ensure element is in view
    try {
      await handle.scrollIntoViewIfNeeded();
    } catch (e) {
      // Non-fatal; continue to try capture
      progress.log('warning: failed to scroll element into view');
    }

    // Get element bounding box in CSS pixels
    const box = await handle.boundingBox();
    if (!box) {
      throw new Error('Failed to capture element: element is not attached or not visible');
    }

    // Delegate to page screenshot with a clip matching the element
    const merged: ScreenshotOptions = { ...options, clip: box, fullPage: false };
    return await this.screenshotPage(progress, merged);
  }

  async takeScreenshot(
    progress: Progress,
    format: string,
    documentRect: Rect | undefined,
    viewportRect: Rect | undefined,
    quality: number | undefined,
    fitsViewport: boolean,
    scale: 'css' | 'device'
  ): Promise<BufferLike> {
    progress.log('taking screenshot via Chrome extension API');

    // Get device pixel ratio for proper scaling
    const mainFrameContext = await this._page.mainFrame().getContext();
    const dpr = (await mainFrameContext.executeScript(() => window.devicePixelRatio, 'MAIN')) ?? 1;

    // Chrome extension limitation: captureVisibleTab can only capture visible content
    if (!fitsViewport && documentRect) {
      progress.log('content extends beyond viewport, using scroll-and-stitch approach');
      return await this._takeFullPageScreenshot(progress, format, quality, scale, dpr);
    }
    try {
      // Use Chrome's captureVisibleTab API for screenshot capture
      const dataUrl = await safeCaptureVisibleTab({
        format: format === 'png' ? 'png' : 'jpeg',
        quality: quality ?? (format === 'jpeg' ? 80 : undefined),
      });

      // Convert data URL to Buffer
      const base64Data = dataUrl.split(',')[1];
      const buffer = BufferPolyfill.from(base64Data, 'base64');

      // Handle clipping if documentRect or viewportRect is specified with non-zero offset
      const clipRect = documentRect || viewportRect;
      if (clipRect && (clipRect.x !== 0 || clipRect.y !== 0)) {
        progress.log('applying clip region to screenshot');
        const clippedBuffer = await this._clipScreenshot(buffer, clipRect, dpr, format, quality);
        return clippedBuffer;
      }

      return buffer;
    } catch (error) {
      throw new Error(
        `Failed to take screenshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async _takeFullPageScreenshot(
    progress: Progress,
    format: string,
    quality: number | undefined,
    scale: 'css' | 'device',
    dpr: number
  ): Promise<BufferLike> {
    progress.log('capturing full page using scroll-and-stitch method');

    // Initialize scroll capture in the page
    const mainFrameContext = await this._page.mainFrame().getContext();
    const scrollInfo = await mainFrameContext.executeScript(inPageScrollAndCapture, 'MAIN');

    if (!scrollInfo) {
      throw new Error('Failed to initialize scroll capture');
    }

    const { xSegments, ySegments, viewportWidth, viewportHeight, totalWidth, totalHeight } =
      scrollInfo;

    progress.log(
      `capturing ${xSegments}x${ySegments} segments (total: ${totalWidth}x${totalHeight})`
    );

    const screenshots: Array<{
      buffer: BufferLike;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    try {
      // Capture each segment
      for (let yIndex = 0; yIndex < ySegments; yIndex++) {
        for (let xIndex = 0; xIndex < xSegments; xIndex++) {
          progress.log(
            `capturing segment ${xIndex + 1},${yIndex + 1} of ${xSegments},${ySegments}`
          );
          const segmentInfo = await mainFrameContext.executeScript(
            inPageScrollToSegment,
            'MAIN',
            xIndex,
            yIndex
          );

          if (!segmentInfo) {
            throw new Error(`Failed to scroll to segment ${xIndex},${yIndex}`);
          }

          // Wait for scroll to complete and render (increased from 200ms)
          await ScreenshotUtils.sleep(SEGMENT_SETTLE_DELAY_MS);

          const dataUrl = await safeCaptureVisibleTab({
            format: format === 'png' ? 'png' : 'jpeg',
            quality: quality ?? (format === 'jpeg' ? 80 : undefined),
          });

          const base64Data = dataUrl.split(',')[1];

          const buffer = BufferPolyfill.from(base64Data, 'base64');
          screenshots.push({
            buffer,
            x: segmentInfo.x,
            y: segmentInfo.y,
            width: viewportWidth,
            height: viewportHeight,
          });
        }
      }

      // Stitch all screenshots together
      progress.log('stitching segments together');
      const stitchedBuffer = await this._stitchScreenshots(
        screenshots,
        totalWidth,
        totalHeight,
        dpr,
        format as 'png' | 'jpeg',
        quality
      );

      return stitchedBuffer;
    } finally {
      // Always restore original scroll position
      const mainFrameContext = await this._page.mainFrame().getContext();
      await mainFrameContext.executeScript(inPageRestoreScroll, 'MAIN');
    }
  }

  private async _stitchScreenshots(
    screenshots: Array<{ buffer: BufferLike; x: number; y: number; width: number; height: number }>,
    totalWidthCss: number,
    totalHeightCss: number,
    dpr: number,
    format: 'png' | 'jpeg',
    quality?: number
  ): Promise<BufferLike> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    // Canvas in device pixels
    canvas.width = ScreenshotMath.devicePx(totalWidthCss, dpr);
    canvas.height = ScreenshotMath.devicePx(totalHeightCss, dpr);

    const mime = ScreenshotEncoding.inferMime(format);
    const qualityPercent = ScreenshotEncoding.qualityPercent(quality);

    // Load all images
    const imagePromises = screenshots.map(async screenshot => {
      const base64 = screenshot.buffer.toString('base64');
      const img = await ScreenshotCanvas.imageFromBase64(base64, mime);
      return { img, screenshot };
    });

    const loadedImages = await Promise.all(imagePromises);

    // Draw all segments
    for (const { img, screenshot } of loadedImages) {
      const dx = ScreenshotMath.devicePx(screenshot.x, dpr);
      const dy = ScreenshotMath.devicePx(screenshot.y, dpr);
      const dw = Math.min(img.width, canvas.width - dx);
      const dh = Math.min(img.height, canvas.height - dy);

      ScreenshotCanvas.drawSegment(ctx, img, dx, dy, dw, dh);
    }

    // Convert to buffer
    const blob = await ScreenshotCanvas.canvasToBlob(canvas, mime, qualityPercent);
    const buffer = await ScreenshotCanvas.blobToBuffer(blob);

    return buffer;
  }

  /**
   * Helper method to clip a screenshot buffer to a specific rectangle.
   * This uses Canvas API to crop the image to the specified region.
   */
  private async _clipScreenshot(
    buffer: BufferLike,
    clipRect: Rect,
    dpr: number,
    format: string,
    quality?: number
  ): Promise<BufferLike> {
    const mime = ScreenshotEncoding.inferMime(format as 'png' | 'jpeg');
    const qualityPercent = ScreenshotEncoding.qualityPercent(quality);

    // Load the image
    const base64 = buffer.toString('base64');
    const img = await ScreenshotCanvas.imageFromBase64(base64, mime);

    // Create canvas and context
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    // Apply DPR scaling to clip coordinates
    const scaledRect = ScreenshotMath.scaleRect(clipRect, dpr);

    // Ensure clip bounds are within image bounds
    const clippedRect = {
      x: Math.max(0, Math.min(scaledRect.x, img.width)),
      y: Math.max(0, Math.min(scaledRect.y, img.height)),
      width: Math.min(scaledRect.width, img.width - scaledRect.x),
      height: Math.min(scaledRect.height, img.height - scaledRect.y),
    };

    canvas.width = clippedRect.width;
    canvas.height = clippedRect.height;

    // Draw the clipped portion of the image
    ctx.drawImage(
      img,
      clippedRect.x,
      clippedRect.y,
      clippedRect.width,
      clippedRect.height,
      0,
      0,
      clippedRect.width,
      clippedRect.height
    );

    // Convert to buffer
    const blob = await ScreenshotCanvas.canvasToBlob(canvas, mime, qualityPercent);
    const resultBuffer = await ScreenshotCanvas.blobToBuffer(blob);

    return resultBuffer;
  }

  private async _originalViewportSize(progress: Progress): Promise<Size> {
    progress.log('getting viewport size');

    const mainFrameContext = await this._page.mainFrame().getContext();
    const viewportSize = await mainFrameContext.executeScript(
      () => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }),
      'MAIN'
    );

    if (!viewportSize) {
      throw new Error('Failed to get viewport size');
    }

    return viewportSize;
  }

  private async _fullPageSize(progress: Progress): Promise<Size> {
    progress.log('getting full page size');

    const mainFrameContext = await this._page.mainFrame().getContext();
    const fullPageSize = await mainFrameContext.executeScript(() => {
      if (!document.body || !document.documentElement) {
        return null;
      }
      return {
        width: Math.max(
          document.body.scrollWidth,
          document.documentElement.scrollWidth,
          document.body.offsetWidth,
          document.documentElement.offsetWidth,
          document.body.clientWidth,
          document.documentElement.clientWidth
        ),
        height: Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight,
          document.body.clientHeight,
          document.documentElement.clientHeight
        ),
      };
    }, 'MAIN');

    if (!fullPageSize) {
      throw new Error(
        'Failed to get full page size - document.body or document.documentElement not available'
      );
    }

    return fullPageSize;
  }
}

export function validateScreenshotOptions(options: ScreenshotOptions): 'png' | 'jpeg' {
  let format: 'png' | 'jpeg' | null = null;
  // options.type takes precedence over inferring the type from options.path
  // because it may be a 0-length file with no extension created beforehand (i.e. as a temp file).
  if (options.type) {
    assert(
      options.type === 'png' || options.type === 'jpeg',
      'Unknown options.type value: ' + options.type
    );
    format = options.type;
  }

  if (!format) format = 'png';

  if (options.quality !== undefined) {
    assert(format === 'jpeg', 'options.quality is unsupported for the ' + format + ' screenshots');
    assert(
      typeof options.quality === 'number',
      'Expected options.quality to be a number but found ' + typeof options.quality
    );
    assert(Number.isInteger(options.quality), 'Expected options.quality to be an integer');
    assert(
      options.quality >= 0 && options.quality <= 100,
      'Expected options.quality to be between 0 and 100 (inclusive), got ' + options.quality
    );
  }
  if (options.clip) {
    assert(
      typeof options.clip.x === 'number',
      'Expected options.clip.x to be a number but found ' + typeof options.clip.x
    );
    assert(
      typeof options.clip.y === 'number',
      'Expected options.clip.y to be a number but found ' + typeof options.clip.y
    );
    assert(
      typeof options.clip.width === 'number',
      'Expected options.clip.width to be a number but found ' + typeof options.clip.width
    );
    assert(
      typeof options.clip.height === 'number',
      'Expected options.clip.height to be a number but found ' + typeof options.clip.height
    );
    assert(options.clip.width !== 0, 'Expected options.clip.width not to be 0.');
    assert(options.clip.height !== 0, 'Expected options.clip.height not to be 0.');
  }
  return format;
}
