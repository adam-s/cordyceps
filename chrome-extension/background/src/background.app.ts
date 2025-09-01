import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { getSingletonServiceDescriptors } from 'vs/platform/instantiation/common/extensions';
import { IMathService, MathService } from '@src/services/math.service';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { ProxyChannel } from 'vs/base/parts/ipc/common/ipc';
import { getDocumentId, getInformation, getWindowId, sendErrorResponse } from '@src/utils/utils';
import {
  DocumentMessage,
  DocumentResponse,
  CRX_DEEP_RESEARCH_DISCONNECT,
  CRX_DEEP_RESEARCH_HELLO,
  CRX_DEEP_RESEARCH_MESSAGE,
  CRX_DEEP_RESEARCH_SIDE_PANEL_VISIBILITY_CHANGE,
  CRX_DEEP_RESEARCH_SIDE_PANEL_RELOAD,
  CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED,
  CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE,
  CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_EVENT,
  CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_COMMAND,
  CRX_DEEP_RESEARCH_NAVIGATION_EVENT,
} from '@shared/utils/message';
import { MessageServer } from '@shared/ipc/message/MessageServer';
import { MessageServerManagerService } from './services/messageServerManager.service';

export class BackgroundApp extends Disposable {
  constructor() {
    super();
  }

  async start() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const instantiationService = await this.initServices();
    this.registerListeners();
  }

  async initServices(): Promise<InstantiationService> {
    // Initialize containers
    const serviceCollection = new ServiceCollection();
    const disposables = this._register(new DisposableStore());
    const instantiationService = new InstantiationService(serviceCollection, true);

    // Add all services registered in own file with
    const contributedServices = getSingletonServiceDescriptors();

    for (const [id, descriptor] of contributedServices) {
      serviceCollection.set(id, descriptor);
    }

    // Message Server
    const messageServer = new MessageServer(`documentId:service-worker`);
    instantiationService.createInstance(MessageServerManagerService).start();

    const mathService = instantiationService.createInstance(MathService);
    serviceCollection.set(IMathService, mathService);

    // Provide access to accessor for services that need configuration to instantiate
    const mathServiceChannel = ProxyChannel.fromService(mathService, disposables);
    messageServer.registerChannel('mathService', mathServiceChannel);

    return instantiationService;
  }

  registerListeners() {
    chrome.runtime.onMessage.addListener(
      (
        message: DocumentMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: DocumentResponse) => void,
      ) => {
        if (!message?.type) {
          console.error('[BackgroundApp.onMessage] Invalid message format', { message, sender });
          sendErrorResponse('Invalid message format', sendResponse);
          return false;
        }
        switch (message.type) {
          case 'crx-deep-research:requestDocumentId':
            getDocumentId(sender)
              .then(documentId => {
                sendResponse({ documentId });
              })
              .catch(error => sendErrorResponse(error, sendResponse));
            return true;

          case 'crx-deep-research:requestWindowId':
            getWindowId(sender)
              .then(windowId => {
                sendResponse({ windowId });
              })
              .catch(error => sendErrorResponse(error, sendResponse));
            return true;

          case 'crx-deep-research:requestInformation':
            getInformation(sender)
              .then(info => {
                sendResponse(info);
              })
              .catch(error => sendErrorResponse(error, sendResponse));
            return true;

          case 'crx-deep-research:console.log':
            console.log('console.log ', message, sender);
            return false;

          case CRX_DEEP_RESEARCH_HELLO:
          case CRX_DEEP_RESEARCH_MESSAGE:
          case CRX_DEEP_RESEARCH_DISCONNECT:
          case CRX_DEEP_RESEARCH_SIDE_PANEL_VISIBILITY_CHANGE:
          case CRX_DEEP_RESEARCH_SIDE_PANEL_RELOAD:
          case CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED:
            return false;

          case CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE:
            // Port creation is handled by content script, just acknowledge
            return false;

          case CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_EVENT:
            // Events are sent from content to side panel, just pass through
            return false;

          case CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_COMMAND:
            // Commands are sent from side panel to content script
            // Background script just acknowledges, the content script handles the command directly
            return false;

          case CRX_DEEP_RESEARCH_NAVIGATION_EVENT:
            // Navigation events are sent from content script to side panel via background
            // Background script just passes these through, they are handled by NavigationTracker in side panel
            return false;

          default:
            console.error('[BackgroundApp.onMessage] Unknown message type', {
              type: message.type,
              message,
              sender,
            });
            sendErrorResponse(
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              `Unknown message type: ${message.type}`,
              sendResponse,
            );
            return false;
        }
      },
    );
  }
}
