import { Disposable } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from '@shared/services/log.service';
import { Emitter, Event } from 'vs/base/common/event';

export interface IInMemoryStorage<S = Record<string, unknown>> {
  _serviceBrand: undefined;
  start: () => Promise<void>;

  set<K extends keyof S, V>(key: K, value: V): asserts this is IInMemoryStorage<S & Record<K, V>>;
  get<K extends keyof S>(key: K): S[K];
  delete<K extends keyof S>(key: K): asserts this is IInMemoryStorage<Omit<S, K>>;
  has<K extends keyof S>(key: K): key is K;

  readonly onUpdateValue: Event<{ key: keyof S; value: S[keyof S] }>;
}

export const IInMemoryStorage = createDecorator<IInMemoryStorage>('inMemoryStorage');
/**
 * Implementation of a dynamically typed in-memory key/value storage service.
 */
export class InMemoryStorageService<S = Record<string, unknown>>
  extends Disposable
  implements IInMemoryStorage<S>
{
  declare readonly _serviceBrand: undefined;

  private readonly storage: Record<string, unknown> = {};

  private readonly _onUpdateValue = this._register(
    new Emitter<{ key: keyof S; value: S[keyof S] }>(),
  );
  public readonly onUpdateValue: Event<{ key: keyof S; value: S[keyof S] }> =
    this._onUpdateValue.event;

  constructor(@ILogService private readonly logService: ILogService) {
    super();
    this._registerListeners();
  }

  private _registerListeners(): void {
    // Register any necessary listeners here.
  }

  async start(): Promise<void> {
    this.logService.info('InMemoryStorageService started.');
  }

  set<K extends keyof S, V>(
    key: K,
    value: V,
  ): asserts this is InMemoryStorageService<S & Record<K, V>> {
    this.storage[key as string] = value;
    this.logService.debug(`Value set for key: ${String(key)}`);
    this._onUpdateValue.fire({ key: key as keyof S & K, value: value as S[keyof S & K] });
  }

  get<K extends keyof S>(key: K): S[K] {
    return this.storage[key as string] as S[K];
  }

  delete<K extends keyof S>(key: K): asserts this is InMemoryStorageService<Omit<S, K>> {
    if (key in this.storage) {
      delete this.storage[key as string];
      this.logService.debug(`Key deleted: ${String(key)}`);
      this._onUpdateValue.fire({ key, value: undefined as unknown as S[K] });
    }
  }

  has<K extends keyof S>(key: K): key is K {
    return key in this.storage;
  }
}
