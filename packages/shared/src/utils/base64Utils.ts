/**
 * Base64 utility functions for Chrome extension file transfer operations.
 * These utilities handle conversion between ArrayBuffer and base64 strings
 * for cross-context data transfer without requiring file transfer ports.
 */

/**
 * Converts an ArrayBuffer to a base64 string.
 * This is useful for sending binary data through Chrome extension messaging.
 *
 * @param buffer - The ArrayBuffer to convert
 * @returns Base64 encoded string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  // Process in chunks to avoid call stack overflow for large files
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

/**
 * Converts a base64 string back to an ArrayBuffer.
 * This is used to reconstruct binary data from base64 strings.
 *
 * @param base64 - The base64 encoded string
 * @returns ArrayBuffer containing the binary data
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Creates a File object from base64 data.
 * This is useful for reconstructing File objects in content scripts.
 *
 * @param name - The filename
 * @param mimeType - The MIME type of the file
 * @param base64 - The base64 encoded file data
 * @returns File object ready for use with input elements
 */
export function createFileFromBase64(name: string, mimeType: string, base64: string): File {
  const buffer = base64ToArrayBuffer(base64);
  const blob = new Blob([buffer], { type: mimeType });
  return new File([blob], name, { type: mimeType });
}

/**
 * Converts a File object to base64 representation.
 * This is useful for preparing files for transfer through Chrome messaging.
 *
 * @param file - The File object to convert
 * @returns Promise resolving to base64 file data
 */
export async function fileToBase64(file: File): Promise<{
  name: string;
  mimeType: string;
  size: number;
  base64: string;
}> {
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  return {
    name: file.name,
    mimeType: file.type,
    size: file.size,
    base64,
  };
}

/**
 * Interface for base64 file data used in transfers.
 */
export interface Base64FileData {
  name: string;
  mimeType: string;
  size: number;
  base64: string;
}

/**
 * Validates that a base64 string is well-formed.
 *
 * @param base64 - The base64 string to validate
 * @returns True if valid base64, false otherwise
 */
export function isValidBase64(base64: string): boolean {
  try {
    return btoa(atob(base64)) === base64;
  } catch {
    return false;
  }
}

/**
 * Estimates the size of a base64 string when decoded.
 * Base64 encoding increases size by approximately 33%.
 *
 * @param base64 - The base64 string
 * @returns Estimated decoded size in bytes
 */
export function estimateDecodedSize(base64: string): number {
  // Remove padding and calculate actual data length
  const dataLength = base64.length * 0.75;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor(dataLength - padding);
}
