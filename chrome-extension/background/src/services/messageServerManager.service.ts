import {
  createDecorator,
  IInstantiationService,
} from 'vs/platform/instantiation/common/instantiation';
import { Disposable, DisposableStore, toDisposable } from 'vs/base/common/lifecycle';
import { MessageServer } from '@shared/ipc/message/MessageServer';
import { createDocumentId, parseDocumentId } from '@shared/utils/utils';
import { IIPCReconnectMessage, CRX_DEEP_RESEARCH_RECONNECT } from '@shared/utils/message';
import { checkSidePanelStatus } from '../utils/utils';
import { LocalAsyncStorageService } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';

export const IMessageServerManagerService = createDecorator<IMessageServerManagerService>(
  'messageServerManagerService',
);

export interface IMessageServerManagerService {
  _serviceBrand: undefined;
}

type Connection = {
  id: string; // Here the id is receive ... needs to be switched in response
  source: string; // The source is the sender ... needs to be the target id in response
  key: string;
};

type ConnectionsSchema = {
  connections: Connection[];
};

export class MessageServerManagerService
  extends Disposable
  implements IMessageServerManagerService
{
  readonly _serviceBrand: undefined;

  private readonly _localAsyncStorage: LocalAsyncStorageService<ConnectionsSchema>;

  constructor(
    @IInstantiationService
    private readonly instantiationService: IInstantiationService,
  ) {
    super();

    this._localAsyncStorage = this.instantiationService.createInstance(
      LocalAsyncStorageService<ConnectionsSchema>,
    );

    this._registerListeners();
  }

  public async start() {
    await this._pruneConnections();
    this._sendReconnectMessage();
  }

  // TypeScript
  private async _sendReconnectMessage() {
    const connections = await this._localAsyncStorage.get('connections', []);
    for (const connection of connections) {
      const sourceDetails = parseDocumentId(connection.key);
      if (!sourceDetails) {
        continue;
      }
      const { id: source, source: target } = connection;
      const { tabId, frameId } = sourceDetails;

      const payload: IIPCReconnectMessage = {
        type: CRX_DEEP_RESEARCH_RECONNECT,
        source,
        target,
      };

      if (tabId !== undefined) {
        const options: chrome.tabs.MessageSendOptions = {
          frameId,
        };
        try {
          await chrome.tabs.sendMessage(tabId, payload, options);
        } catch (error) {
          await chrome.tabs.reload(tabId);
          console.log(error);
        }
      } else {
        await chrome.runtime.sendMessage(payload).catch(error => {
          console.log(error);
        });
      }
    }
  }

  private async _pruneConnections() {
    try {
      const connections = await this._localAsyncStorage.get('connections', []);

      for (const connection of connections) {
        const sourceDetails = parseDocumentId(connection.key);
        if (!sourceDetails) {
          await this._removeConnection(connection.key);
          continue;
        }

        const { documentId, tabId, windowId } = sourceDetails;
        let documentExists = false;

        if (tabId !== undefined) {
          const frames = await new Promise<chrome.webNavigation.GetAllFrameResultDetails[]>(
            resolve => {
              chrome.webNavigation.getAllFrames({ tabId }, frameDetails => {
                if (chrome.runtime.lastError || !frameDetails) {
                  resolve([]);
                } else {
                  resolve(frameDetails);
                }
              });
            },
          );

          documentExists = frames.some(frame => frame.documentId === documentId);
        }
        if (documentId === 'side-panel' && windowId !== undefined) {
          try {
            documentExists = await checkSidePanelStatus(windowId);
          } catch (error) {
            console.log('Error checking side panel existence:', error);
            documentExists = false;
          }
        }

        if (!documentExists) {
          await this._removeConnection(connection.key);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  private async _removeConnection(key: string) {
    const connections = await this._localAsyncStorage.get('connections', []);
    const updatedConnections = connections.filter(connection => connection.key !== key);
    await this._localAsyncStorage.set('connections', updatedConnections);
  }

  _registerListeners() {
    MessageServer.onDidClientConnect(async event => {
      const { id, source, sender, disconnect, deleteClient, onDidClientDisconnect } = event;
      const connections = await this._localAsyncStorage.get('connections', []);

      const sourceObject = parseDocumentId(source);
      const key =
        'documentId:' +
        createDocumentId(
          sourceObject!.documentId,
          sourceObject?.windowId ?? sender.tab?.windowId,
          sourceObject?.tabId ?? sender.tab?.id,
          sourceObject?.frameId ?? sender.frameId,
        );

      const newConnection: Connection = { id, source, key };

      const existingIndex = connections.findIndex(
        connection => connection.key === newConnection.key,
      );

      if (existingIndex !== -1) {
        connections[existingIndex] = newConnection;
      } else {
        connections.push(newConnection);
      }

      await this._localAsyncStorage.set('connections', connections);

      // Create a DisposableStore for this connection
      const connectionDisposables = new DisposableStore();

      // Handle client disconnect
      connectionDisposables.add(
        onDidClientDisconnect(async () => {
          connectionDisposables.dispose();
          deleteClient();
          await this._removeConnection(key);
        }),
      );

      // Listen for web navigation events
      const webNavigationListener = async (
        details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
      ) => {
        if (
          sender.tab &&
          sender.tab.id === details.tabId &&
          sender.frameId === details.frameId &&
          details.frameId === 0
        ) {
          connectionDisposables.dispose();
          disconnect();
          deleteClient();
          await this._removeConnection(key);
        }
      };
      chrome.webNavigation.onCommitted.addListener(webNavigationListener);
      connectionDisposables.add(
        toDisposable(() => {
          chrome.webNavigation.onCommitted.removeListener(webNavigationListener);
        }),
      );

      // Listen for tab removal
      const onRemovedListener = async (tabId: number) => {
        if (sender?.tab && sender.tab.id === tabId) {
          connectionDisposables.dispose();
          disconnect();
          deleteClient();
          await this._removeConnection(key);
        }
      };
      chrome.tabs.onRemoved.addListener(onRemovedListener);
      connectionDisposables.add(
        toDisposable(() => {
          chrome.tabs.onRemoved.removeListener(onRemovedListener);
        }),
      );
    });
  }
}
