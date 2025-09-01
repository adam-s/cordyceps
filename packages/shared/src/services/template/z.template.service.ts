import { Disposable } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from '@shared/services/log.service';

export interface IServerService {
  _serviceBrand: undefined;
  start: () => Promise<void>;
}

export const IServerService =
  createDecorator<IServerService>('shutdownService');

export class RemoteServerService extends Disposable implements IServerService {
  declare readonly _serviceBrand: undefined;

  constructor(@ILogService private readonly logService: ILogService) {
    super();
    this._registerListeners();
  }

  _registerListeners() {}

  async start() {}
}
