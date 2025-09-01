import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import {
  FileTransferEvent,
  FileTransferCommand,
  FileTransferRequest,
  BufferTransferRequest,
  FileChunk,
  TransferProgress,
  TransferComplete,
  CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE,
} from '@shared/utils/fileTransferPort';

/**
 * File Transfer Port Controller for the side panel.
 * Manages communication with content script file transfer ports.
 */
export class FileTransferPortController extends Disposable {
  private readonly _activePorts = new Map<string, FileTransferPortConnection>();

  private readonly _onPortCreated = this._register(new Emitter<FileTransferPortConnection>());
  readonly onPortCreated: Event<FileTransferPortConnection> = this._onPortCreated.event;

  private readonly _onPortClosed = this._register(new Emitter<string>());
  readonly onPortClosed: Event<string> = this._onPortClosed.event;

  constructor() {
    super();
    this._setupMessageListener();
  }

  /**
   * Gets an active port connection by ID.
   */
  getPort(portId: string): FileTransferPortConnection | undefined {
    return this._activePorts.get(portId);
  }

  /**
   * Gets all active port connections.
   */
  getAllPorts(): FileTransferPortConnection[] {
    return Array.from(this._activePorts.values());
  }

  /**
   * Closes a specific port connection.
   */
  closePort(portId: string): void {
    const port = this._activePorts.get(portId);
    if (port) {
      port.close();
      this._activePorts.delete(portId);
      this._onPortClosed.fire(portId);
    }
  }

  /**
   * Closes all active port connections.
   */
  closeAllPorts(): void {
    for (const [, port] of this._activePorts) {
      port.close();
    }
    this._activePorts.clear();
  }

  /**
   * Sets up the message listener for port creation notifications.
   */
  private _setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE) {
        const portId = message.portId as string;
        const tabId = sender.tab?.id;
        const frameId = sender.frameId;

        if (tabId !== undefined && frameId !== undefined) {
          const connection = new FileTransferPortConnection(portId, tabId, frameId);
          this._activePorts.set(portId, connection);
          this._onPortCreated.fire(connection);

          // Set up cleanup when port closes
          connection.onClosed(() => {
            this._activePorts.delete(portId);
            this._onPortClosed.fire(portId);
          });

          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Missing tab or frame information' });
        }
        return true;
      }

      // Handle port events
      if (message.type === 'crx-deep-research:fileTransferPortEvent') {
        const portId = message.portId as string;
        const event = message.event as FileTransferEvent;
        const port = this._activePorts.get(portId);

        if (port) {
          port._handleEvent(event);
        }

        sendResponse({ success: true });
        return true;
      }

      return false;
    });
  }

  dispose(): void {
    this.closeAllPorts();
    super.dispose();
  }
}

/**
 * Represents a connection to a file transfer port in a content script.
 */
export class FileTransferPortConnection extends Disposable {
  readonly portId: string;
  readonly tabId: number;
  readonly frameId: number;

  private readonly _onEvent = this._register(new Emitter<FileTransferEvent>());
  readonly onEvent: Event<FileTransferEvent> = this._onEvent.event;

  private readonly _onTransferStart = this._register(
    new Emitter<FileTransferRequest | BufferTransferRequest>(),
  );
  readonly onTransferStart: Event<FileTransferRequest | BufferTransferRequest> =
    this._onTransferStart.event;

  private readonly _onChunk = this._register(new Emitter<FileChunk>());
  readonly onChunk: Event<FileChunk> = this._onChunk.event;

  private readonly _onProgress = this._register(new Emitter<TransferProgress>());
  readonly onProgress: Event<TransferProgress> = this._onProgress.event;

  private readonly _onTransferComplete = this._register(new Emitter<TransferComplete>());
  readonly onTransferComplete: Event<TransferComplete> = this._onTransferComplete.event;

  private readonly _onError = this._register(new Emitter<{ transferId: string; error: string }>());
  readonly onError: Event<{ transferId: string; error: string }> = this._onError.event;

  private readonly _onClosed = this._register(new Emitter<void>());
  readonly onClosed: Event<void> = this._onClosed.event;

  private readonly _activeTransfers = new Map<string, ReceivingTransfer>();
  private _isOpen = true;

  constructor(portId: string, tabId: number, frameId: number) {
    super();
    this.portId = portId;
    this.tabId = tabId;
    this.frameId = frameId;
  }

