/**
 * Cordyceps utilities index - centralized exports for all utility modules.
 *
 * This index file provides a single import point for all utility functions,
 * constants, and types across the Cordyceps framework. This promotes
 * consistency and makes it easy to access common functionality.
 *
 * Usage:
 * ```typescript
 * import { TIMEOUTS, createElementNotFoundError, validateSelector } from './utils';
 * ```
 */

// #region Constants
export * from './utilities/constants';

// #endregion

// #region Error Utilities
export * from './utilities/errorUtils';

// #endregion

// #region Buffer Utilities
export * from './utilities/bufferUtils';

// #endregion

// #region Validation Utilities
export * from './utilities/validationUtils';

// #endregion

// #region Core Utility Re-exports

// Frame utilities - Type definitions and core functions
export type {
  DocumentLifecycle,
  FrameType,
  TabStatus,
  FrameConfiguration,
  Position,
  BoundingBox,
} from './utilities/frameUtils';

export {
  createFrameConfiguration,
  getFrame,
  calculateCenterPosition,
  describeBoundingBox,
  isValidWaitState,
  createSelectorWaitMessage,
  createBoundingBoxError,
  createFrameEnterSelector,
  createFrameNthSelector,
  testIdAttributeName,
  setTestIdAttribute,
} from './utilities/frameUtils';

// Locator utilities
export {
  executeProgressElementOperation,
  buildSelectorWithOptions,
  executeElementMethodWithProgress,
  DEFAULT_LOCATOR_TIMEOUT,
} from './utilities/locatorUtils';

// Page utilities
export {
  isJavaScriptErrorInEvaluate,
  validateScreenshotFormat,
  extractIframeSrc,
} from './utilities/pageUtils';

// Element handle utilities - Key functions
export {
  isOperationSuccessful,
  isResultDisconnected,
  validateElementOperationResult,
  createDelayPromise,
  normalizeClickOptions,
  requiresEnhancedInteraction,
  createFillElementScript,
  createSelectOptionScript,
  createSelectTextScript,
  createKeyboardEventScript,
  isPrintableKey,
  validateSelectOption,
  normalizeSelectOptions,
  createElementOperationError,
  isSuccessfulOperation,
  isElementDisconnected,
  extractErrorMessage,
} from './utilities/elementHandleUtils';

// #endregion

// #region Download functionality
export { Download } from './operations/download';
export { DownloadManager } from './operations/downloadManager';
export type { DownloadInfo, DownloadEventData } from './operations/downloadManager';

// #endregion
