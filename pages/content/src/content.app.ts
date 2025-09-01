// filepath: /Users/adamsohn/Projects/robbin-da-hood-2/pages/content/src/content.app.ts
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { getSingletonServiceDescriptors } from 'vs/platform/instantiation/common/extensions';
import { MessageClient } from '@shared/ipc/message/MessageClient';
import { createDocumentId, requestInformation, requestWindowId } from '@shared/utils/utils';
import { ProxyChannel, StaticRouter } from 'vs/base/parts/ipc/common/ipc';
import { Server } from '@shared/ipc/server';
import { IMathService } from '@shared/services/math.service';
import { createPortEvent } from '@shared/ipc/createPortEvent';

export interface IContentConfiguration {}

export class ContentApp extends Disposable {
  private _documentId!: string;

  private _windowId!: number;

  constructor(private readonly configuration: IContentConfiguration) {
    super();
  }

  get documentId(): string {
    return this._documentId;
  }

  get windowId(): number {
    return this._windowId;
  }

  // Because constructors can't be async, we need to call this method after creating the instance.
  async start(): Promise<void> {
    this._windowId = await requestWindowId();

    const tabInfo = await requestInformation();
    this._documentId = createDocumentId(
      tabInfo.documentId!,
      tabInfo.windowId,
      tabInfo.tabId,
      tabInfo.frameId,
    );

    // Register listeners first
    await this.registerListeners();

    const instantiationService = await this.initServices();

    // Initialize side panel services for text context
    const disposables = this._register(new DisposableStore());
    await this.initSidePanelServices(instantiationService, disposables);
  }

  async registerListeners(): Promise<void> {
    // Add beforeunload event listener for proper cleanup
    window.addEventListener('beforeunload', () => {
      this.dispose();
    });
  }

  async initServices(): Promise<InstantiationService> {
    const serviceCollection = new ServiceCollection();
    // Instantiate the services
    const instantiationService = new InstantiationService(serviceCollection, true);

    // All Contributed Services
    const contributedServices = getSingletonServiceDescriptors();
    for (const [id, descriptor] of contributedServices) {
      serviceCollection.set(id, descriptor);
    }

    return instantiationService;
  }

  async initSidePanelServices(
    instantiationService: InstantiationService,
    disposables: DisposableStore,
  ): Promise<InstantiationService> {
    const serviceCollection = new ServiceCollection();
    const sidePanelInstantiationService = disposables.add(
      instantiationService.createChild(serviceCollection),
    );

    // Create client for side panel
    const sidePanelMessageClient = disposables.add(
      new MessageClient(
        `documentId:${this.documentId}`,
        `documentId:side-panel:content:${this._windowId}`,
      ),
    );

    // Create client for main content
    const onCreateMessageChannel = createPortEvent('MAIN');

    const MAINServer = this._register(new Server(onCreateMessageChannel));
    const mainContentRouter = new StaticRouter(() => true);
    const mathService = ProxyChannel.toService<IMathService>(
      MAINServer.getChannel('mathService', mainContentRouter),
    );
    // Get mathService from MAINServer and pass it to client for side panel
    sidePanelMessageClient.registerChannel(
      'mathService',
      ProxyChannel.fromService(mathService, disposables),
    );

    return sidePanelInstantiationService as InstantiationService;
  }
}
