/**
 * File handling utilities for Chrome extension environment
 *
 * This module provides browser-compatible file operations for:
 * - File upload handling via input elements
 * - File creation from various sources (strings, buffers, etc.)
 * - Basic file validation and conversion
 *
 * Note: Due to Chrome extension security restrictions, many file system
 * operations are not available. This implementation focuses on what's
 * possible in the browser/extension environment.
 */

/**
 * File payload for browser-based file operations
 */
export interface FilePayload {
  /**
   * File name (required)
   */
  name: string;

  /**
   * MIME type of the file
   */
  mimeType?: string;

  /**
   * File content as a buffer (Uint8Array or ArrayBuffer)
   */
  buffer?: Uint8Array | ArrayBuffer;

  /**
   * File content as a string (will be converted to buffer)
   */
  content?: string;

  /**
   * Last modified timestamp (defaults to current time)
   */
  lastModified?: number;
}

/**
 * Options for setInputFiles operation
 */
export interface SetInputFilesOptions {
  /**
   * Whether to force the operation even if element is not visible
   */
  force?: boolean;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Whether to clear existing files before setting new ones
   */
  noWaitAfter?: boolean;
}

/**
 * Maximum file size limit for browser operations (50MB)
 */
export const FILE_UPLOAD_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB

/**
 * Convert various file inputs to File objects for browser use
 */
export async function convertToFileObjects(
  files: string | FilePayload | string[] | FilePayload[],
): Promise<File[]> {
  const items = Array.isArray(files) ? files : [files];
  const fileObjects: File[] = [];

  for (const item of items) {
    if (typeof item === 'string') {
      // In browser environment, we cannot access file system paths directly
      // This is a limitation of the browser security model
      throw new Error(
        'File paths are not supported in browser/Chrome extension environment. ' +
          'Use FilePayload objects with buffer/content instead.',
      );
    } else {
      // Convert FilePayload to File object
      const fileObj = await convertFilePayloadToFile(item);
      fileObjects.push(fileObj);
    }
  }

  return fileObjects;
}

/**
 * Convert a FilePayload to a browser File object
 */
async function convertFilePayloadToFile(payload: FilePayload): Promise<File> {
  let buffer: Uint8Array;

  if (payload.buffer) {
    // Convert buffer to Uint8Array if needed
    buffer =
      payload.buffer instanceof ArrayBuffer ? new Uint8Array(payload.buffer) : payload.buffer;
  } else if (payload.content !== undefined) {
    // Convert string content to buffer
    buffer = new TextEncoder().encode(payload.content);
  } else {
    // Empty file
    buffer = new Uint8Array(0);
  }

  // Check size limit
  if (buffer.byteLength > FILE_UPLOAD_SIZE_LIMIT) {
    throw new Error(
      `File "${payload.name}" exceeds size limit of ${FILE_UPLOAD_SIZE_LIMIT} bytes ` +
        `(${buffer.byteLength} bytes)`,
    );
  }

  // Create File object
  const arrayBuffer =
    buffer.buffer instanceof ArrayBuffer
      ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      : new ArrayBuffer(buffer.byteLength);

  if (!(buffer.buffer instanceof ArrayBuffer)) {
    // Copy data if it's a SharedArrayBuffer
    new Uint8Array(arrayBuffer).set(buffer);
  }

  const file = new File([arrayBuffer], payload.name, {
    type: payload.mimeType || getMimeTypeFromExtension(payload.name),
    lastModified: payload.lastModified || Date.now(),
  });

  return file;
}

/**
 * Get MIME type from file extension (basic implementation)
 */
