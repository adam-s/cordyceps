/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Frame } from '../frame';
import { type Progress } from '../core/progress';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Size = {
  width: number;
  height: number;
};

export type LifecycleEvent = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export type RegularLifecycleEvent = Exclude<LifecycleEvent, 'networkidle'>;

// Set of valid lifecycle events for validation
export const kLifecycleEvents = new Set<LifecycleEvent>([
  'load',
  'domcontentloaded',
  'networkidle',
  'commit',
]);

/**
 * Validates and normalizes lifecycle event names
 * Handles Playwright compatibility by converting 'networkidle0' to 'networkidle'
 */
export function verifyLifecycle(name: string, waitUntil: LifecycleEvent): LifecycleEvent {
  // Handle Playwright compatibility
  if ((waitUntil as unknown) === 'networkidle0') {
    waitUntil = 'networkidle';
  }

  if (!kLifecycleEvents.has(waitUntil)) {
    throw new Error(`${name}: expected one of (load|domcontentloaded|networkidle|commit)`);
  }

  return waitUntil;
}

export type CallMetadata = {
  id: string;
  startTime: number;
  endTime: number;
  type: string;
  method: string;
  params: unknown;
  log: string[];
  isServerSide?: boolean;
};

export interface NavigateOptions {
  waitUntil?: LifecycleEvent;
  timeout?: number;
  referer?: string;
}

export type GotoOptions = NavigateOptions & {
  referer?: string;
};

/**
 * Constructs a URL based on a base URL (for Playwright compatibility)
 * Not used in Chrome extension context since we don't need baseURL construction
 */
export function constructURLBasedOnBaseURL(baseURL: string | undefined, givenURL: string): string {
  try {
    return new URL(givenURL, baseURL).toString();
  } catch (e) {
    return givenURL;
  }
}

export interface NavigateOptionsWithProgress extends NavigateOptions {
  progress?: Progress;
}

export interface NavigationRequest {
  response(): Promise<ResponseInfo | null>;
  id: string;
  url: string;
  method: string;
  resourceType: string;
  headers: Record<string, string>;
  timestamp: number;
  _finalRequest(): NavigationRequest;
}

/**
 * Document information for frame navigation tracking
 * Based on Playwright's DocumentInfo but adapted for Chrome extension context
 */
export interface DocumentInfo {
  /**
   * Document ID for tracking document changes across navigations
   * Unfortunately, we don't have documentId when we find out about
   * a pending navigation from things like frameScheduledNavigation.
   */
  documentId: string | undefined;
  /**
   * Network request associated with this document navigation
   * In Chrome extension context, this represents the navigation request
   */
  request: NavigationRequest | undefined;
}

// Frame event type definitions based on Playwright's Frame events

/**
 * Navigation event data structure matching Playwright's NavigationEvent
 */
export interface NavigationEvent {
  /** New frame url after navigation */
  url: string;
  /** New frame name after navigation */
  name: string;
  /** Information about the new document for cross-document navigations */
  newDocument?: DocumentInfo;
  /** Error for cross-document navigations if any */
  error?: Error;
  /** Whether this event should be visible to the clients via public APIs */
  isPublic?: boolean;
}

/**
 * Frame navigation event for internal tracking
 */
export interface FrameNavigationEvent {
  frameId: number;
  url: string;
  newDocument?: DocumentInfo;
  error?: Error;
  lifecycleEvents?: LifecycleEvent[];
  isPublic?: boolean;
}

/**
 * Page event data structure for frame lifecycle events
 */
export interface PageFrameEvent {
  frame: Frame;
}

export type TimeoutOptions = { timeout?: number };

export type WaitForEventOptions = {
  timeout?: number;
  predicate?: (eventArg: unknown) => boolean;
  delay?: number; // Delay in ms before triggering the action that causes the event
};

export type StrictOptions = {
  strict?: boolean;
};

export type WaitForElementOptions = StrictOptions & {
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
} & { omitReturnValue?: boolean };

export type Point = {
  x: number;
  y: number;
};

export type CheckOptions = {
  position?: Point;
  force?: boolean;
  timeout?: number;
};

export type ClickOptions = {
  position?: Point;
  force?: boolean;
  timeout?: number;
  delay?: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  // Additional Playwright compatibility options
  noWaitAfter?: boolean;
  modifiers?: ('Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift')[];
  trial?: boolean;
};

export type SelectOption = string | { value?: string; label?: string; index?: number };

export type SelectOptionOptions = {
  timeout?: number;
  force?: boolean;
};

