import { DEFAULTS } from './constants';

// #region Type Definitions

export type DocumentLifecycle = 'prerender' | 'active' | 'cached' | 'pending_deletion';

export type FrameType = 'outermost_frame' | 'sub_frame' | 'fenced_frame'; // extensionTypes.FrameType

export type TabStatus = 'unloaded' | 'loading' | 'complete'; // tabs.TabStatus

export interface FrameConfiguration {
  // Frame properties (from webNavigation.getFrame / getAllFrames)
  documentId: string;
  documentLifecycle: DocumentLifecycle;
  errorOccurred: boolean;
  frameType: FrameType;
  parentFrameId: number;
  parentDocumentId?: string;
  url: string;

  // Sender / runtime.MessageSender bits
  frameId: number;
  extensionId: string; // sender.id
  origin: string; // sender.origin

  // Tab properties (flattened from sender.tab)
  tabId: number;
  tabActive: boolean;
  tabAudible?: boolean;
  tabAutoDiscardable: boolean;
  tabDiscarded: boolean;
  tabFavIconUrl?: string;
  tabFrozen: boolean;
  tabGroupId: number;
  tabHeight?: number;
  tabHighlighted: boolean;
  tabIncognito: boolean;
  tabIndex: number;
  tabLastAccessed: number;
  tabMuted: boolean;
  tabPinned: boolean;
  /** Deprecated upstream — keep only if you still read it from sender.tab */
  tabSelected: boolean;
  tabStatus: TabStatus;
  tabTitle?: string;
  tabUrl?: string;
  tabWidth?: number;
  tabWindowId: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// #endregion

// #region Pure Utility Functions

/**
 * Merges frame details and sender information into a typed FrameConfiguration object
 * @param frameDetails Frame details from webNavigation.getFrame or getAllFrames
 * @param sender MessageSender from runtime.onMessage or similar
 * @returns Flattened FrameConfiguration object
 */
export function createFrameConfiguration(
  frameDetails: {
    documentId: string;
    documentLifecycle: DocumentLifecycle;
    errorOccurred: boolean;
    frameType: FrameType;
    parentFrameId: number;
    parentDocumentId?: string;
    url: string;
  },
  sender: chrome.runtime.MessageSender
): FrameConfiguration {
  const tab = sender.tab;

  if (!tab) {
    throw new Error('MessageSender must include tab information');
  }

  return {
    // Frame properties
    documentId: frameDetails.documentId,
    documentLifecycle: frameDetails.documentLifecycle,
    errorOccurred: frameDetails.errorOccurred,
    frameType: frameDetails.frameType,
    parentFrameId: frameDetails.parentFrameId,
    parentDocumentId: frameDetails.parentDocumentId,
    url: frameDetails.url,

    // Sender properties
    frameId: sender.frameId ?? 0,
    extensionId: sender.id ?? '',
    origin: sender.origin ?? '',

    // Tab properties (flattened)
    tabId: tab.id ?? -1,
    tabActive: tab.active ?? false,
    tabAudible: tab.audible,
    tabAutoDiscardable: tab.autoDiscardable ?? true,
    tabDiscarded: tab.discarded ?? false,
    tabFavIconUrl: tab.favIconUrl,
    tabFrozen: false, // Not available on chrome.tabs.Tab, always false
    tabGroupId: tab.groupId ?? -1,
    tabHeight: tab.height,
    tabHighlighted: tab.highlighted ?? false,
    tabIncognito: tab.incognito ?? false,
    tabIndex: tab.index ?? -1,
    tabLastAccessed: tab.lastAccessed ?? 0,
    tabMuted: tab.mutedInfo?.muted ?? false,
    tabPinned: tab.pinned ?? false,
    tabSelected: tab.selected ?? false,
    tabStatus: (tab.status as TabStatus) ?? 'unloaded',
    tabTitle: tab.title,
    tabUrl: tab.url,
    tabWidth: tab.width,
    tabWindowId: tab.windowId ?? -1,
  };
}

/**
 * Gets frame details from Chrome's webNavigation API
 * @param tabId The tab ID
 * @param frameId The frame ID
 * @returns Frame details or null if frame not found
 */
export function getFrame(
  tabId: number,
  frameId: number
): Promise<chrome.webNavigation.GetFrameResultDetails | null> {
  return new Promise((resolve, reject) => {
    chrome.webNavigation.getFrame({ tabId, frameId }, frame => {
      const err = chrome.runtime.lastError;
      err ? reject(err) : resolve(frame);
    });
  });
}

/**
 * Calculate the center position of a bounding box
 * @param boundingBox The bounding box to calculate center for
 * @returns Position at the center of the bounding box
 */
export function calculateCenterPosition(boundingBox: BoundingBox): Position {
  return {
    x: boundingBox.x + boundingBox.width / 2,
    y: boundingBox.y + boundingBox.height / 2,
  };
}

/**
 * Create a DragEvent with proper initialization
 * @param type The event type (dragstart, dragenter, etc.)
 * @param position The position for the event
 * @param dataTransfer The DataTransfer object
 * @returns A properly initialized DragEvent
 */
export function createDragEvent(
  type: string,
  position: Position,
  dataTransfer: DataTransfer
): DragEvent {
  return new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: position.x,
    clientY: position.y,
    dataTransfer,
  });
}

