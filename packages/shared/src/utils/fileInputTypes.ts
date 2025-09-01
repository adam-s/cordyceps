/**
 * File payload interface that mimics Playwright's FilePayload but adapted for Chrome extensions
 */
export interface FilePayload {
  /**
   * File name
   */
  name: string;

  /**
   * File type (MIME type)
   */
  mimeType: string;

  /**
   * File data as ArrayBuffer
   */
  buffer: ArrayBuffer;
}

/**
 * Options for setting input files, following Playwright patterns
 */
export interface SetInputFilesOptions {
  /**
   * Whether to bypass actionability checks (visibility, enabled state, etc.)
   */
  force?: boolean;

  /**
   * Maximum time to wait for the operation to complete
   */
  timeout?: number;

  /**
   * Whether this is for directory upload (webkitdirectory)
   */
  directoryUpload?: boolean;
}

/**
 * Internal structure for validated file data
 */
export interface ValidatedFileData {
  files: FilePayload[];
  multiple: boolean;
  directoryUpload: boolean;
}

/**
 * File input validation result
 */
export interface FileInputValidation {
  element: HTMLInputElement;
  canAcceptMultiple: boolean;
  isDirectoryInput: boolean;
  isConnected: boolean;
}
