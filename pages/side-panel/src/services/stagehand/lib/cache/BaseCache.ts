import { LogLine } from '../../types/log';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';

export interface CacheEntry {
  timestamp: number;
  data: unknown;
  requestId: string;
}

export interface CacheStore {
  [key: string]: CacheEntry;
}

interface StagehandCacheStorageSchema extends SidePanelAppStorageSchema {
  [key: string]: unknown;
}

export class BaseCache<T extends CacheEntry> {
  private readonly CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
  private readonly CLEANUP_PROBABILITY = 0.01; // 1% chance

  protected cacheKey: string;
  protected lockKey: string;
  protected requestIdMapKey: string;
  protected logger: (message: LogLine) => void;
  protected storage: ILocalAsyncStorage<StagehandCacheStorageSchema>;

  private readonly LOCK_TIMEOUT_MS = 1_000;
  protected lockAcquired = false;
  protected lockAcquireFailures = 0;

  // Added for request ID tracking
  protected requestIdToUsedHashes: { [key: string]: string[] } = {};

  constructor(
    logger: (message: LogLine) => void,
    storage: ILocalAsyncStorage<StagehandCacheStorageSchema>,
    cachePrefix: string = 'stagehand_cache'
  ) {
    this.logger = logger;
    this.storage = storage;
    this.cacheKey = `${cachePrefix}_data`;
    this.lockKey = `${cachePrefix}_lock`;
    this.requestIdMapKey = `${cachePrefix}_requestIdMap`;
  }

