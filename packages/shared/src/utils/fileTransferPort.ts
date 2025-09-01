/**
 * File Transfer Port API for temporary connections between content script and side panel.
 * This module provides interfaces and utilities for transferring files and buffers.
 */

export interface FileTransferPortMessage {
  type: 'file-transfer-port';
  action: 'create' | 'close' | 'transfer' | 'ack' | 'error';
  data?: unknown;
  portId?: string;
  transferId?: string;
  error?: string;
}

export interface FileTransferRequest {
  transferId: string;
  filename: string;
  mimeType: string;
  size: number;
  chunks: number;
}

export interface FileChunk {
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  data: ArrayBuffer | number[]; // Support both ArrayBuffer and serialized number array
}

// Metadata for initiating an incoming buffer/file transfer from side panel -> content
export interface IncomingFileMeta {
  transferId: string;
  filename: string;
  mimeType: string;
  size: number;
  chunks: number;
}

export interface BufferTransferRequest {
  transferId: string;
  bufferType: 'image' | 'binary' | 'text';
  mimeType?: string;
  size: number;
  chunks: number;
}

export interface TransferProgress {
  transferId: string;
  chunksReceived: number;
  totalChunks: number;
  bytesReceived: number;
  totalBytes: number;
}

export interface TransferComplete {
  transferId: string;
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
}

/**
 * Events that can be sent over the file transfer port
 */
export type FileTransferEvent =
  | { type: 'transfer-start'; request: FileTransferRequest | BufferTransferRequest }
  | { type: 'chunk'; chunk: FileChunk }
  | { type: 'progress'; progress: TransferProgress }
  | { type: 'transfer-complete'; result: TransferComplete }
  | { type: 'error'; transferId: string; error: string };

/**
 * Commands that can be sent from side panel to content script
 */
export type FileTransferCommand =
  | { type: 'request-file'; selector: string; attribute?: string }
  | { type: 'request-image'; selector: string; format?: 'blob' | 'dataurl' | 'canvas' }
  | { type: 'request-buffer'; selector: string; bufferType: 'image' | 'binary' | 'text' }
  | { type: 'cancel-transfer'; transferId: string }
  // Start sending a file/buffer from side panel to content script
  | { type: 'receive-file-start'; meta: IncomingFileMeta }
  // Send one chunk of a file/buffer to content script
  | { type: 'receive-file-chunk'; chunk: FileChunk }
  // Complete a file/buffer transfer to content script
  | { type: 'receive-file-complete'; transferId: string };

// Message types for the shared message system
export const CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE =
  'crx-deep-research:fileTransferPortCreate';
export const CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_MESSAGE =
  'crx-deep-research:fileTransferPortMessage';

export interface IFileTransferPortCreateMessage {
  type: typeof CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE;
  portId: string;
  tabId: number;
  frameId: number;
}

export interface IFileTransferPortMessage {
  type: typeof CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_MESSAGE;
  portId: string;
  event: FileTransferEvent;
}
