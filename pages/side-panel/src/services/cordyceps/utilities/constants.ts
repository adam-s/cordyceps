/**
 * Centralized constants for Cordyceps framework.
 *
 * This module provides a single source of truth for all timeout values,
 * default settings, and configuration constants used across the framework.
 */

// #region Timeout Constants

/**
 * Standard timeout values used throughout the framework
 */
export const TIMEOUTS = {
  /** Default timeout for most operations (30 seconds) */
  DEFAULT_OPERATION: 30000,

  /** Short timeout for quick operations (5 seconds) */
  SHORT_OPERATION: 5000,

  /** Long timeout for complex operations (60 seconds) */
  LONG_OPERATION: 60000,

  /** Maximum timeout allowed (5 minutes) */
  MAX_TIMEOUT: 300000,
} as const;

/**
 * Default retry timeout sequence for operations
 */
export const DEFAULT_RETRY_TIMEOUTS = [0, 20, 50, 100, 100, 500] as const;

// #endregion

// #region Element State Constants

/**
 * Valid element wait states
 */
export const WAIT_STATES = {
  ATTACHED: 'attached',
  DETACHED: 'detached',
  VISIBLE: 'visible',
  HIDDEN: 'hidden',
} as const;

export type WaitState = (typeof WAIT_STATES)[keyof typeof WAIT_STATES];

// #endregion

// #region Configuration Defaults

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Default wait state for elements */
  WAIT_STATE: WAIT_STATES.VISIBLE,

  /** Default strict mode setting */
  STRICT_MODE: true,

  /** Default force option for interactions */
  FORCE_INTERACTION: false,

  /** Default test ID attribute name */
  TEST_ID_ATTRIBUTE: 'data-testid',

  /** Default screenshot format */
  SCREENSHOT_FORMAT: 'png',
} as const;

// #endregion

// #region Operation Result Constants

/**
 * Standard operation result values
 */
export const OPERATION_RESULTS = {
  SUCCESS: 'done',
  NOT_CONNECTED: 'error:notconnected',
} as const;

export type OperationResult = (typeof OPERATION_RESULTS)[keyof typeof OPERATION_RESULTS];

// #endregion
