/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChannel, IPCServer, IServerChannel, StaticRouter } from 'vs/base/parts/ipc/common/ipc';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IRemoteService } from 'vs/platform/ipc/common/services';

export interface IClientService extends IRemoteService {
  readonly _serviceBrand: undefined;
}

export const IMainProcessService = createDecorator<IClientService>('mainProcessService');

/**
 * An implementation of `IMainProcessService` that leverages `IPCServer`.
 */
export class ClientService implements IClientService {
  declare readonly _serviceBrand: undefined;

  constructor(
    private server: IPCServer,
    private router: StaticRouter,
  ) {}

  getChannel(channelName: string): IChannel {
    return this.server.getChannel(channelName, this.router);
  }

  registerChannel(channelName: string, channel: IServerChannel<string>): void {
    this.server.registerChannel(channelName, channel);
  }
}
