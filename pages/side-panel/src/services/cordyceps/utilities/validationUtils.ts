/**
 * Validation utilities for consistent data validation across Cordyceps framework.
 *
 * This module provides standardized validation functions for common data types
 * and operations. All validation functions are pure and throw descriptive errors
 * when validation fails.
 */

import { TIMEOUTS, WAIT_STATES, DEFAULTS } from './constants';
import { createValidationError, createTimeoutError } from './errorUtils';

// #region Selector Validation

/**
 * Validate that a selector string is not empty
 * Pure function for selector validation
 *
 * @param selector The selector to validate
 * @returns True if selector is valid
 * @throws Error if selector is invalid
 */
export function validateSelector(selector: string): boolean {
  if (!selector || typeof selector !== 'string' || selector.trim().length === 0) {
    throw new Error(createValidationError('selector', selector, 'non-empty string'));
  }
  return true;
}

/**
 * Validate that a wait state is supported
 * Pure function for wait state validation
 *
 * @param state The state to validate
 * @returns True if the state is valid
 * @throws Error if state is invalid
 */
export function validateWaitState(state: string): boolean {
  const validStates = Object.values(WAIT_STATES) as string[];
  if (!validStates.includes(state)) {
    throw new Error(createValidationError('wait state', state, validStates.join(', ')));
  }
  return true;
}

// #endregion

// #region Timeout Validation

/**
 * Validate timeout value against reasonable limits
 * Pure function for timeout validation
 *
 * @param timeout The timeout to validate
 * @param maxTimeout Optional maximum timeout limit
 * @returns True if timeout is valid
 * @throws Error if timeout is invalid
 */
export function validateTimeout(
  timeout?: number,
  maxTimeout: number = TIMEOUTS.MAX_TIMEOUT,
): boolean {
  if (timeout !== undefined) {
    if (typeof timeout !== 'number' || timeout < 0) {
      throw new Error(createValidationError('timeout', timeout, 'positive number'));
    }
    if (timeout > maxTimeout) {
      throw new Error(createTimeoutError('Timeout value too large', maxTimeout));
    }
  }
  return true;
}

/**
 * Validate that timeout is within short operation limits
 * Pure function for short timeout validation
 *
 * @param timeout The timeout to validate
 * @returns True if timeout is valid for short operations
 * @throws Error if timeout is too large
 */
export function validateShortTimeout(timeout?: number): boolean {
  return validateTimeout(timeout, TIMEOUTS.SHORT_OPERATION);
}

/**
 * Validate that timeout is within standard operation limits
 * Pure function for standard timeout validation
 *
 * @param timeout The timeout to validate
 * @returns True if timeout is valid for standard operations
 * @throws Error if timeout is too large
 */
export function validateStandardTimeout(timeout?: number): boolean {
  return validateTimeout(timeout, TIMEOUTS.DEFAULT_OPERATION);
}

// #endregion

// #region Element Interaction Validation

/**
 * Validate coordinates for element interactions
 * Pure function for coordinate validation
 *
 * @param x The x coordinate
 * @param y The y coordinate
 * @returns True if coordinates are valid
 * @throws Error if coordinates are invalid
 */
export function validateCoordinates(x: number, y: number): boolean {
  if (typeof x !== 'number' || typeof y !== 'number') {
    throw new Error(createValidationError('coordinates', `(${x}, ${y})`, 'numeric values'));
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(createValidationError('coordinates', `(${x}, ${y})`, 'finite numbers'));
  }
  return true;
}

/**
 * Validate bounding box has positive dimensions
 * Pure function for bounding box validation
 *
 * @param boundingBox The bounding box to validate
 * @returns True if bounding box is valid
 * @throws Error if bounding box is invalid
 */
export function validateBoundingBox(boundingBox: {
  x: number;
  y: number;
  width: number;
  height: number;
}): boolean {
  validateCoordinates(boundingBox.x, boundingBox.y);

  if (boundingBox.width <= 0 || boundingBox.height <= 0) {
    throw new Error(
      createValidationError(
        'bounding box dimensions',
        `${boundingBox.width}x${boundingBox.height}`,
        'positive dimensions',
      ),
    );
  }

  return true;
}

// #endregion

// #region File and Format Validation

/**
 * Validate screenshot format
 * Pure function for screenshot format validation
 *
 * @param format The format to validate
 * @returns True if format is supported
 * @throws Error if format is not supported
 */
export function validateScreenshotFormat(format: string): boolean {
  if (format !== DEFAULTS.SCREENSHOT_FORMAT) {
    throw new Error(createValidationError('screenshot format', format, DEFAULTS.SCREENSHOT_FORMAT));
  }
  return true;
}

/**
 * Validate file path is not empty and has valid format
 * Pure function for file path validation
 *
 * @param filePath The file path to validate
 * @returns True if file path is valid
 * @throws Error if file path is invalid
 */
export function validateFilePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new Error(createValidationError('file path', filePath, 'non-empty string'));
  }
  return true;
}

// #endregion

// #region Options Validation

/**
 * Validate boolean option values
 * Pure function for boolean option validation
 *
 * @param value The value to validate
 * @param optionName The name of the option for error messages
 * @returns True if value is valid boolean
 * @throws Error if value is not boolean
 */
export function validateBooleanOption(value: unknown, optionName: string): boolean {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(createValidationError(optionName, value, 'boolean or undefined'));
  }
  return true;
}

/**
 * Validate string option values
 * Pure function for string option validation
 *
 * @param value The value to validate
 * @param optionName The name of the option for error messages
 * @param allowEmpty Whether empty strings are allowed
 * @returns True if value is valid string
 * @throws Error if value is not valid string
 */
export function validateStringOption(
  value: unknown,
  optionName: string,
  allowEmpty: boolean = true,
): boolean {
  if (value !== undefined) {
    if (typeof value !== 'string') {
      throw new Error(createValidationError(optionName, value, 'string or undefined'));
    }
    if (!allowEmpty && value.trim().length === 0) {
      throw new Error(createValidationError(optionName, value, 'non-empty string'));
    }
  }
  return true;
}

/**
 * Validate numeric option values within range
 * Pure function for numeric option validation
 *
 * @param value The value to validate
 * @param optionName The name of the option for error messages
 * @param min Optional minimum value
 * @param max Optional maximum value
 * @returns True if value is valid number
 * @throws Error if value is not valid number or out of range
 */
export function validateNumericOption(
  value: unknown,
  optionName: string,
  min?: number,
  max?: number,
): boolean {
  if (value !== undefined) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(createValidationError(optionName, value, 'finite number or undefined'));
    }

    if (min !== undefined && value < min) {
      throw new Error(createValidationError(optionName, value, `number >= ${min}`));
    }

    if (max !== undefined && value > max) {
      throw new Error(createValidationError(optionName, value, `number <= ${max}`));
    }
  }
  return true;
}

// #endregion
