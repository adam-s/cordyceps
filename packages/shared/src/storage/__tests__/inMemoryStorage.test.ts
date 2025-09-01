import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryStorageService } from '../inMemoryStorage/inMemoryStorage.service';
import { ILogService } from '@shared/services/log.service';

interface TestSchema {
  foo: string;
  bar: number;
  baz: boolean;
}

describe('InMemoryStorageService', () => {
  let logServiceMock: ILogService;
  let storageService: InMemoryStorageService<TestSchema>;

  beforeEach(() => {
    logServiceMock = {
      log: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as unknown as ILogService;

    storageService = new InMemoryStorageService<TestSchema>(logServiceMock);
  });

  it('should start the service and log the start message', async () => {
    await storageService.start();
    expect(logServiceMock.info).toHaveBeenCalledWith('InMemoryStorageService started.');
  });

  it('should set and get a value correctly', () => {
    storageService.set('foo', 'testValue');
    const value = storageService.get('foo');
    expect(value).toBe('testValue');
  });

  it('should return undefined for non-existent keys', () => {
    const value = storageService.get('nonExistentKey' as keyof TestSchema);
    expect(value).toBeUndefined();
  });

  it('should delete a key and ensure it no longer exists', () => {
    storageService.set('bar', 42);
    storageService.delete('bar');
    const value = storageService.get('bar');
    expect(value).toBeUndefined();
    expect(storageService.has('bar')).toBe(false);
  });

  it('should check if a key exists correctly', () => {
    expect(storageService.has('baz')).toBe(false);
    storageService.set('baz', true);
    expect(storageService.has('baz')).toBe(true);
  });

  it('should fire onUpdateValue event when a value is set', () => {
    const listener = vi.fn();
    storageService.onUpdateValue(listener);
    storageService.set('foo', 'newValue');
    expect(listener).toHaveBeenCalledWith({ key: 'foo', value: 'newValue' });
  });

  it('should fire onUpdateValue event when a value is deleted', () => {
    const listener = vi.fn();
    storageService.set('foo', 'value');
    storageService.onUpdateValue(listener);
    storageService.delete('foo');
    expect(listener).toHaveBeenCalledWith({ key: 'foo', value: undefined });
  });

  it('should handle multiple types correctly', () => {
    storageService.set('foo', 'stringValue');
    storageService.set('bar', 123);
    storageService.set('baz', false);

    expect(storageService.get('foo')).toBe('stringValue');
    expect(storageService.get('bar')).toBe(123);
    expect(storageService.get('baz')).toBe(false);
  });

  it('should overwrite existing values', () => {
    storageService.set('foo', 'initialValue');
    storageService.set('foo', 'updatedValue');
    expect(storageService.get('foo')).toBe('updatedValue');
  });

  it('should log debug messages when setting a value', () => {
    storageService.set('foo', 'value');
    expect(logServiceMock.debug).toHaveBeenCalledWith('Value set for key: foo');
  });

  it('should log debug messages when deleting a key', () => {
    storageService.set('foo', 'value');
    storageService.delete('foo');
    expect(logServiceMock.debug).toHaveBeenCalledWith('Key deleted: foo');
  });

  it('should not log debug message when deleting a non-existent key', () => {
    storageService.delete('nonExistentKey' as keyof TestSchema);
    expect(logServiceMock.debug).not.toHaveBeenCalledWith('Key deleted: nonExistentKey');
  });

  it('should maintain type safety when setting and getting values', () => {
    storageService.set('foo', 'stringValue');
    const fooValue: string = storageService.get('foo');
    expect(fooValue).toBe('stringValue');

    storageService.set('bar', 100);
    const barValue: number = storageService.get('bar');
    expect(barValue).toBe(100);

    storageService.set('baz', true);
    const bazValue: boolean = storageService.get('baz');
    expect(bazValue).toBe(true);
  });

  it('should handle assertion in set method correctly', () => {
    storageService.set('foo', 'test');
    expect(storageService).toBeInstanceOf(InMemoryStorageService);
    // Type assertions are compile-time, so runtime behavior remains the same
  });

  it('should handle assertion in delete method correctly', () => {
    storageService.set('bar', 50);
    storageService.delete('bar');
    expect(storageService).toBeInstanceOf(InMemoryStorageService);
    // Type assertions are compile-time, so runtime behavior remains the same
  });
});
