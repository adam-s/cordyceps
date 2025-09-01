/**
 * Cache System Tests
 *
 * Comprehensive test suite for Stagehand cache system including:
 * - BaseCache functionality
 * - ActionCache operations
 * - LLMCache operations
 * - Cache locking mechanisms
 * - Storage integration
 * - Request ID tracking
 */

import { ActionCache, PlaywrightCommand } from '../../lib/cache/ActionCache';
import { LLMCache } from '../../lib/cache/LLMCache';
import { BaseCache } from '../../lib/cache/BaseCache';
import { LogLine } from '../../types/log';

// Mock event implementation for storage tests
interface MockEvent<T> {
  (listener: (e: T) => void): { dispose(): void };
}

// Mock storage implementation for testing
class MockStorage<S = Record<string, unknown>> {
  private data: Record<string, unknown> = {};
  declare readonly _serviceBrand: undefined;

  async start(): Promise<void> {
    // Mock implementation - nothing needed for tests
  }

  async get<K extends keyof S>(key: K): Promise<S[K] | undefined> {
    return this.data[key as string] as S[K] | undefined;
  }

  async set<K extends keyof S>(key: K, value: S[K]): Promise<void> {
    this.data[key as string] = value;
  }

  async delete<K extends keyof S>(key: K): Promise<void> {
    delete this.data[key as string];
  }

  async has<K extends keyof S>(key: K): Promise<boolean> {
    return (key as string) in this.data;
  }

  // Mock Event implementation for tests - compatible with VS Code Event interface
  readonly onUpdateValue: MockEvent<{
    key: keyof S;
    newValue: S[keyof S] | undefined;
    oldValue: S[keyof S] | undefined;
  }> = _listener => {
    // Mock event listener - just return a disposable
    return { dispose: () => {} };
  };

  clear(): void {
    this.data = {};
  }

  getAll(): Record<string, unknown> {
    return { ...this.data };
  }
}

// Test progress interface
interface CacheTestProgress {
  log: (message: string) => void;
}

// Test storage interface - accepts either real storage or mock
interface TestStorageService {
  get<K extends keyof Record<string, unknown>>(
    key: K
  ): Promise<Record<string, unknown>[K] | undefined>;
  set<K extends keyof Record<string, unknown>>(
    key: K,
    value: Record<string, unknown>[K]
  ): Promise<void>;
  delete<K extends keyof Record<string, unknown>>(key: K): Promise<void>;
  has<K extends keyof Record<string, unknown>>(key: K): Promise<boolean>;
  readonly onUpdateValue: {
    event: () => { dispose: () => void };
  };
  start(): Promise<void>;
}

/**
 * Test BaseCache core functionality
 */
async function testBaseCache(
  progress: CacheTestProgress,
  storage?: TestStorageService
): Promise<boolean> {
  progress.log('🗄️ Testing BaseCache core functionality...');

  try {
    const testStorage = storage || new MockStorage();
    const logs: LogLine[] = [];

    const logger = (logLine: LogLine) => {
      logs.push(logLine);
    };

    // Create BaseCache instance
    const cache = new BaseCache(logger, testStorage as never, 'test_cache');

    // Test basic set/get operations
    const testData = { message: 'test data', timestamp: Date.now() };
    const hashObj = { key: 'test', value: 'data' };
    const requestId = 'test-request-1';

    // Test set operation
    await cache.set(hashObj, testData, requestId);
    progress.log('✅ Set operation completed');

    // Test get operation
    const retrieved = await cache.get(hashObj, requestId);
    if (!retrieved) {
      progress.log('❌ Get operation failed - no data retrieved');
      return false;
    }

    if (JSON.stringify(retrieved) !== JSON.stringify(testData)) {
      progress.log('❌ Retrieved data does not match stored data');
      return false;
    }
    progress.log('✅ Get operation successful - data matches');

    // Test cache miss
    const nonExistentData = await cache.get({ key: 'nonexistent' }, requestId);
    if (nonExistentData !== null) {
      progress.log('❌ Cache miss should return null');
      return false;
    }
    progress.log('✅ Cache miss handled correctly');

    // Test delete operation
    await cache.delete(hashObj);
    const deletedData = await cache.get(hashObj, requestId);
    if (deletedData !== null) {
      progress.log('❌ Delete operation failed - data still exists');
      return false;
    }
    progress.log('✅ Delete operation successful');

    // Test resetCache
    await cache.set({ key: 'reset-test' }, { data: 'test' }, requestId);
    await cache.resetCache();
    const resetData = await cache.get({ key: 'reset-test' }, requestId);
    if (resetData !== null) {
      progress.log('❌ Reset cache failed - data still exists');
      return false;
    }
    progress.log('✅ Reset cache successful');

    return true;
  } catch (error) {
    progress.log(`❌ BaseCache test failed: ${error}`);
    return false;
  }
}