/**
 * Create a MouseEvent with proper initialization
 * @param type The event type (mouseenter, mouseleave, etc.)
 * @param position The position for the event
 * @returns A properly initialized MouseEvent
 */
export function createMouseEvent(type: string, position: Position): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: position.x,
    clientY: position.y,
  });
}

/**
 * Create and initialize a DataTransfer object with element data
 * @param sourceElement The source element to extract data from
 * @returns A DataTransfer object with text and HTML data
 */
export function createDataTransfer(sourceElement: Element): DataTransfer {
  const dataTransfer = new DataTransfer();

  // Set some default data for the drag operation
  dataTransfer.setData('text/plain', sourceElement.textContent || '');
  dataTransfer.setData('text/html', sourceElement.outerHTML);

  return dataTransfer;
}

/**
 * Create a complete drag and drop script function that can be executed in a content script context
 * This returns a function that can be passed to executeScript
 */
export function createDragAndDropScript() {
  return (
    sourceSelector: string,
    targetSelector: string,
    srcPos: { x: number; y: number },
    tgtPos: { x: number; y: number }
  ) => {
    // Find elements in the content script context
    const sourceElem = document.querySelector(sourceSelector);
    const targetElem = document.querySelector(targetSelector);

    if (!sourceElem) {
      throw new Error(`Source element not found: ${sourceSelector}`);
    }
    if (!targetElem) {
      throw new Error(`Target element not found: ${targetSelector}`);
    }

    // Create a DataTransfer object (carries the payload)
    const dataTransfer = new DataTransfer();

    // Set some default data for the drag operation
    dataTransfer.setData('text/plain', sourceElem.textContent || '');
    dataTransfer.setData('text/html', sourceElem.outerHTML);

    // 1. Focus and hover source element
    if (sourceElem instanceof HTMLElement) {
      sourceElem.focus();
    }
    sourceElem.dispatchEvent(
      new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        clientX: srcPos.x,
        clientY: srcPos.y,
      })
    );

    // 2. Dispatch dragstart on the source
    const dragStartEvent = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      clientX: srcPos.x,
      clientY: srcPos.y,
      dataTransfer,
    });
    sourceElem.dispatchEvent(dragStartEvent);

    // 3. Dispatch dragenter on the target
    const dragEnterEvent = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      clientX: tgtPos.x,
      clientY: tgtPos.y,
      dataTransfer,
    });
    targetElem.dispatchEvent(dragEnterEvent);

    // 4. Dispatch dragover on the target
    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      clientX: tgtPos.x,
      clientY: tgtPos.y,
      dataTransfer,
    });
    targetElem.dispatchEvent(dragOverEvent);

    // 5. Dispatch drop on the target
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX: tgtPos.x,
      clientY: tgtPos.y,
      dataTransfer,
    });
    targetElem.dispatchEvent(dropEvent);

    // 6. Dispatch dragend on the source (cleanup)
    const dragEndEvent = new DragEvent('dragend', {
      bubbles: true,
      cancelable: true,
      clientX: srcPos.x,
      clientY: srcPos.y,
      dataTransfer,
    });
    sourceElem.dispatchEvent(dragEndEvent);

    return 'success';
  };
}

/**
 * Validate that a bounding box has valid dimensions
 * @param boundingBox The bounding box to validate
 * @returns True if the bounding box has valid dimensions
 */
export function isValidBoundingBox(boundingBox: BoundingBox | null): boundingBox is BoundingBox {
  return boundingBox !== null && boundingBox.width > 0 && boundingBox.height > 0;
}

/**
 * Generate a human-readable string for a bounding box
 * @param boundingBox The bounding box to describe
 * @returns A descriptive string
 */
export function describeBoundingBox(boundingBox: BoundingBox): string {
  return `x=${boundingBox.x}, y=${boundingBox.y}, width=${boundingBox.width}, height=${boundingBox.height}`;
}

// #endregion

// #region Frame Constants and Pure Functions

/**
 * Validates if a wait state is supported
 * @param state The state to validate
 * @returns True if the state is valid
 */
export function isValidWaitState(state: string): boolean {
  return ['attached', 'detached', 'visible', 'hidden'].includes(state);
}

/**
 * Validates wait state and throws error if invalid
 * @param state The state to validate
 * @throws Error if state is invalid
 */
export function validateWaitState(state: string): void {
  if (!isValidWaitState(state)) {
    throw new Error(`state: expected one of (attached|detached|visible|hidden)`);
  }
}

/**
 * Checks if an error is non-retriable (should not be retried)
 * @param error The error to check
 * @returns True if the error should not be retried
 */
export function isNonRetriableError(error: Error): boolean {
  // Check for specific error patterns that indicate non-retriable errors
  return (
    error.message.includes('not connected') ||
    error.name === 'AbortError' ||
    error.message.includes('session closed') ||
    error.message.includes('Target closed') ||
    error.message.includes('Protocol error')
  );
}

