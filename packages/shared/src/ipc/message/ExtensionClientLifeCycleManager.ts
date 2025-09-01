import { IDisposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { ClientConnectEvent } from './MessageServer';
import { ClientLifeCycleManager } from './ClientLifeCycleManager';

/**
 * Tab change information interface
 */
export interface ITabChangeInfo {
  status?: 'loading' | 'complete';
  url?: string;
  [key: string]: unknown;
}

/**
 * Tab information interface
 */
export interface ITabInfo {
  id: number;
  url?: string;
  active?: boolean;
  [key: string]: unknown;
}

/**
 * Tab update event interface
 */
export interface ITabUpdateEvent {
  tabId: number;
  changeInfo: ITabChangeInfo;
  tab: ITabInfo;
}

/**
 * Browser tab monitor interface for tracking tab lifecycle events
 */
export interface IBrowserTabMonitor {
  onTabRemoved: (listener: (tabId: number) => void) => IDisposable;
  onTabUpdated: (listener: (event: ITabUpdateEvent) => void) => IDisposable;
}

/**
 * Extension environment client lifecycle manager
 * Manages client connections based on browser tab lifecycle
 */
export class ExtensionClientLifecycleManager extends ClientLifeCycleManager {
  private readonly browserTabMonitor: IBrowserTabMonitor;
  private readonly onClientConnectEvent: Event<ClientConnectEvent>;

  constructor(
    browserTabMonitor: IBrowserTabMonitor,
    onClientConnectEvent: Event<ClientConnectEvent>,
  ) {
    super();
    this.browserTabMonitor = browserTabMonitor;
    this.onClientConnectEvent = onClientConnectEvent;
  }

  /**
   * Attach event handlers for client lifecycle management.
   * This method is called explicitly by whoever constructs the manager.
   * It will hook up exactly three subscriptions:
   *  1. onClientConnectEvent  → _handleClientConnect
   *  2. browserTabMonitor.onTabRemoved  → _handleTabRemoved
   *  3. browserTabMonitor.onTabUpdated  → _handleTabUpdated
   */
  public attachEventHandlers(): void {
    // 1) Subscribe to "client connect" events from MessageServer:
    this.add(this.onClientConnectEvent(this._handleClientConnect.bind(this)));

    // 2) Subscribe to "tab removed":
    this.add(this.browserTabMonitor.onTabRemoved(this._handleTabRemoved.bind(this)));

    // 3) Subscribe to "tab updated":
    this.add(this.browserTabMonitor.onTabUpdated(this._handleTabUpdated.bind(this)));
  }

  /**
   * Handle client connection events in extension environment
   */
  private _handleClientConnect(event: ClientConnectEvent): void {
    // IPC Step 7: Handle client connection
    const tabId = event.sender.tab?.id;
    if (tabId == null) {
      console.warn(`No tabId for client "${event.id}", skipping lifecycle tracking.`);
      return;
    }

    // Set up self-disconnect listener
    const selfDisconnectListener = event.onDidClientDisconnect(() => {
      console.log(`Client "${event.id}" disconnected itself (tab ${tabId}).`);
      // Only remove if it's still the same id in our map
      const record = this.managedClients.get(tabId);
      if (record?.clientId === event.id) {
        this.managedClients.delete(tabId);
      }
    });

    // Use base class method to handle the connection
    this.handleClientConnect(
      event.id,
      tabId,
      event.disconnect,
      event.deleteClient,
      selfDisconnectListener,
    );
  }

  /**
   * Handle tab removal events
   */
  private _handleTabRemoved(tabId: number): void {
    this.handleClientDisconnect(tabId, `Tab ${tabId} closed`);
  }

  /**
   * Handle tab update events
   */
  private _handleTabUpdated(event: ITabUpdateEvent): void {
    const record = this.managedClients.get(event.tabId);
    if (!record) {
      return;
    }

    if (event.changeInfo.status === 'loading') {
      console.log(
        `Tab ${event.tabId} is reloading/navigating. Client "${record.clientId}" is still registered. ` +
          `Awaiting either content script's own disconnect or a new onDidClientConnect.`,
      );
      // Don't force disconnect here - let the content script reconnect naturally
      // Only remove the client if we get a proper disconnect event or tab removal
    }
  }

  /**
   * Get managed clients by tab ID
   */
  public getManagedClientsByTabId(): Map<number, string> {
    const result = new Map<number, string>();
    this.managedClients.forEach((record, key) => {
      if (typeof key === 'number') {
        result.set(key, record.clientId);
      }
    });
    return result;
  }

  /**
   * Dispose all resources and clean up all clients
   */
  public override dispose(): void {
    super.dispose();
    console.log('ExtensionClientLifecycleManager disposed.');
  }
}
