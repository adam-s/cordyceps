/**
 * Buffer utilities for consistent buffer handling across browser and Node.js environments.
 *
 * This module provides standardized buffer conversion functions that work reliably
 * across different JavaScript environments, handling the differences between
 * browser ArrayBuffer/Uint8Array, custom BrowserBuffer, and Node.js Buffer objects.
 */

// #region Type Definitions

/**
 * Interface for browser buffer objects (like the one from screenshotter)
 */
export interface BrowserBufferLike {
  length: number;
  toString(encoding: 'base64' | 'utf8'): string;
}

// #endregion

// #region Pure Buffer Conversion Functions

/**
 * Convert browser buffer data to Node.js Buffer
 * Pure function for browser-to-Node buffer conversion
 *
 * @param browserBuffer Buffer data from browser (Uint8Array, ArrayBuffer, or BrowserBufferLike)
 * @returns Node.js Buffer instance
 */
export function convertBrowserBufferToNodeBuffer(
  browserBuffer: Uint8Array | ArrayBuffer | BrowserBufferLike,
): Buffer {
  // Handle BrowserBuffer-like objects with toString method
  if (
    browserBuffer &&
    typeof (browserBuffer as BrowserBufferLike).length === 'number' &&
    typeof (browserBuffer as BrowserBufferLike).toString === 'function'
  ) {
    const base64 = (browserBuffer as BrowserBufferLike).toString('base64');
    return Buffer.from(base64, 'base64');
  }

  if (browserBuffer instanceof ArrayBuffer) {
    return Buffer.from(browserBuffer);
  }

  if (browserBuffer instanceof Uint8Array) {
    return Buffer.from(browserBuffer);
  }

  throw new Error('Unsupported browser buffer type');
}

/**
 * Convert various buffer types to Node.js Buffer
 * Pure function for universal buffer conversion
 *
 * @param buffer Input buffer data of various types
 * @returns Node.js Buffer instance
 */
export function convertToNodeBuffer(
  buffer: Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike,
): Buffer {
  if (Buffer.isBuffer(buffer)) {
    return buffer;
  }

  // Handle BrowserBuffer-like objects with toString method
  if (
    buffer &&
    typeof (buffer as BrowserBufferLike).length === 'number' &&
    typeof (buffer as BrowserBufferLike).toString === 'function'
  ) {
    const base64 = (buffer as BrowserBufferLike).toString('base64');
    return Buffer.from(base64, 'base64');
  }

  if (buffer instanceof ArrayBuffer) {
    return Buffer.from(buffer);
  }

  if (buffer instanceof Uint8Array) {
    return Buffer.from(buffer);
  }

  throw new Error('Unsupported buffer type');
}

/**
 * Check if a value is a valid buffer type
 * Pure function for buffer type validation
 *
 * @param value The value to check
 * @returns True if the value is a recognized buffer type
 */
export function isValidBufferType(
  value: unknown,
): value is Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike {
  return (
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    Buffer.isBuffer(value) ||
    (value !== null &&
      value !== undefined &&
      typeof (value as BrowserBufferLike).length === 'number' &&
      typeof (value as BrowserBufferLike).toString === 'function')
  );
}

/**
 * Get buffer size for any supported buffer type
 * Pure function for buffer size calculation
 *
 * @param buffer Buffer of any supported type
 * @returns Size of the buffer in bytes
 */
export function getBufferSize(
  buffer: Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike,
): number {
  if (Buffer.isBuffer(buffer)) {
    return buffer.length;
  }

  // Handle BrowserBuffer-like objects with length property
  if (
    buffer &&
    typeof (buffer as BrowserBufferLike).length === 'number' &&
    typeof (buffer as BrowserBufferLike).toString === 'function'
  ) {
    return (buffer as BrowserBufferLike).length;
  }

  if (buffer instanceof ArrayBuffer) {
    return buffer.byteLength;
  }

  if (buffer instanceof Uint8Array) {
    return buffer.length;
  }

  throw new Error('Unsupported buffer type for size calculation');
}

/**
 * Convert buffer to base64 string
 * Pure function for buffer-to-base64 conversion
 *
 * @param buffer Buffer of any supported type
 * @returns Base64 encoded string
 */
export function bufferToBase64(
  buffer: Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike,
): string {
  const nodeBuffer = convertToNodeBuffer(buffer);
  return nodeBuffer.toString('base64');
}

/**
 * Convert base64 string to Node.js Buffer
 * Pure function for base64-to-buffer conversion
 *
 * @param base64String Base64 encoded string
 * @returns Node.js Buffer instance
 */
export function base64ToBuffer(base64String: string): Buffer {
  return Buffer.from(base64String, 'base64');
}

/**
 * Compare two buffers for equality
 * Pure function for buffer comparison
 *
 * @param buffer1 First buffer to compare
 * @param buffer2 Second buffer to compare
 * @returns True if buffers contain identical data
 */
export function buffersEqual(
  buffer1: Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike,
  buffer2: Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike,
): boolean {
  const nodeBuffer1 = convertToNodeBuffer(buffer1);
  const nodeBuffer2 = convertToNodeBuffer(buffer2);

  return nodeBuffer1.equals(nodeBuffer2);
}

/**
 * Create a copy of a buffer
 * Pure function for buffer duplication
 *
 * @param buffer Buffer to copy
 * @returns New buffer with identical content
 */
export function copyBuffer(buffer: Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike): Buffer {
  const nodeBuffer = convertToNodeBuffer(buffer);
  return Buffer.from(nodeBuffer);
}

// #endregion

// #region Buffer Validation Functions

/**
 * Validate that a buffer is not empty
 * Pure function for buffer emptiness validation
 *
 * @param buffer Buffer to validate
 * @returns True if buffer has content
 */
export function isBufferNotEmpty(
  buffer: Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike,
): boolean {
  return getBufferSize(buffer) > 0;
}

/**
 * Validate buffer size against minimum requirement
 * Pure function for buffer size validation
 *
 * @param buffer Buffer to validate
 * @param minSize Minimum required size in bytes
 * @returns True if buffer meets minimum size requirement
 */
export function validateBufferSize(
  buffer: Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike,
  minSize: number,
): boolean {
  return getBufferSize(buffer) >= minSize;
}

/**
 * Validate buffer size against maximum limit
 * Pure function for buffer size limit validation
 *
 * @param buffer Buffer to validate
 * @param maxSize Maximum allowed size in bytes
 * @returns True if buffer is within size limit
 */
export function validateBufferMaxSize(
  buffer: Uint8Array | ArrayBuffer | Buffer | BrowserBufferLike,
  maxSize: number,
): boolean {
  return getBufferSize(buffer) <= maxSize;
}

// #endregion