  protected async createHash(data: unknown): Promise<string> {
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async acquireLock(): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < this.LOCK_TIMEOUT_MS) {
      try {
        const existingLock = await this.storage.get(
          this.lockKey as keyof StagehandCacheStorageSchema
        );
        if (existingLock) {
          // In Chrome storage, we'll use a simple timeout-based approach
          await this.sleep(5);
          continue;
        }

        await this.storage.set(this.lockKey as keyof StagehandCacheStorageSchema, true as never);
        this.lockAcquireFailures = 0;
        this.lockAcquired = true;
        this.logger({
          category: 'base_cache',
          message: 'Lock acquired',
          level: 1,
        });
        return true;
      } catch (error) {
        this.logger({
          category: 'base_cache',
          message: 'error acquiring lock',
          level: 2,
          auxiliary: {
            trace: {
              value: (error as Error).stack ?? 'No stack trace',
              type: 'string',
            },
            message: {
              value: (error as Error).message,
              type: 'string',
            },
          },
        });
        await this.sleep(5);
      }
    }
    this.logger({
      category: 'base_cache',
      message: 'Failed to acquire lock after timeout',
      level: 2,
    });
    this.lockAcquireFailures++;
    if (this.lockAcquireFailures >= 3) {
      this.logger({
        category: 'base_cache',
        message: 'Failed to acquire lock 3 times in a row. Releasing lock manually.',
        level: 1,
      });
      await this.releaseLock();
    }
    return false;
  }

  public async releaseLock(): Promise<void> {
    try {
      await this.storage.delete(this.lockKey as keyof StagehandCacheStorageSchema);
      this.logger({
        category: 'base_cache',
        message: 'Lock released',
        level: 1,
      });
      this.lockAcquired = false;
    } catch (error) {
      this.logger({
        category: 'base_cache',
        message: 'error releasing lock',
        level: 2,
        auxiliary: {
          error: {
            value: (error as Error).message,
            type: 'string',
          },
          trace: {
            value: (error as Error).stack ?? 'No stack trace',
            type: 'string',
          },
        },
      });
    }
  }

  /**
   * Cleans up stale cache entries that exceed the maximum age.
   */
  public async cleanupStaleEntries(): Promise<void> {
    if (!(await this.acquireLock())) {
      this.logger({
        category: 'llm_cache',
        message: 'failed to acquire lock for cleanup',
        level: 2,
      });
      return;
    }

    try {
      const cache = await this.readCache();
      const now = Date.now();
      let entriesRemoved = 0;

      for (const [hash, entry] of Object.entries(cache)) {
        if (now - entry.timestamp > this.CACHE_MAX_AGE_MS) {
          delete cache[hash];
          entriesRemoved++;
        }
      }

      if (entriesRemoved > 0) {
        await this.writeCache(cache);
        this.logger({
          category: 'llm_cache',
          message: 'cleaned up stale cache entries',
          level: 1,
          auxiliary: {
            entriesRemoved: {
              value: entriesRemoved.toString(),
              type: 'integer',
            },
          },
        });
      }
    } catch (error) {
      this.logger({
        category: 'llm_cache',
        message: 'error during cache cleanup',
        level: 2,
        auxiliary: {
          error: {
            value: (error as Error).message,
            type: 'string',
          },
          trace: {
            value: (error as Error).stack ?? 'No stack trace',
            type: 'string',
          },
        },
      });
    } finally {
      await this.releaseLock();
    }
  }

  protected async readCache(): Promise<CacheStore> {
    try {
      const data = await this.storage.get(this.cacheKey as keyof StagehandCacheStorageSchema);
      const result = (data as CacheStore) || {};
      return result;
    } catch (error) {
      this.logger({
        category: 'base_cache',
        message: 'error reading cache. resetting cache.',
        level: 1,
        auxiliary: {
          error: {
            value: (error as Error).message,
            type: 'string',
          },
          trace: {
            value: (error as Error).stack ?? 'No stack trace',
            type: 'string',
          },
        },
      });
      await this.resetCache();
      return {};
    }
  }

  protected async writeCache(cache: CacheStore): Promise<void> {
    try {
      await this.storage.set(this.cacheKey as keyof StagehandCacheStorageSchema, cache as never);
      this.logger({
        category: 'base_cache',
        message: 'Cache written to storage',
        level: 1,
      });
    } catch (error) {
      this.logger({
        category: 'base_cache',
        message: 'error writing cache to storage',
        level: 2,
        auxiliary: {
          error: {
            value: (error as Error).message,
            type: 'string',
          },
          trace: {
            value: (error as Error).stack ?? 'No stack trace',
            type: 'string',
          },
        },
      });
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Retrieves data from the cache based on the provided options.
   * @param hashObj - The options used to generate the cache key.
   * @param requestId - The identifier for the current request.
   * @returns The cached data if available, otherwise null.
   */
  public async get(
    hashObj: Record<string, unknown> | string,
    requestId: string
  ): Promise<T['data'] | null> {
    if (!(await this.acquireLock())) {
      this.logger({
        category: 'base_cache',
        message: 'Failed to acquire lock for getting cache',
        level: 2,
      });
      return null;
    }

    try {
      const hash = await this.createHash(hashObj);
      const cache = await this.readCache();

      this.logger({
        category: 'base_cache',
        message: `Debug get operation - hash: ${hash}, cache keys: ${Object.keys(cache).length}`,
        level: 1,
      });

      if (cache[hash]) {
        this.logger({
          category: 'base_cache',
          message: `Cache hit for hash ${hash}`,
          level: 1,
        });
        this.trackRequestIdUsage(requestId, hash);
        return cache[hash].data;
      }

      this.logger({
        category: 'base_cache',
        message: `Cache miss for hash ${hash}`,
        level: 1,
      });
      return null;
    } catch (error) {
      this.logger({
        category: 'base_cache',
        message: 'error getting cache. resetting cache.',
        level: 1,
        auxiliary: {
          error: {
            value: (error as Error).message,
            type: 'string',
          },
          trace: {
            value: (error as Error).stack ?? 'No stack trace',
            type: 'string',
          },
        },
      });

      await this.resetCache();
      return null;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Stores data in the cache based on the provided options and requestId.
   * @param hashObj - The options used to generate the cache key.
   * @param data - The data to be cached.
   * @param requestId - The identifier for the cache entry.
   */
  public async set(
    hashObj: Record<string, unknown>,
    data: T['data'],
    requestId: string
  ): Promise<void> {
    if (!(await this.acquireLock())) {
      this.logger({
        category: 'base_cache',
        message: 'Failed to acquire lock for setting cache',
        level: 2,
      });
      return;
    }

    try {
      const hash = await this.createHash(hashObj);
      const cache = await this.readCache();
      cache[hash] = {
        data,
        timestamp: Date.now(),
        requestId,
      };

      await this.writeCache(cache);
      this.trackRequestIdUsage(requestId, hash);
    } catch (error) {
      this.logger({
        category: 'base_cache',
        message: 'error setting cache. resetting cache.',
        level: 1,
        auxiliary: {
          error: {
            value: (error as Error).message,
            type: 'string',
          },
          trace: {
            value: (error as Error).stack ?? 'No stack trace',
            type: 'string',
          },
        },
      });

      await this.resetCache();
    } finally {
      await this.releaseLock();

      if (Math.random() < this.CLEANUP_PROBABILITY) {
        this.cleanupStaleEntries();
      }
    }
  }

  public async delete(hashObj: Record<string, unknown>): Promise<void> {
    if (!(await this.acquireLock())) {
      this.logger({
        category: 'base_cache',
        message: 'Failed to acquire lock for removing cache entry',
        level: 2,
      });
      return;
    }

    try {
      const hash = await this.createHash(hashObj);
      const cache = await this.readCache();

      if (cache[hash]) {
        delete cache[hash];
        await this.writeCache(cache);
      } else {
        this.logger({
          category: 'base_cache',
          message: 'Cache entry not found to delete',
          level: 1,
        });
      }
    } catch (error) {
      this.logger({
        category: 'base_cache',
        message: 'error removing cache entry',
        level: 2,
        auxiliary: {
          error: {
            value: (error as Error).message,
            type: 'string',
          },
          trace: {
            value: (error as Error).stack ?? 'No stack trace',
            type: 'string',
          },
        },
      });
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Tracks the usage of a hash with a specific requestId.
   * @param requestId - The identifier for the current request.
   * @param hash - The cache key hash.
   */
  protected trackRequestIdUsage(requestId: string, hash: string): void {
    this.requestIdToUsedHashes[requestId] ??= [];
    this.requestIdToUsedHashes[requestId].push(hash);
  }

  /**
   * Deletes all cache entries associated with a specific requestId.
   * @param requestId - The identifier for the request whose cache entries should be deleted.
   */
  public async deleteCacheForRequestId(requestId: string): Promise<void> {
    if (!(await this.acquireLock())) {
      this.logger({
        category: 'base_cache',
        message: 'Failed to acquire lock for deleting cache',
        level: 2,
      });
      return;
    }
    try {
      const cache = await this.readCache();
      const hashes = this.requestIdToUsedHashes[requestId] ?? [];
      let entriesRemoved = 0;
      for (const hash of hashes) {
        if (cache[hash]) {
          delete cache[hash];
          entriesRemoved++;
        }
      }
      if (entriesRemoved > 0) {
        await this.writeCache(cache);
      } else {
        this.logger({
          category: 'base_cache',
          message: 'no cache entries found for requestId',
          level: 1,
          auxiliary: {
            requestId: {
              value: requestId,
              type: 'string',
            },
          },
        });
      }
      // Remove the requestId from the mapping after deletion
      delete this.requestIdToUsedHashes[requestId];
    } catch (error) {
      this.logger({
        category: 'base_cache',
        message: 'error deleting cache for requestId',
        level: 2,
        auxiliary: {
          error: {
            value: (error as Error).message,
            type: 'string',
          },
          trace: {
            value: (error as Error).stack ?? 'No stack trace',
            type: 'string',
          },
          requestId: {
            value: requestId,
            type: 'string',
          },
        },
      });
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Resets the entire cache by clearing the cache storage.
   */
  public async resetCache(): Promise<void> {
    try {
      await this.storage.delete(this.cacheKey as keyof StagehandCacheStorageSchema);
      this.requestIdToUsedHashes = {}; // Reset requestId tracking
    } catch (error) {
      this.logger({
        category: 'base_cache',
        message: 'error resetting cache',
        level: 2,
        auxiliary: {
          error: {
            value: (error as Error).message,
            type: 'string',
          },
          trace: {
            value: (error as Error).stack ?? 'No stack trace',
            type: 'string',
          },
        },
      });
    }
  }
}
