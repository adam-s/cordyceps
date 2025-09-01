import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { getSingletonServiceDescriptors } from 'vs/platform/instantiation/common/extensions';
import { IPCClientService } from '@shared/ipc/ipc-client.service';
import { createMainWorldPort } from '../../../packages/shared/src/ipc/createMainWorldPort';
import { IMainProcessService } from '@shared/ipc/client.service';
import { generateUuid } from 'vs/base/common/uuid';
import { MathService } from '@shared/services/math.service';
import { ProxyChannel } from 'vs/base/parts/ipc/common/ipc';
import { InterceptorService, IInterceptorService } from './services/interceptor.service';

const urls: string[] = [];
// import { ILogService } from '@shared/services/log.service';

export interface IContentMainConfiguration {}

export class ContentMainApp extends Disposable {
  private _documentId = generateUuid();

  constructor(private readonly configuration: IContentMainConfiguration) {
    super();
  }

  get documentId() {
    return this._documentId;
  }

  // Because constructors can't be async, we need to call this method after creating the instance.
  async start() {
    // Register listeners first
    await this.registerListeners();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const instantiationService = await this.initServices();
  }

  async registerListeners() {}

  async initServices() {
    const serviceCollection = new ServiceCollection();
    // Instantiate the services
    const instantiationService = new InstantiationService(serviceCollection, true);

    // All Contributed Services
    const contributedServices = getSingletonServiceDescriptors();
    for (const [id, descriptor] of contributedServices) {
      serviceCollection.set(id, descriptor);
    }
    const ipcClientService = this._register(
      new IPCClientService(this.documentId, await createMainWorldPort(this.documentId, 'MAIN')),
    );
    serviceCollection.set(IMainProcessService, ipcClientService);

    const interceptorService = this._register(new InterceptorService(urls));
    serviceCollection.set(IInterceptorService, interceptorService);

    const disposables = this._register(new DisposableStore());

    const mathService = instantiationService.createInstance(MathService);
    const mathServicechannel = ProxyChannel.fromService(mathService, disposables);
    ipcClientService.registerChannel('mathService', mathServicechannel);

    return instantiationService;
  }
}
