import {
  createRequestInfo,
  createResponseInfo,
  type RequestInfo,
  type ResponseInfo,
} from '../utilities/types';

type RouteKey = string; // `${tabId}:${frameId}:${normalizedUrl}`

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    return url.toString();
  } catch {
    return u;
  }
}

function isHttpScheme(u: string): boolean {
  try {
    const { protocol } = new URL(u);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function shouldIgnoreRequest(url: string, type?: string): boolean {
  // Early exit for non-HTTP(S) protocols
  if (!isHttpScheme(url)) return true;

  // Ignore chrome extension internals
  if (url.startsWith('chrome-extension://')) return true;

  // Ignore websocket upgrades
  if (type === 'websocket') return true;

  return false;
}

/**
 * Observes chrome.webRequest events and provides access to final response
 * metadata (status, headers) for navigations. Designed for main-frame usage.
 */
export class NetworkObserver {
  private readonly requests = new Map<string, RequestInfo>(); // requestId -> RequestInfo
  private readonly responsesByRoute = new Map<RouteKey, ResponseInfo>();
  private readonly ttlMs = 30_000;
  private readonly createdAt = new Map<RouteKey, number>();
  private cleanupTimer: number | undefined;

  constructor() {
    // Capture outgoing requests
    chrome.webRequest.onBeforeRequest.addListener(
      details => {
        const { requestId, url, method, type, tabId, frameId, timeStamp } = details;
        if (shouldIgnoreRequest(url, type)) {
          return;
        }
        const info = createRequestInfo(
          requestId,
          url,
          method,
          type,
          {},
          Math.floor(timeStamp),
          tabId ?? -1,
          frameId ?? 0
        );
        this.requests.set(requestId, info);
      },
      { urls: ['<all_urls>'] },
      []
    );

    // Capture response headers as soon as they are available
    chrome.webRequest.onHeadersReceived.addListener(
      details => {
        if (shouldIgnoreRequest(details.url, (details as unknown as { type?: string }).type)) {
          return;
        }
        this._recordResponse(details);
      },
      { urls: ['<all_urls>'] },
      ['responseHeaders']
    );

    // Fallback: some responses expose headers only in onResponseStarted
    chrome.webRequest.onResponseStarted.addListener(
      details => {
        if (shouldIgnoreRequest(details.url, (details as unknown as { type?: string }).type)) {
          return;
        }
        this._recordResponse(details);
      },
      { urls: ['<all_urls>'] },
      ['responseHeaders']
    );

    // Periodic cleanup - run less frequently to reduce overhead
    this.cleanupTimer = setInterval(() => this._cleanup(), 15_000) as unknown as number;
  }

  /** Wait for a main-frame response for the given tab/frame/url. */
  async waitForMainFrameResponse(
    tabId: number,
    frameId: number,
    url: string,
    timeoutMs: number = 3000
  ): Promise<ResponseInfo> {
    const key = this._routeKey(tabId, frameId, url);
    const existing = this.responsesByRoute.get(key);
    if (existing) {
      return existing;
    }

    return new Promise<ResponseInfo>((resolve, reject) => {
      const start = Date.now();
      const t = setInterval(() => {
        const hit = this.responsesByRoute.get(key);
        if (hit) {
          clearInterval(t);
          resolve(hit);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(t);
          reject(new Error(`Timed out waiting for response for ${url}`));
        }
      }, 50);
    });
  }

  getResponse(tabId: number, frameId: number, url: string): ResponseInfo | undefined {
    return this.responsesByRoute.get(this._routeKey(tabId, frameId, url));
  }

  dispose(): void {
    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.requests.clear();
    this.responsesByRoute.clear();
    this.createdAt.clear();
  }

  private _recordResponse(details: chrome.webRequest.WebResponseHeadersDetails): void {
    const { requestId, url, responseHeaders, tabId, frameId, timeStamp } = details;
    if (shouldIgnoreRequest(url)) return;
    if (tabId === -1 || frameId === undefined) return;
    const req = this.requests.get(requestId);
    if (!req) return;

    // Only store main frame and sub_frame responses; primary use is main_frame
    // details.type exists on onResponseStarted; not onHeadersReceived in MV3 types in some channels
    const type = (details as unknown as { type?: string }).type;
    if (type && type !== 'main_frame' && type !== 'sub_frame') return;

    const headers: Record<string, string> = {};
    if (responseHeaders) {
      for (const h of responseHeaders) {
        if (!h.name) continue;
        const name = h.name.toLowerCase();
        let valueStr = '';
        if (typeof h.value === 'string') {
          valueStr = h.value;
        } else if (h.binaryValue) {
          try {
            const bytes = new Uint8Array(h.binaryValue);
            valueStr = String.fromCharCode(...bytes);
          } catch {
            valueStr = '';
          }
        }
        const value = valueStr as string;
        headers[name] = value;
      }
    }

    // statusCode is available on details
    const status: number = (details as unknown as { statusCode?: number }).statusCode ?? 0;
    const resp = createResponseInfo(
      requestId,
      url,
      status,
      headers,
      req,
      Math.floor(timeStamp),
      tabId ?? req.tabId,
      frameId ?? req.frameId
    );

    const key = this._routeKey(tabId ?? req.tabId, frameId ?? req.frameId, url);
    this.responsesByRoute.set(key, resp);
    this.createdAt.set(key, Date.now());
  }

  private _routeKey(tabId: number, frameId: number, url: string): RouteKey {
    return `${tabId}:${frameId}:${normalizeUrl(url)}`;
  }

  private _cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Collect expired keys first to avoid modifying map during iteration
    for (const [k, ts] of this.createdAt) {
      if (now - ts > this.ttlMs) {
        expiredKeys.push(k);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      this.createdAt.delete(key);
      this.responsesByRoute.delete(key);
    }
  }
}

let _singleton: NetworkObserver | undefined;
export function getNetworkObserver(): NetworkObserver {
  if (!_singleton) _singleton = new NetworkObserver();
  return _singleton;
}