function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';

  const mimeTypes: Record<string, string> = {
    // Text files
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    xml: 'application/xml',
    csv: 'text/csv',

    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Archives
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',

    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    m4a: 'audio/mp4',

    // Video
    mp4: 'video/mp4',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Validate file inputs and check total size
 */
export function validateFileInputs(files: string | FilePayload | string[] | FilePayload[]): void {
  const items = Array.isArray(files) ? files : [files];
  let totalSize = 0;

  for (const item of items) {
    if (typeof item === 'string') {
      throw new Error(
        'File paths are not supported in browser/Chrome extension environment. ' +
          'Use FilePayload objects instead.',
      );
    }

    // Calculate size
    let itemSize = 0;
    if (item.buffer) {
      itemSize = item.buffer.byteLength;
    } else if (item.content) {
      itemSize = new TextEncoder().encode(item.content).byteLength;
    }

    totalSize += itemSize;

    // Validate individual file
    if (itemSize > FILE_UPLOAD_SIZE_LIMIT) {
      throw new Error(
        `File "${item.name}" exceeds size limit of ${FILE_UPLOAD_SIZE_LIMIT} bytes ` +
          `(${itemSize} bytes)`,
      );
    }

    if (!item.name || item.name.trim() === '') {
      throw new Error('File name is required');
    }
  }

  // Check total size
  if (totalSize > FILE_UPLOAD_SIZE_LIMIT) {
    throw new Error(
      `Total file size exceeds limit of ${FILE_UPLOAD_SIZE_LIMIT} bytes ` + `(${totalSize} bytes)`,
    );
  }
}

/**
 * Set files on an input element using the Files API
 * This is the core browser-compatible implementation
 */
export async function setInputElementFiles(
  inputElement: HTMLInputElement,
  files: File[],
): Promise<void> {
  if (inputElement.type !== 'file') {
    throw new Error('Element is not a file input');
  }

  try {
    // Create a new FileList-like object
    const dt = new DataTransfer();

    for (const file of files) {
      dt.items.add(file);
    }

    // Set the files on the input element
    inputElement.files = dt.files;

    // Trigger change events
    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  } catch (error) {
    throw new Error(
      `Failed to set files on input element: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create a File object from a string (useful for testing)
 */
export function createFileFromString(content: string, filename: string, mimeType?: string): File {
  const buffer = new TextEncoder().encode(content);
  return new File([buffer], filename, {
    type: mimeType || getMimeTypeFromExtension(filename),
    lastModified: Date.now(),
  });
}

/**
 * Create a File object from a buffer
 */
export function createFileFromBuffer(
  buffer: Uint8Array | ArrayBuffer,
  filename: string,
  mimeType?: string,
): File {
  const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

  // Ensure we have a proper ArrayBuffer
  const arrayBuffer =
    uint8Array.buffer instanceof ArrayBuffer
      ? uint8Array.buffer.slice(
          uint8Array.byteOffset,
          uint8Array.byteOffset + uint8Array.byteLength,
        )
      : new ArrayBuffer(uint8Array.byteLength);

  if (!(uint8Array.buffer instanceof ArrayBuffer)) {
    // Copy data if it's a SharedArrayBuffer
    new Uint8Array(arrayBuffer).set(uint8Array);
  }

  return new File([arrayBuffer], filename, {
    type: mimeType || getMimeTypeFromExtension(filename),
    lastModified: Date.now(),
  });
}

/**
 * Browser environment check utilities
 */
export const browserSupport = {
  /**
   * Check if File constructor is available
   */
  hasFileConstructor(): boolean {
    return typeof File !== 'undefined';
  },

  /**
   * Check if DataTransfer is available (for file setting)
   */
  hasDataTransfer(): boolean {
    return typeof DataTransfer !== 'undefined';
  },

  /**
   * Check if we can set files on input elements
   */
  canSetInputFiles(): boolean {
    return this.hasFileConstructor() && this.hasDataTransfer();
  },

  /**
   * Get supported file operations in current environment
   */
  getSupportedOperations(): string[] {
    const supported: string[] = [];

    if (this.hasFileConstructor()) {
      supported.push('File creation');
    }

    if (this.hasDataTransfer()) {
      supported.push('File upload via input elements');
    }

    if (typeof FileReader !== 'undefined') {
      supported.push('File reading');
    }

    if (typeof Blob !== 'undefined') {
      supported.push('Blob operations');
    }

    return supported;
  },
};

/**
 * Validate browser environment for file operations
 */
export function validateBrowserEnvironment(): void {
  if (!browserSupport.canSetInputFiles()) {
    const supported = browserSupport.getSupportedOperations();
    throw new Error(
      'Browser environment does not support required file operations. ' +
        `Supported operations: ${supported.join(', ')}`,
    );
  }
}