export type CommonActionOptions = {
  timeout?: number;
  force?: boolean;
};

export type FrameDragAndDropParams = {
  source: string;
  target: string;
  force?: boolean;
  timeout: number;
  trial?: boolean;
  sourcePosition?: Point;
  targetPosition?: Point;
  strict?: boolean;
};

export type FrameDragAndDropOptions = {
  force?: boolean;
  trial?: boolean;
  sourcePosition?: Point;
  targetPosition?: Point;
  strict?: boolean;
};

export type FrameDragAndDropResult = void;

export type ScreenshotOptions = {
  type?: 'png' | 'jpeg';
  quality?: number;
  omitBackground?: boolean;
  animations?: 'disabled' | 'allow';
  mask?: { frame: Frame; selector: string }[];
  maskColor?: string;
  fullPage?: boolean;
  clip?: Rect;
  scale?: 'css' | 'device';
  caret?: 'hide' | 'initial';
  style?: string;
};

export type ImageComparatorOptions = {
  threshold?: number;
  maxDiffPixels?: number;
  maxDiffPixelRatio?: number;
  comparator?: string;
};

export type ExpectScreenshotOptions = ImageComparatorOptions &
  ScreenshotOptions & {
    timeout: number;
    expected?: Buffer;
    isNot?: boolean;
    locator?: {
      frame: Frame;
      selector: string;
    };
  };

// Network event types for chrome.webRequest integration
export interface RequestInfo {
  id: string;
  url: string;
  method: string;
  resourceType: string;
  headers: Record<string, string>;
  timestamp: number;
  tabId: number;
  frameId: number;
}

export interface ResponseInfo {
  id: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
  request: RequestInfo;
  tabId: number;
  frameId: number;
}

/**
 * Minimal Response interface for compatibility with browser automation libraries.
 * This provides a subset of Playwright's Response interface needed for basic functionality.
 *
 * In Chrome extension context, most response data comes from chrome.webRequest API
 * which has limited access compared to Playwright's full response handling.
 *
 * Named NavigationResponse to avoid conflicts with the built-in Fetch Response type.
 */
export interface NavigationResponse {
  /** Response URL (may differ from request URL due to redirects) */
  url(): string;

  /** HTTP status code */
  status(): number;

  /** HTTP status text */
  statusText(): string;

  /** Response headers as key-value pairs */
  headers(): Record<string, string>;

  /** Get specific header value */
  headerValue(name: string): string | undefined;

  /** The request that led to this response */
  request(): NavigationRequest;

  /**
   * Whether the response was successful (status in 200-299 range)
   * This is a commonly used helper method
   */
  ok(): boolean;
}

/**
 * Chrome extension webRequest resource types
 * Maps to chrome.webRequest.ResourceType enum
 */
export type ChromeResourceType =
  | 'main_frame'
  | 'sub_frame'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'object'
  | 'xmlhttprequest'
  | 'ping'
  | 'csp_report'
  | 'media'
  | 'websocket'
  | 'webtransport'
  | 'webbundle'
  | 'other';

/**
 * Helper function to create a DocumentInfo with NavigationRequest
 * Used when creating new documents during frame navigation
 */
export function createDocumentInfo(
  documentId: string | undefined,
  navigationRequest: NavigationRequest | undefined,
): DocumentInfo {
  return {
    documentId,
    request: navigationRequest,
  };
}

/**
 * Helper function to create RequestInfo from chrome.webRequest details
 * Converts Chrome extension webRequest data to our internal format
 */
export function createRequestInfo(
  id: string,
  url: string,
  method: string,
  resourceType: string,
  headers: Record<string, string> = {},
  timestamp: number = Date.now(),
  tabId: number = -1,
  frameId: number = 0,
): RequestInfo {
  return {
    id,
    url,
    method,
    resourceType,
    headers,
    timestamp,
    tabId,
    frameId,
  };
}

/**
 * Helper function to create ResponseInfo from chrome.webRequest response details
 * Converts Chrome extension webRequest response data to our internal format
 */
export function createResponseInfo(
  id: string,
  url: string,
  status: number,
  headers: Record<string, string>,
  request: RequestInfo,
  timestamp: number = Date.now(),
  tabId?: number,
  frameId?: number,
): ResponseInfo {
  return {
    id,
    url,
    status,
    headers,
    timestamp,
    request,
    tabId: tabId ?? request.tabId,
    frameId: frameId ?? request.frameId,
  };
}