/**
 * Determines if state matches based on visibility and attachment
 * @param desiredState The desired state to match
 * @param visible Whether the element is visible
 * @param attached Whether the element is attached
 * @returns True if the current state matches the desired state
 */
export function doesStateMatch(
  desiredState: 'attached' | 'detached' | 'visible' | 'hidden',
  visible: boolean,
  attached: boolean
): boolean {
  const stateMatches = {
    attached,
    detached: !attached,
    visible,
    hidden: !visible,
  };
  return stateMatches[desiredState];
}

/**
 * Determines if the element handle should be returned based on state and options
 * @param state The desired state
 * @param omitReturnValue Whether to omit the return value
 * @returns True if an element handle should be returned
 */
export function shouldReturnElementHandle(
  state: 'attached' | 'detached' | 'visible' | 'hidden',
  omitReturnValue?: boolean
): boolean {
  if (omitReturnValue) {
    return false;
  }
  if (state === 'detached' || state === 'hidden') {
    return false;
  }
  return true;
}

/**
 * Gets the appropriate wait state for file input operations
 * @param force Whether to force the operation on hidden elements
 * @returns The appropriate wait state
 */
export function getFileInputWaitState(force?: boolean): 'attached' | 'visible' {
  return force ? 'attached' : 'visible';
}

/**
 * Creates a log message for waiting on a selector
 * @param selector The CSS selector
 * @param state The wait state
 * @returns A formatted log message
 */
export function createSelectorWaitMessage(selector: string, state: string): string {
  return `waiting for selector "${selector}"${state === 'attached' ? '' : ' to be ' + state}`;
}

/**
 * Formats an error message for element not found
 * @param selector The CSS selector that wasn't found
 * @returns A formatted error message
 */
export function createElementNotFoundError(selector: string): string {
  return `Element not found for selector: ${selector}`;
}

/**
 * Formats an error message for bounding box issues
 * @param selector The CSS selector
 * @param issue The specific issue ('no bounding box', etc.)
 * @returns A formatted error message
 */
export function createBoundingBoxError(selector: string, issue: string): string {
  return `${issue.charAt(0).toUpperCase() + issue.slice(1)} element "${selector}" has ${issue}`;
}

/**
 * Creates a frame selector for entering a frame
 * @param frameSelector The base frame selector
 * @param targetSelector The target selector within the frame
 * @returns A combined frame selector
 */
export function createFrameEnterSelector(frameSelector: string, targetSelector: string): string {
  return frameSelector + ' >> internal:control=enter-frame >> ' + targetSelector;
}

/**
 * Creates a nth selector for frame locators
 * @param frameSelector The base frame selector
 * @param index The index (can be negative for last)
 * @returns A nth frame selector
 */
export function createFrameNthSelector(frameSelector: string, index: number): string {
  return frameSelector + ` >> nth=${index}`;
}

// #endregion

// #region Test ID Management

let _testIdAttributeName: string = DEFAULTS.TEST_ID_ATTRIBUTE;

/**
 * Get the current test ID attribute name
 * @returns The current test ID attribute name
 */
export function testIdAttributeName(): string {
  return _testIdAttributeName;
}

/**
 * Set the test ID attribute name
 * @param attributeName The new test ID attribute name
 */
export function setTestIdAttribute(attributeName: string): void {
  _testIdAttributeName = attributeName;
}

// #endregion

// #region Script Execution Utilities

/**
 * Execute a script function in the main world context of a tab
 * This is a general utility for navigation and other operations that need to run in the main world
 */
export async function executeScriptInMainWorld<T>(
  tabId: number,
  func: () => T,
  options: { allFrames?: boolean } = {}
): Promise<T | undefined> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId, allFrames: options.allFrames ?? false },
      world: 'MAIN',
      func,
    });
    return result?.result as T | undefined;
  } catch (error) {
    console.error('Failed to execute script in main world:', error);
    return undefined;
  }
}

/**
 * Execute history.back() in the main world context
 * @returns true if navigation was attempted, false if no history available
 */
export async function executeHistoryBack(tabId: number): Promise<boolean> {
  console.log(`[executeHistoryBack] tabId:${tabId} executing history.back() in main world ######`);
  const result = await executeScriptInMainWorld(tabId, () => {
    if (history.length > 1) {
      console.log('executeHistoryBack: history.length > 1, calling history.back()');
      history.back();
      return true;
    }
    console.log('executeHistoryBack: history.length <= 1, no navigation possible');
    return false;
  });
  console.log(`[executeHistoryBack] tabId:${tabId} result:${result} ######`);
  return result ?? false;
}

/**
 * Execute history.forward() in the main world context
 * @returns true if navigation was attempted
 */
export async function executeHistoryForward(tabId: number): Promise<boolean> {
  console.log(
    `[executeHistoryForward] tabId:${tabId} executing history.forward() in main world ######`
  );
  const result = await executeScriptInMainWorld(tabId, () => {
    console.log('executeHistoryForward: calling history.forward()');
    history.forward();
    return true;
  });
  console.log(`[executeHistoryForward] tabId:${tabId} result:${result} ######`);
  return result ?? false;
}

// #endregion