  /**
   * Checks if the port connection is still open.
   */
  get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Sends a command to the content script port.
   */
  async sendCommand(command: FileTransferCommand): Promise<void> {
    if (!this._isOpen) {
      throw new Error('Port connection is closed');
    }

    try {
      // Serialize ArrayBuffers to transferable format
      const serializedCommand = this._serializeCommand(command);

      await chrome.tabs.sendMessage(this.tabId, {
        type: 'crx-deep-research:fileTransferPortCommand',
        portId: this.portId,
        command: serializedCommand,
      });
    } catch (error) {
      throw new Error(
        `Failed to send command: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Serializes commands to handle ArrayBuffer data that can't be sent through Chrome messaging
   */
  private _serializeCommand(command: FileTransferCommand): FileTransferCommand {
    if (command.type === 'receive-file-chunk' && command.chunk.data instanceof ArrayBuffer) {
      // Convert ArrayBuffer to Uint8Array for serialization
      const uint8Array = new Uint8Array(command.chunk.data);
      return {
        ...command,
        chunk: {
          ...command.chunk,
          data: Array.from(uint8Array) as number[], // Convert to number array for serialization
        },
      };
    }
    return command;
  }

  /**
   * Requests a file from the content script.
   */
  async requestFile(selector: string, attribute?: string): Promise<string> {
    const command: FileTransferCommand = {
      type: 'request-file',
      selector,
      attribute,
    };

    await this.sendCommand(command);

    // Return a promise that resolves when the transfer completes
    return new Promise((resolve, reject) => {
      const disposables: (() => void)[] = [];

      const onComplete = (result: TransferComplete) => {
        if (result.success) {
          resolve(result.transferId);
        } else {
          reject(new Error(result.error || 'Transfer failed'));
        }
        disposables.forEach(dispose => dispose());
      };

      const onError = (error: { transferId: string; error: string }) => {
        reject(new Error(error.error));
        disposables.forEach(dispose => dispose());
      };

      disposables.push(this.onTransferComplete(onComplete).dispose);
      disposables.push(this.onError(onError).dispose);
    });
  }

  /**
   * Requests an image from the content script.
   */
  async requestImage(
    selector: string,
    format: 'blob' | 'dataurl' | 'canvas' = 'blob',
  ): Promise<string> {
    const command: FileTransferCommand = {
      type: 'request-image',
      selector,
      format,
    };

    await this.sendCommand(command);

    return new Promise((resolve, reject) => {
      const disposables: (() => void)[] = [];

      const onComplete = (result: TransferComplete) => {
        if (result.success) {
          resolve(result.transferId);
        } else {
          reject(new Error(result.error || 'Transfer failed'));
        }
        disposables.forEach(dispose => dispose());
      };

      const onError = (error: { transferId: string; error: string }) => {
        reject(new Error(error.error));
        disposables.forEach(dispose => dispose());
      };

      disposables.push(this.onTransferComplete(onComplete).dispose);
      disposables.push(this.onError(onError).dispose);
    });
  }

  /**
   * Requests a buffer from the content script.
   */
  async requestBuffer(selector: string, bufferType: 'image' | 'binary' | 'text'): Promise<string> {
    const command: FileTransferCommand = {
      type: 'request-buffer',
      selector,
      bufferType,
    };

    await this.sendCommand(command);

    return new Promise((resolve, reject) => {
      const disposables: (() => void)[] = [];

      const onComplete = (result: TransferComplete) => {
        if (result.success) {
          resolve(result.transferId);
        } else {
          reject(new Error(result.error || 'Transfer failed'));
        }
        disposables.forEach(dispose => dispose());
      };

      const onError = (error: { transferId: string; error: string }) => {
        reject(new Error(error.error));
        disposables.forEach(dispose => dispose());
      };

      disposables.push(this.onTransferComplete(onComplete).dispose);
      disposables.push(this.onError(onError).dispose);
    });
  }

  /**
   * Cancels an active transfer.
   */
  async cancelTransfer(transferId: string): Promise<void> {
    const command: FileTransferCommand = {
      type: 'cancel-transfer',
      transferId,
    };

    await this.sendCommand(command);
    this._activeTransfers.delete(transferId);
  }

  /**
   * Gets the data for a completed transfer.
   */
  getTransferData(transferId: string): ArrayBuffer | undefined {
    const transfer = this._activeTransfers.get(transferId);
    return transfer?.getData();
  }

  /**
   * Gets information about an active transfer.
   */
  getTransferInfo(transferId: string):
    | {
        request: FileTransferRequest | BufferTransferRequest;
        chunksReceived: number;
        bytesReceived: number;
      }
    | undefined {
    const transfer = this._activeTransfers.get(transferId);
    if (!transfer) {
      return undefined;
    }

    return {
      request: transfer.request,
      chunksReceived: transfer.chunksReceived.size,
      bytesReceived: transfer.bytesReceived,
    };
  }

  /**
   * Closes the port connection.
   */
  close(): void {
    if (!this._isOpen) {
      return;
    }

    this._isOpen = false;
    this._activeTransfers.clear();
    this._onClosed.fire();
  }

  /**
   * Internal method to handle events from the content script.
   */
  _handleEvent(event: FileTransferEvent): void {
    this._onEvent.fire(event);

    switch (event.type) {
      case 'transfer-start':
        this._handleTransferStart(event.request);
        break;
      case 'chunk':
        this._handleChunk(event.chunk);
        break;
      case 'progress':
        this._handleProgress(event.progress);
        break;
      case 'transfer-complete':
        this._handleTransferComplete(event.result);
        break;
      case 'error':
        this._handleError(event.transferId, event.error);
        break;
    }
  }

  private _handleTransferStart(request: FileTransferRequest | BufferTransferRequest): void {
    const transfer = new ReceivingTransfer(request);
    this._activeTransfers.set(request.transferId, transfer);
    this._onTransferStart.fire(request);
  }

  private _handleChunk(chunk: FileChunk): void {
    const transfer = this._activeTransfers.get(chunk.transferId);
    if (transfer) {
      transfer.addChunk(chunk);
    }
    this._onChunk.fire(chunk);
  }

  private _handleProgress(progress: TransferProgress): void {
    this._onProgress.fire(progress);
  }

  private _handleTransferComplete(result: TransferComplete): void {
    const transfer = this._activeTransfers.get(result.transferId);
    if (transfer && result.success) {
      result.data = transfer.getData();
    }
    this._onTransferComplete.fire(result);
  }

  private _handleError(transferId: string, error: string): void {
    this._activeTransfers.delete(transferId);
    this._onError.fire({ transferId, error });
  }

  /**
   * Sends a buffer to the content script over this port in chunks.
   * Returns the transferId used for this send.
   */
  async sendBuffer(
    buffer: ArrayBuffer,
    meta: { filename: string; mimeType: string },
    chunkSize: number = 64 * 1024,
  ): Promise<string> {
    const transferId = crypto.randomUUID();
    const totalChunks = Math.ceil(buffer.byteLength / chunkSize);

    // Start
    await this.sendCommand({
      type: 'receive-file-start',
      meta: {
        transferId,
        filename: meta.filename,
        mimeType: meta.mimeType,
        size: buffer.byteLength,
        chunks: totalChunks,
      },
    });

    // Chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, buffer.byteLength);
      const chunk = buffer.slice(start, end);
      await this.sendCommand({
        type: 'receive-file-chunk',
        chunk: {
          transferId,
          chunkIndex: i,
          totalChunks,
          data: chunk,
        },
      });
    }

    // Complete
    await this.sendCommand({ type: 'receive-file-complete', transferId });
    return transferId;
  }
}

/**
 * Tracks a receiving transfer and assembles chunks.
 */
class ReceivingTransfer {
  readonly request: FileTransferRequest | BufferTransferRequest;
  readonly chunksReceived = new Map<number, ArrayBuffer>();
  bytesReceived = 0;

  constructor(request: FileTransferRequest | BufferTransferRequest) {
    this.request = request;
  }

  addChunk(chunk: FileChunk): void {
    // Ensure we have an ArrayBuffer (should always be the case on side panel side)
    const data = chunk.data instanceof ArrayBuffer ? chunk.data : new Uint8Array(chunk.data).buffer;
    this.chunksReceived.set(chunk.chunkIndex, data);
    this.bytesReceived += data.byteLength;
  }

  getData(): ArrayBuffer | undefined {
    if (this.chunksReceived.size !== this.request.chunks) {
      return undefined;
    }

    // Assemble chunks in order
    const chunks: ArrayBuffer[] = [];
    for (let i = 0; i < this.request.chunks; i++) {
      const chunk = this.chunksReceived.get(i);
      if (!chunk) {
        return undefined;
      }
      chunks.push(chunk);
    }

    // Combine all chunks into a single ArrayBuffer
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new ArrayBuffer(totalSize);
    const resultView = new Uint8Array(result);
    let offset = 0;

    for (const chunk of chunks) {
      resultView.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return result;
  }

  get isComplete(): boolean {
    return this.chunksReceived.size >= this.request.chunks;
  }
}
