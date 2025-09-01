/**
 * Simple Cache Test - Minimal test to debug cache system issues
 */

import { BaseCache } from '../../lib/cache/BaseCache';
import { LogLine } from '../../types/log';

// Simple mock storage for debugging
class SimpleMockStorage {
  private data: Record<string, unknown> = {};
  declare readonly _serviceBrand: undefined;

  async start(): Promise<void> {
    // Mock implementation
  }

  async get<K extends keyof Record<string, unknown>>(
    key: K
  ): Promise<Record<string, unknown>[K] | undefined> {
    return this.data[key as string] as Record<string, unknown>[K] | undefined;
  }

  async set<K extends keyof Record<string, unknown>>(
    key: K,
    value: Record<string, unknown>[K]
  ): Promise<void> {
    this.data[key as string] = value;
  }

  async delete<K extends keyof Record<string, unknown>>(key: K): Promise<void> {
    delete this.data[key as string];
  }

  async has<K extends keyof Record<string, unknown>>(key: K): Promise<boolean> {
    return (key as string) in this.data;
  }

  // Mock event support
  readonly onUpdateValue = {
    event: () => ({ dispose: () => {} }),
  } as never;

  clear(): void {
    this.data = {};
  }
}

export async function runSimpleCacheTest(progress: {
  log: (message: string) => void;
}): Promise<boolean> {
  progress.log('🔧 Starting simple cache test...');

  try {
    const mockStorage = new SimpleMockStorage();
    const logs: LogLine[] = [];

    const logger = (logLine: LogLine) => {
      logs.push(logLine);
    };

    progress.log('✅ Creating BaseCache instance...');
    const cache = new BaseCache(logger, mockStorage as never, 'simple_test');

    progress.log('✅ BaseCache created successfully');

    // Simple test
    const testData = { message: 'hello world' };
    const hashObj = { key: 'test' };
    const requestId = 'simple-test-1';

    progress.log('✅ Setting test data...');
    await cache.set(hashObj, testData, requestId);

    progress.log('✅ Getting test data...');
    const retrieved = await cache.get(hashObj, requestId);

    if (!retrieved) {
      progress.log('❌ Failed to retrieve data');
      return false;
    }

    progress.log('✅ Simple cache test completed successfully');
    return true;
  } catch (error) {
    progress.log(`❌ Simple cache test failed: ${error}`);
    progress.log(`   Error type: ${typeof error}`);
    progress.log(`   Error constructor: ${error?.constructor?.name}`);
    if (error instanceof Error) {
      progress.log(`   Error message: ${error.message}`);
      progress.log(`   Error stack: ${error.stack}`);
    }
    return false;
  }
}