/**
 * Test ActionCache functionality
 */
async function testActionCache(
  progress: CacheTestProgress,
  storage?: TestStorageService
): Promise<boolean> {
  progress.log('🎬 Testing ActionCache functionality...');

  try {
    const testStorage = storage || new MockStorage();
    const logs: LogLine[] = [];

    const logger = (logLine: LogLine) => {
      logs.push(logLine);
    };

    // Create ActionCache instance
    const actionCache = new ActionCache(logger, testStorage as never, 'action_test');

    // Test action step data
    const playwrightCommand: PlaywrightCommand = {
      method: 'click',
      args: ['button[type="submit"]'],
    };

    const actionStepData = {
      url: 'https://example.com',
      action: 'click submit button',
      previousSelectors: ['input[name="email"]', 'input[name="password"]'],
      playwrightCommand,
      componentString: '<button type="submit">Submit</button>',
      requestId: 'action-test-1',
      xpaths: ['//button[@type="submit"]'],
      newStepString: 'Step 3: Click submit button',
      completed: true,
    };

    // Test addActionStep
    await actionCache.addActionStep(actionStepData);
    progress.log('✅ addActionStep completed');

    // Test getActionStep
    const retrievedAction = await actionCache.getActionStep({
      url: actionStepData.url,
      action: actionStepData.action,
      previousSelectors: actionStepData.previousSelectors,
      requestId: actionStepData.requestId,
    });

    if (!retrievedAction) {
      progress.log('❌ getActionStep failed - no data retrieved');
      return false;
    }

    // Validate retrieved action data
    if (retrievedAction.action !== actionStepData.action) {
      progress.log('❌ Retrieved action does not match stored action');
      return false;
    }

    if (retrievedAction.playwrightCommand.method !== playwrightCommand.method) {
      progress.log('❌ Retrieved playwright command does not match');
      return false;
    }

    if (retrievedAction.completed !== true) {
      progress.log('❌ Retrieved completed status does not match');
      return false;
    }

    progress.log('✅ getActionStep successful - all data matches');

    // Test removeActionStep
    await actionCache.removeActionStep({
      url: actionStepData.url,
      action: actionStepData.action,
      previousSelectors: actionStepData.previousSelectors,
      requestId: actionStepData.requestId,
    });

    const removedAction = await actionCache.getActionStep({
      url: actionStepData.url,
      action: actionStepData.action,
      previousSelectors: actionStepData.previousSelectors,
      requestId: actionStepData.requestId,
    });

    if (removedAction !== null) {
      progress.log('❌ removeActionStep failed - data still exists');
      return false;
    }
    progress.log('✅ removeActionStep successful');

    // Test clearAction (by requestId)
    await actionCache.addActionStep(actionStepData);
    await actionCache.clearAction(actionStepData.requestId);

    const clearedAction = await actionCache.getActionStep({
      url: actionStepData.url,
      action: actionStepData.action,
      previousSelectors: actionStepData.previousSelectors,
      requestId: actionStepData.requestId,
    });

    if (clearedAction !== null) {
      progress.log('❌ clearAction failed - data still exists');
      return false;
    }
    progress.log('✅ clearAction successful');

    return true;
  } catch (error) {
    progress.log(`❌ ActionCache test failed: ${error}`);
    return false;
  }
}

