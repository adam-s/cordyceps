// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ILogService } from '@shared/services/log.service';
import { LocalAsyncStorageService } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';

describe('LocalAsyncStorageService', () => {
  let logServiceMock: ILogService;
  let storageService: LocalAsyncStorageService<Record<string, unknown>>;
  let mockStorage: Record<string, unknown>;
  let onChangedCallback: (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => void;

  beforeEach(() => {
    // Mock the log service
    logServiceMock = {
      log: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as unknown as ILogService;

    // Initialize the mock storage
    mockStorage = {};

    // Mock chrome.storage API
    window.chrome = {
      storage: {
        local: {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          //@ts-ignore
          get: vi.fn(
            (keys: string | string[], callback: (result: Record<string, unknown>) => void) => {
              const result: Record<string, unknown> = {};
              const keyArray = Array.isArray(keys) ? keys : [keys];
              keyArray.forEach(key => {
                if (Object.hasOwn(mockStorage, key)) {
                  result[key] = mockStorage[key];
                }
              });
              callback(result);
            },
          ),
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          //@ts-ignore
          set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
            const changes: { [key: string]: chrome.storage.StorageChange } = {};
            for (const key in items) {
              const oldValue = mockStorage[key];
              mockStorage[key] = items[key];
              changes[key] = {
                oldValue,
                newValue: items[key],
              };
            }
            callback && callback();

            // Simulate onChanged event
            onChangedCallback && onChangedCallback(changes, 'local');
          }),
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          //@ts-ignore
          remove: vi.fn((keys: string | string[], callback?: () => void) => {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            const changes: { [key: string]: chrome.storage.StorageChange } = {};
            keyArray.forEach(key => {
              if (key in mockStorage) {
                const oldValue = mockStorage[key];
                delete mockStorage[key];
                changes[key] = {
                  oldValue,
                  newValue: undefined,
                };
              }
            });
            callback && callback();

            // Simulate onChanged event
            if (Object.keys(changes).length > 0) {
              onChangedCallback && onChangedCallback(changes, 'local');
            }
          }),
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          //@ts-ignore
          clear: vi.fn((callback?: () => void) => {
            mockStorage = {};
            callback && callback();
          }),
        },
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        onChanged: {
          addListener: vi.fn(callback => {
            onChangedCallback = callback;
          }),
        },
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      runtime: {
        lastError: undefined,
      },
    };

    // Initialize the storage service
    storageService = new LocalAsyncStorageService(logServiceMock);
  });

  afterEach(() => {
    // Clear mock storage and reset mocks
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('should start the service and log the start message', async () => {
    await storageService.start();
    expect(logServiceMock.info).toHaveBeenCalledWith('LocalAsyncStorageService started.');
  });

  it('should set and get a value correctly', async () => {
    await storageService.set('foo', 'testValue');
    const value = await storageService.get('foo');
    expect(value).toBe('testValue');
  });

  it('should return undefined for non-existent keys', async () => {
    const value = await storageService.get('nonExistentKey');
    expect(value).toBeUndefined();
  });

  it('should delete a key and ensure it no longer exists', async () => {
    await storageService.set('bar', 42);
    await storageService.delete('bar');
    const value = await storageService.get('bar');
    expect(value).toBeUndefined();
    const hasKey = await storageService.has('bar');
    expect(hasKey).toBe(false);
  });

  it('should check if a key exists correctly', async () => {
    let hasKey = await storageService.has('baz');
    expect(hasKey).toBe(false);
    await storageService.set('baz', true);
    hasKey = await storageService.has('baz');
    expect(hasKey).toBe(true);
  });

  it('should fire onUpdateValue event when a value is set', async () => {
    const listener = vi.fn();
    storageService.onUpdateValue(listener);
    await storageService.set('foo', 'newValue');
    // Wait for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(listener).toHaveBeenCalledWith({
      key: 'foo',
      newValue: 'newValue',
      oldValue: undefined,
    });
  });

  it('should fire onUpdateValue event when a value is deleted', async () => {
    const listener = vi.fn();
    await storageService.set('foo', 'value');
    storageService.onUpdateValue(listener);
    await storageService.delete('foo');
    // Wait for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(listener).toHaveBeenCalledWith({
      key: 'foo',
      newValue: undefined,
      oldValue: 'value',
    });
  });

  it('should handle multiple types correctly', async () => {
    await storageService.set('foo', 'stringValue');
    await storageService.set('bar', 123);
    await storageService.set('baz', false);

    expect(await storageService.get('foo')).toBe('stringValue');
    expect(await storageService.get('bar')).toBe(123);
    expect(await storageService.get('baz')).toBe(false);
  });

  it('should overwrite existing values', async () => {
    await storageService.set('foo', 'initialValue');
    await storageService.set('foo', 'updatedValue');
    expect(await storageService.get('foo')).toBe('updatedValue');
  });

  it('should log debug messages when setting a value', async () => {
    await storageService.set('foo', 'value');
    expect(logServiceMock.debug).toHaveBeenCalledWith('Value set for key: foo');
  });

  it('should log debug messages when deleting a key', async () => {
    await storageService.set('foo', 'value');
    await storageService.delete('foo');
    expect(logServiceMock.debug).toHaveBeenCalledWith('Key deleted: foo');
  });
});
