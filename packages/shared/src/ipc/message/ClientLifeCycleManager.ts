import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';

/**
 * Interface for client lifecycle management
 */
export interface IClientLifeCycleManager extends IDisposable {
  /**
   * Dispose all managed resources and clean up clients
   */
  dispose(): void;
}

/**
 * Record for tracking managed clients
 */
export interface IManagedClientRecord {
  clientId: string;
  disconnect: () => void;
  deleteClient: () => void;
  selfDisconnectListenerDisposable: IDisposable;
}

/**
 * Abstract base class for client lifecycle management across different environments
 */
export abstract class ClientLifeCycleManager
  extends DisposableStore
  implements IClientLifeCycleManager
{
  protected readonly managedClients = new Map<string | number, IManagedClientRecord>();

  constructor() {
    super();
    // No longer call initializeEventHandlers() here.
    // The subclass (or the caller) will attach the handlers explicitly.
  }

  /**
   * Let subclasses (or callers) hook up whatever events they need—
   * e.g. messageServer.onDidClientConnect, tabMonitor.onTabRemoved, etc.
   */
  public abstract attachEventHandlers(): void;

  /**
   * Handle client connection events
   * Common logic for managing client connections
   */
  protected handleClientConnect(
    clientId: string,
    key: string | number,
    disconnect: () => void,
    deleteClient: () => void,
    onDidClientDisconnect: IDisposable,
  ): void {
    // Clean up existing client for this key if it exists
    const existing = this.managedClients.get(key);
    if (existing) {
      existing.selfDisconnectListenerDisposable.dispose();
      existing.disconnect();
      existing.deleteClient();
      this.managedClients.delete(key);
    }

    // IPC Step 8: Add new client to managed clients
    this.managedClients.set(key, {
      clientId,
      disconnect,
      deleteClient,
      selfDisconnectListenerDisposable: onDidClientDisconnect,
    });
  }

  /**
   * Handle client disconnection by key
   */
  protected handleClientDisconnect(key: string | number, reason: string): void {
    const record = this.managedClients.get(key);
    if (!record) {
      return;
    }

    console.log(`${reason}. Forcing disconnect of client "${record.clientId}".`);
    record.selfDisconnectListenerDisposable.dispose();
    record.disconnect();
    record.deleteClient();
    this.managedClients.delete(key);
  }

  /**
   * Clean up a specific client by its identifier
   */
  protected cleanupClient(key: string | number): void {
    const record = this.managedClients.get(key);
    if (record) {
      record.selfDisconnectListenerDisposable.dispose();
      record.disconnect();
      record.deleteClient();
      this.managedClients.delete(key);
    }
  }

  /**
   * Get count of managed clients
   */
  public getManagedClientCount(): number {
    return this.managedClients.size;
  }

  /**
   * Get all managed client IDs
   */
  public getManagedClientIds(): string[] {
    return Array.from(this.managedClients.values()).map(record => record.clientId);
  }

  /**
   * Dispose all resources and clean up all clients
   */
  public override dispose(): void {
    super.dispose();

    // Clean up all managed clients
    this.managedClients.forEach((record, key) => {
      record.selfDisconnectListenerDisposable.dispose();
      record.disconnect();
      record.deleteClient();
      console.log(`Cleanup leftover client "${record.clientId}" with key ${key}.`);
    });

    this.managedClients.clear();
    console.log('ClientLifecycleManager disposed.');
  }
}