/**
 * Test LLMCache functionality
 */
async function testLLMCache(
  progress: CacheTestProgress,
  storage?: TestStorageService
): Promise<boolean> {
  progress.log('🤖 Testing LLMCache functionality...');

  try {
    const testStorage = storage || new MockStorage();
    const logs: LogLine[] = [];

    // Create LLMCache instance with compatible logger
    const llmLogger = (message: { category?: string; message: string; level?: number }) => {
      logs.push({
        category: message.category || 'llm_cache',
        message: message.message,
        level: (message.level || 1) as 1 | 2,
      });
    };

    const llmCache = new LLMCache(llmLogger, testStorage as never, 'llm_test');

    // Test LLM response caching
    const llmOptions = {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2+2?' },
      ],
      temperature: 0.7,
    };

    const llmResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: '2+2 equals 4.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      },
    };

    const requestId = 'llm-test-1';

    // Test set operation
    await llmCache.set(llmOptions, llmResponse, requestId);
    progress.log('✅ LLM set operation completed');

    // Test get operation with type casting
    const retrievedResponse = await llmCache.get<typeof llmResponse>(llmOptions, requestId);

    if (!retrievedResponse) {
      progress.log('❌ LLM get operation failed - no data retrieved');
      return false;
    }

    // Validate LLM response data
    if (retrievedResponse.id !== llmResponse.id) {
      progress.log('❌ Retrieved LLM response ID does not match');
      return false;
    }

    if (retrievedResponse.choices[0].message.content !== llmResponse.choices[0].message.content) {
      progress.log('❌ Retrieved LLM response content does not match');
      return false;
    }

    progress.log('✅ LLM get operation successful - data matches');

    // Test cache with different options (should be cache miss)
    const differentOptions = { ...llmOptions, temperature: 0.5 };
    const missResponse = await llmCache.get<typeof llmResponse>(differentOptions, requestId);

    if (missResponse !== null) {
      progress.log('❌ Different options should result in cache miss');
      return false;
    }
    progress.log('✅ LLM cache miss with different options handled correctly');

    return true;
  } catch (error) {
    progress.log(`❌ LLMCache test failed: ${error}`);
    return false;
  }
}

/**
 * Test cache locking mechanism
 */
async function testCacheLocking(
  progress: CacheTestProgress,
  storage?: TestStorageService
): Promise<boolean> {
  progress.log('🔒 Testing cache locking mechanisms...');

  try {
    const testStorage = storage || new MockStorage();
    const logs: LogLine[] = [];

    const logger = (logLine: LogLine) => {
      logs.push(logLine);
    };

    // Create BaseCache instance
    const cache = new BaseCache(logger, testStorage as never, 'lock_test');

    // Test lock acquisition
    const lockAcquired = await cache.acquireLock();
    if (!lockAcquired) {
      progress.log('❌ Failed to acquire lock');
      return false;
    }
    progress.log('✅ Lock acquired successfully');

    // Test lock release
    await cache.releaseLock();
    progress.log('✅ Lock released successfully');

    // Test concurrent lock acquisition (simulate)
    const lock1 = await cache.acquireLock();
    if (!lock1) {
      progress.log('❌ Failed to acquire first lock');
      return false;
    }

    // Try to acquire lock again (should succeed after release)
    await cache.releaseLock();
    const lock2 = await cache.acquireLock();
    if (!lock2) {
      progress.log('❌ Failed to acquire lock after release');
      return false;
    }

    await cache.releaseLock();
    progress.log('✅ Concurrent lock handling successful');

    return true;
  } catch (error) {
    progress.log(`❌ Cache locking test failed: ${error}`);
    return false;
  }
}

/**
 * Test request ID tracking and cleanup
 */
