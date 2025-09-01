/**
 * Unified error utilities for consistent error handling across Cordyceps framework.
 *
 * This module provides standardized error creation functions with consistent
 * formatting and messaging patterns. All error messages follow the same structure
 * for better user experience and debugging.
 */

import { TIMEOUTS } from './constants';

// #region Pure Error Creation Functions

/**
 * Create a standardized error message for operation failures
 * Pure function for consistent error message formatting
 *
 * @param operation The operation that failed
 * @param details Optional additional error details
 * @returns Formatted error message
 */
export function createOperationFailedError(operation: string, details?: string): string {
  return `${operation} failed${details ? `: ${details}` : ''}`;
}

/**
 * Create a standardized error message for interaction failures
 * Pure function for interaction-specific error formatting
 *
 * @param action The interaction that failed (click, tap, type, etc.)
 * @param details Optional additional error details
 * @returns Formatted error message
 */
export function createInteractionError(action: string, details?: string): string {
  return details || `Failed to ${action.toLowerCase()} element`;
}

/**
 * Create a standardized error message for element not found scenarios
 * Pure function for element lookup error formatting
 *
 * @param selector The selector that didn't match any elements
 * @param context Optional context about where the lookup failed
 * @returns Formatted error message
 */
export function createElementNotFoundError(selector: string, context?: string): string {
  const baseMessage = `Element not found: ${selector}`;
  return context ? `${baseMessage} (${context})` : baseMessage;
}

/**
 * Create a standardized error message for locator-specific failures
 * Pure function for locator error formatting
 *
 * @param selector The selector used in the locator
 * @param operation Optional operation context
 * @returns Formatted error message
 */
export function createLocatorElementNotFoundError(selector: string, operation?: string): string {
  const baseMessage = `Locator element not found: ${selector}`;
  return operation ? `${baseMessage} during ${operation}` : baseMessage;
}

/**
 * Create a standardized error message for timeout failures
 * Pure function for timeout error formatting
 *
 * @param operation The operation that timed out
 * @param timeout The timeout value that was exceeded
 * @returns Formatted error message
 */
export function createTimeoutError(
  operation: string,
  timeout: number = TIMEOUTS.DEFAULT_OPERATION,
): string {
  return `${operation} timed out after ${timeout}ms`;
}

/**
 * Create a standardized error message for unsupported operations
 * Pure function for unsupported operation error formatting
 *
 * @param operation The operation that is not supported
 * @param reason Optional reason why it's not supported
 * @returns Formatted error message
 */
export function createUnsupportedOperationError(operation: string, reason?: string): string {
  const baseMessage = `${operation} is not supported`;
  return reason ? `${baseMessage}: ${reason}` : baseMessage;
}

/**
 * Create a standardized error message for frame-related operations
 * Pure function for frame error formatting
 *
 * @param operation The frame operation that failed
 * @param frameInfo Optional frame identification info
 * @returns Formatted error message
 */
export function createFrameError(operation: string, frameInfo?: string): string {
  const baseMessage = `Frame ${operation} failed`;
  return frameInfo ? `${baseMessage} for ${frameInfo}` : baseMessage;
}

/**
 * Create a standardized error message for validation failures
 * Pure function for validation error formatting
 *
 * @param field The field that failed validation
 * @param value The invalid value
 * @param expectedFormat Optional description of expected format
 * @returns Formatted error message
 */
export function createValidationError(
  field: string,
  value: unknown,
  expectedFormat?: string,
): string {
  const baseMessage = `Invalid ${field}: ${String(value)}`;
  return expectedFormat ? `${baseMessage}. Expected: ${expectedFormat}` : baseMessage;
}

/**
 * Create a standardized error message for checkbox state issues
 * Pure function for checkbox-specific error handling
 *
 * @returns Formatted error message for checkbox state validation
 */
export function createCheckboxStateError(): string {
  return 'Clicking the checkbox did not change its state';
}

/**
 * Create a standardized error message for drag and drop frame mismatches
 * Pure function for drag and drop error handling
 *
 * @returns Formatted error message for cross-frame drag and drop
 */
export function createDragAndDropFrameError(): string {
  return 'Drag and drop between different frames is not supported';
}

// #endregion

// #region Error Classification Utilities

/**
 * Check if an error is a JavaScript error during evaluation
 * Pure function for error type classification
 *
 * @param error The error to check
 * @returns True if the error is a JavaScript evaluation error
 */
export function isJavaScriptError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const jsErrorPatterns = [
    'ReferenceError',
    'TypeError',
    'SyntaxError',
    'RangeError',
    'EvalError',
    'URIError',
  ];

  return jsErrorPatterns.some(
    pattern => error.name.includes(pattern) || error.message.includes(pattern),
  );
}

/**
 * Check if an error indicates element disconnection
 * Pure function for connection status checking
 *
 * @param error The error to check
 * @returns True if the error indicates element disconnection
 */
export function isElementDisconnectedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const disconnectionPatterns = [
    'not attached',
    'element not found',
    'disconnected',
    'stale element',
  ];

  return disconnectionPatterns.some(pattern => error.message.toLowerCase().includes(pattern));
}

/**
 * Check if an error indicates a timeout
 * Pure function for timeout error detection
 *
 * @param error The error to check
 * @returns True if the error indicates a timeout
 */
export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.message.toLowerCase().includes('timeout') ||
    error.message.toLowerCase().includes('timed out')
  );
}

// #endregion
