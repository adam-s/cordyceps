import { Disposable } from 'vs/base/common/lifecycle';
import { createDecorator, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from '@shared/services/log.service';
import { Emitter, Event } from 'vs/base/common/event';

export interface AsyncStorageSchema {
  [key: string]: unknown;
}

type OnUpdateValue<S> = {
  key: keyof S;
  newValue: S[keyof S] | undefined;
  oldValue: S[keyof S] | undefined;
};

export interface ILocalAsyncStorage<S> {
  _serviceBrand: undefined;
  start: () => Promise<void>;

  set<K extends keyof S>(key: K, value: S[K]): Promise<void>;
  get<K extends keyof S>(key: K): Promise<S[K] | undefined>;
  delete<K extends keyof S>(key: K): Promise<void>;
  has<K extends keyof S>(key: K): Promise<boolean>;

  readonly onUpdateValue: Event<OnUpdateValue<S>>;
}

export const ILocalAsyncStorage: ServiceIdentifier<ILocalAsyncStorage<AsyncStorageSchema>> =
  createDecorator<ILocalAsyncStorage<AsyncStorageSchema>>('localAsyncStorage');

export class LocalAsyncStorageService<S extends AsyncStorageSchema>
  extends Disposable
  implements ILocalAsyncStorage<S>
{
  declare readonly _serviceBrand: undefined;

  private readonly _onUpdateValue = this._register(new Emitter<OnUpdateValue<S>>());
  public readonly onUpdateValue: Event<OnUpdateValue<S>> = this._onUpdateValue.event;

  constructor(@ILogService private readonly logService: ILogService) {
    super();
    this._registerListeners();
  }

  private _registerListeners(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        for (const [key, change] of Object.entries(changes)) {
          if (change.newValue !== change.oldValue)
            this._onUpdateValue.fire({
              key: key as keyof S,
              newValue: change.newValue as S[keyof S],
              oldValue: change.oldValue as S[keyof S],
            });
        }
      }
    });
  }

  async start(): Promise<void> {
    this.logService.info('LocalAsyncStorageService started.');
  }

  async set<K extends keyof S>(key: K, value: S[K]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        chrome.storage.local.set({ [String(key)]: value }, () => {
          if (chrome.runtime.lastError) {
            this.logService.error(
              `Error setting key ${String(key)}: ${chrome.runtime.lastError.message}`
            );
            reject(chrome.runtime.lastError);
          } else {
            this.logService.debug(`Value set for key: ${String(key)}`);
            resolve();
          }
        });
      } catch (error) {
        this.logService.error(`Error setting key ${String(key)}: ${error}`);
        reject(error);
      }
    });
  }

  async get<K extends keyof S>(key: K): Promise<S[K] | undefined>;
  async get<K extends keyof S>(key: K, defaultValue: S[K]): Promise<S[K]>;
  async get<K extends keyof S>(key: K, defaultValue?: S[K]): Promise<S[K] | undefined> {
    return new Promise<S[K] | undefined>((resolve, reject) => {
      try {
        chrome.storage.local.get(String(key), result => {
          if (chrome.runtime.lastError) {
            this.logService.error(
              `Error getting key ${String(key)}: ${chrome.runtime.lastError.message}`
            );
            reject(chrome.runtime.lastError);
          } else {
            if (Object.hasOwn(result, String(key))) {
              const value = result[String(key)] as S[K];
              resolve(value);
            } else {
              if (defaultValue !== undefined) {
                resolve(defaultValue);
              } else {
                resolve(undefined);
              }
            }
          }
        });
      } catch (error) {
        this.logService.error(`Error getting key ${String(key)}: ${error}`);
        reject(error);
      }
    });
  }

  async delete<K extends keyof S>(key: K): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        chrome.storage.local.remove(String(key), () => {
          if (chrome.runtime.lastError) {
            this.logService.error(
              `Error deleting key ${String(key)}: ${chrome.runtime.lastError.message}`
            );
            reject(chrome.runtime.lastError);
          } else {
            this.logService.debug(`Key deleted: ${String(key)}`);
            resolve();
          }
        });
      } catch (error) {
        this.logService.error(`Error deleting key ${String(key)}: ${error}`);
        reject(error);
      }
    });
  }

  async has<K extends keyof S>(key: K): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        chrome.storage.local.get(String(key), result => {
          if (chrome.runtime.lastError) {
            this.logService.error(
              `Error checking key ${String(key)}: ${chrome.runtime.lastError.message}`
            );
            reject(chrome.runtime.lastError);
          } else {
            resolve(Object.hasOwn(result, String(key)));
          }
        });
      } catch (error) {
        this.logService.error(`Error checking key ${String(key)}: ${error}`);
        reject(error);
      }
    });
  }
}