async function testRequestIdTracking(
  progress: CacheTestProgress,
  storage?: TestStorageService
): Promise<boolean> {
  progress.log('🔍 Testing request ID tracking and cleanup...');

  try {
    const testStorage = storage || new MockStorage();
    const logs: LogLine[] = [];

    const logger = (logLine: LogLine) => {
      logs.push(logLine);
    };

    // Create ActionCache instance
    const actionCache = new ActionCache(logger, testStorage as never, 'tracking_test');

    const requestId1 = 'request-1';
    const requestId2 = 'request-2';

    // Add multiple actions for different request IDs
    const baseActionData = {
      url: 'https://example.com',
      playwrightCommand: { method: 'click', args: ['button'] } as PlaywrightCommand,
      componentString: '<button>Click me</button>',
      xpaths: ['//button'],
      newStepString: 'Click button',
      completed: true,
    };

    // Actions for request 1
    await actionCache.addActionStep({
      ...baseActionData,
      action: 'action1',
      previousSelectors: ['selector1'],
      requestId: requestId1,
    });

    await actionCache.addActionStep({
      ...baseActionData,
      action: 'action2',
      previousSelectors: ['selector2'],
      requestId: requestId1,
    });

    // Actions for request 2
    await actionCache.addActionStep({
      ...baseActionData,
      action: 'action3',
      previousSelectors: ['selector3'],
      requestId: requestId2,
    });

    progress.log('✅ Multiple actions added for different request IDs');

    // Verify actions exist
    const action1 = await actionCache.getActionStep({
      url: baseActionData.url,
      action: 'action1',
      previousSelectors: ['selector1'],
      requestId: requestId1,
    });

    const action3 = await actionCache.getActionStep({
      url: baseActionData.url,
      action: 'action3',
      previousSelectors: ['selector3'],
      requestId: requestId2,
    });

    if (!action1 || !action3) {
      progress.log('❌ Actions not found after adding');
      return false;
    }

    // Clear actions for request 1 only
    await actionCache.clearAction(requestId1);
    progress.log('✅ Cleared actions for request 1');

    // Verify request 1 actions are gone
    const clearedAction1 = await actionCache.getActionStep({
      url: baseActionData.url,
      action: 'action1',
      previousSelectors: ['selector1'],
      requestId: requestId1,
    });

    if (clearedAction1 !== null) {
      progress.log('❌ Request 1 actions should be cleared');
      return false;
    }

    // Verify request 2 actions still exist
    const remainingAction3 = await actionCache.getActionStep({
      url: baseActionData.url,
      action: 'action3',
      previousSelectors: ['selector3'],
      requestId: requestId2,
    });

    if (!remainingAction3) {
      progress.log('❌ Request 2 actions should still exist');
      return false;
    }

    progress.log('✅ Request ID tracking and selective cleanup successful');

    return true;
  } catch (error) {
    progress.log(`❌ Request ID tracking test failed: ${error}`);
    return false;
  }
}

/**
 * Test cache storage integration
 */
