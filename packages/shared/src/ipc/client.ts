import { IDisposable } from 'vs/base/common/lifecycle';
import { IPCClient } from 'vs/base/parts/ipc/common/ipc';
import { Protocol } from '@shared/ipc/protocol';

export class Client extends IPCClient implements IDisposable {
  private protocol: Protocol;

  constructor(protocol: Protocol, id: string) {
    super(protocol, id);
    this.protocol = protocol;
  }

  override dispose(): void {
    this.protocol.disconnect();
    super.dispose();
  }
}
