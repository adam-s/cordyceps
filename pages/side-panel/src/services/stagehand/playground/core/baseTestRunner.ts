/**
 * Base Test Runner
 *
 * Provides common functionality for all test runners including:
 * - Event emission helpers
 * - Error handling patterns
 * - Resource cleanup
 * - API key management
 */

import { Disposable } from 'vs/base/common/lifecycle';
import { EventMessage, Severity } from '@src/utils/types';
import { ILogService } from '@shared/services/log.service';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema, StorageKeys } from '@shared/storage/types/storage.types';
import { TestContext } from '../playgroundTests/types';

export interface ITestRunner {
  readonly name: string;
  run(): Promise<void>;
}

export abstract class BaseTestRunner extends Disposable implements ITestRunner {
  public abstract readonly name: string;

  protected readonly _disposables: Disposable[] = [];

  constructor(
    protected readonly _events: { emit: (event: EventMessage) => void },
    protected readonly _logService: ILogService,
    protected readonly _storage: ILocalAsyncStorage<SidePanelAppStorageSchema>
  ) {
    super();
  }

  public abstract run(): Promise<void>;

  /**
   * Emit an info event with consistent formatting
   */
  protected emitInfo(message: string, details?: Record<string, unknown>): void {
    this._events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message,
      details,
    });
  }

  /**
   * Emit a success event with consistent formatting
   */
  protected emitSuccess(message: string, details?: Record<string, unknown>): void {
    this._events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message,
      details,
    });
  }

  /**
   * Emit an error event with consistent formatting
   */
  protected emitError(
    message: string,
    error?: Error | string,
    details?: Record<string, unknown>
  ): void {
    this._events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message,
      error: error instanceof Error ? error : new Error(String(error)),
      details,
    });
  }

  /**
   * Emit a warning event with consistent formatting
   */
  protected emitWarning(message: string, details?: Record<string, unknown>): void {
    this._events.emit({
      timestamp: Date.now(),
      severity: Severity.Warning,
      message,
      details,
    });
  }

  /**
   * Get OpenAI API key from storage with proper error handling
   */
  protected async getApiKey(): Promise<string> {
    const apiKey = (await this._storage.get(StorageKeys.OPEN_AI_API_KEY)) as string | undefined;

    if (!apiKey) {
      const errorMessage =
        'OpenAI API key not found in storage. Please configure it in the settings.';
      this.emitError(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }

    this.emitInfo('🔑 OpenAI API key retrieved from storage', {
      keyLength: apiKey.length,
      source: 'local-async-storage',
    });

    return apiKey;
  }

  /**
   * Create a test context with common properties
   */
  protected createTestContext(apiKey?: string): TestContext {
    return {
      events: this._events,
      storage: this._storage,
      apiKey,
    };
  }

  /**
   * Execute a test with proper error handling and cleanup
   */
  protected async executeTest(
    testName: string,
    testFunction: () => Promise<void>,
    cleanup?: () => Promise<void>
  ): Promise<void> {
    try {
      this.emitInfo(`🚀 Starting ${testName}...`);
      await testFunction();
      this.emitSuccess(`✅ ${testName} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._logService.error(`${testName} failed:`, error);
      this.emitError(`❌ ${testName} failed`, error instanceof Error ? error : String(error), {
        testName,
        error: errorMessage,
      });
      throw error;
    } finally {
      if (cleanup) {
        try {
          await cleanup();
          this.emitInfo(`🧹 ${testName} cleanup completed`);
        } catch (cleanupError) {
          this._logService.warn(`${testName} cleanup failed:`, cleanupError);
          this.emitWarning(`⚠️ ${testName} cleanup failed`, {
            error: String(cleanupError),
          });
        }
      }
    }
  }

  /**
   * Add a disposable resource for automatic cleanup
   */
  protected addDisposable(disposable: Disposable): void {
    this._disposables.push(disposable);
  }

  public dispose(): void {
    super.dispose();

    // Clean up all tracked disposables
    for (const disposable of this._disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        this._logService.warn('Error disposing resource:', error);
      }
    }

    this._disposables.length = 0;
  }
}
