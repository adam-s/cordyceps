/**
 * File Transfer Port Manager for handling file transfer operations.
 */

export interface FileTransferPort {
  id: string;
  portId: string;
  close(): void;
}

export class FileTransferPortManager {
  private _ports = new Map<string, FileTransferPort>();

  createPort(): FileTransferPort {
    const id = `port_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const port: FileTransferPort = {
      id,
      portId: id,
      close: () => {
        this._ports.delete(id);
      },
    };
    this._ports.set(id, port);
    return port;
  }

  getPort(id: string): FileTransferPort | undefined {
    return this._ports.get(id);
  }

  closePort(id: string): void {
    const port = this._ports.get(id);
    if (port) {
      port.close();
    }
  }

  closeAllPorts(): void {
    for (const port of this._ports.values()) {
      port.close();
    }
    this._ports.clear();
  }
}
