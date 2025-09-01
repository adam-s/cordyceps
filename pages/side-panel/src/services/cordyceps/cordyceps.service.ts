import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { BrowserWindow } from './browserWindow';

export const ICordycepsService = createDecorator<ICordycepsService>('cordycepsService');

export interface ICordycepsService {
  readonly _serviceBrand: undefined;
  readonly getBrowser: () => Promise<BrowserWindow>;
}

export class CordycepsService implements ICordycepsService {
  public readonly _serviceBrand: undefined;
  private _browser: Promise<BrowserWindow>;

  constructor() {
    this._browser = BrowserWindow.create();
  }

  public getBrowser(): Promise<BrowserWindow> {
    return this._browser;
  }
}