async function testStorageIntegration(
  progress: CacheTestProgress,
  storage?: TestStorageService
): Promise<boolean> {
  progress.log('💾 Testing storage integration...');

  try {
    const testStorage = storage || new MockStorage();
    const logs: LogLine[] = [];

    const logger = (logLine: LogLine) => {
      logs.push(logLine);
    };

    // Create cache instance
    const cache = new BaseCache(logger, testStorage as never, 'storage_test');

    // Test multiple cache entries
    const entries = [
      { key: 'entry1', data: { value: 'data1' }, requestId: 'req1' },
      { key: 'entry2', data: { value: 'data2' }, requestId: 'req2' },
      { key: 'entry3', data: { value: 'data3' }, requestId: 'req3' },
    ];

    // Add all entries
    for (const entry of entries) {
      await cache.set({ key: entry.key }, entry.data, entry.requestId);
    }
    progress.log('✅ Multiple entries added to storage');

    // Verify all entries exist
    for (const entry of entries) {
      const retrieved = await cache.get({ key: entry.key }, entry.requestId);
      if (!retrieved || JSON.stringify(retrieved) !== JSON.stringify(entry.data)) {
        progress.log(`❌ Entry ${entry.key} not properly stored/retrieved`);
        return false;
      }
    }
    progress.log('✅ All entries properly stored and retrieved');

    // Test storage persistence (simulate restart by creating new cache instance)
    const newCache = new BaseCache(logger, testStorage as never, 'storage_test');

    // Verify entries still exist after "restart"
    for (const entry of entries) {
      const retrieved = await newCache.get({ key: entry.key }, entry.requestId);
      if (!retrieved || JSON.stringify(retrieved) !== JSON.stringify(entry.data)) {
        progress.log(`❌ Entry ${entry.key} not persistent across cache instances`);
        return false;
      }
    }
    progress.log('✅ Storage persistence verified');

    return true;
  } catch (error) {
    progress.log(`❌ Storage integration test failed: ${error}`);
    return false;
  }
}

/**
 * Run all cache tests
 */
export async function runCacheTests(
  progress: CacheTestProgress,
  storage?: TestStorageService
): Promise<{
  passed: number;
  total: number;
  success: boolean;
}> {
  progress.log('🗄️ Starting Cache System Test Suite...');

  const tests = [
    { name: 'BaseCache Core', test: (p: CacheTestProgress) => testBaseCache(p, storage) },
    { name: 'ActionCache Operations', test: (p: CacheTestProgress) => testActionCache(p, storage) },
    { name: 'LLMCache Operations', test: (p: CacheTestProgress) => testLLMCache(p, storage) },
    { name: 'Cache Locking', test: (p: CacheTestProgress) => testCacheLocking(p, storage) },
    {
      name: 'Request ID Tracking',
      test: (p: CacheTestProgress) => testRequestIdTracking(p, storage),
    },
    {
      name: 'Storage Integration',
      test: (p: CacheTestProgress) => testStorageIntegration(p, storage),
    },
  ];

  let passed = 0;
  const total = tests.length;

  for (const { name, test } of tests) {
    progress.log(`\n📋 Running test: ${name}`);
    try {
      const result = await test(progress);
      if (result) {
        progress.log(`✅ ${name} test passed`);
        passed++;
      } else {
        progress.log(`❌ ${name} test failed`);
        progress.log(`   Test ${name} returned false - check individual test logs above`);
      }
    } catch (error) {
      progress.log(`❌ ${name} test error: ${error}`);
      progress.log(`   Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      progress.log(`   Error type: ${typeof error}`);
      progress.log(`   Error constructor: ${error?.constructor?.name}`);
    }
  }

  const success = passed === total;

  progress.log(`\n🏁 Cache tests completed: ${passed}/${total} passed`);

  if (success) {
    progress.log('✅ All cache tests passed! 🎉');
  } else {
    progress.log('❌ Some cache tests failed');
  }

  return { passed, total, success };
}

/**
 * Test runner function for integration with playground
 */
export async function testCacheSystem(
  progress: CacheTestProgress,
  storage?: TestStorageService
): Promise<boolean> {
  console.log(
    `[testCacheSystem] info Starting Cache System Tests with storage type: ${storage ? 'real' : 'mock'} ######`
  );
  progress.log('🚀 Starting Cache System Tests...');

  try {
    const results = await runCacheTests(progress, storage);
    console.log(
      `[testCacheSystem] info Cache tests completed: ${results.passed}/${results.total} passed ######`
    );
    progress.log(`🏁 Cache tests completed: ${results.passed}/${results.total} passed`);
    return results.success;
  } catch (error) {
    console.log(
      `[testCacheSystem] info Cache system test suite failed with error: ${error} ######`
    );
    progress.log(`❌ Cache system test suite failed with error: ${error}`);
    progress.log(`   Error details: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    return false;
  }
}
