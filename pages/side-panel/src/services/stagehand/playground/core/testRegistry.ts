/**
 * Test Registry
 *
 * Central registry for managing all test runners and coordinating test execution.
 * Provides a clean interface for the main service to interact with tests.
 */

import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from '@shared/services/log.service';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';
import { EventMessage } from '@src/utils/types';

import { ITestRunner } from './baseTestRunner';
import { FallbackContentScriptTestRunner } from '../playgroundTests';
import { IntegrationTestRunner } from './integrationTestRunner';
import { HandlerTestRunner } from '../playgroundTests/simpleHandlerTestRunner';

export interface ITestRegistry {
  /**
   * Get a test runner by name
   */
  getTestRunner(name: string): ITestRunner | undefined;

  /**
   * Get all available test runners
   */
  getAllTestRunners(): ITestRunner[];

  /**
   * Run a specific test by name
   */
  runTest(testName: string): Promise<void>;

  /**
   * Run all tests in sequence
   */
  runAllTests(): Promise<void>;

  /**
   * Run fallback content script tests
   */
  runFallbackContentScriptTests(): Promise<void>;

  /**
   * Run integration tests
   */
  runIntegrationTests(): Promise<void>;

  /**
   * Run a specific example test
   */
  runExampleBasicStepsTest(): Promise<void>;

  /**
   * Run elephant research test
   */
  runElephantResearchTest(): Promise<void>;

  /**
   * Run ARIA reference processing tests
   */
  runAriaRefProcessingTest(): Promise<void>;

  /**
   * Run handler tests
   */
  runHandlerTests(): Promise<void>;
}

export class TestRegistry extends Disposable implements ITestRegistry {
  private readonly _testRunners = new Map<string, ITestRunner>();

  constructor(
    private readonly _events: { emit: (event: EventMessage) => void },
    private readonly _logService: ILogService,
    private readonly _storage: ILocalAsyncStorage<SidePanelAppStorageSchema>
  ) {
    super();

    this._initializeTestRunners();
  }

  /**
   * Initialize all test runners
   */
  private _initializeTestRunners(): void {
    // Create fallback content script test runner
    const fallbackRunner = new FallbackContentScriptTestRunner(
      this._events,
      this._logService,
      this._storage
    );
    this._register(fallbackRunner);
    this._testRunners.set('fallback', fallbackRunner);
    this._testRunners.set('fallback-content-script', fallbackRunner);

    // Create integration test runner
    const integrationRunner = new IntegrationTestRunner(
      this._events,
      this._logService,
      this._storage
    );
    this._register(integrationRunner);
    this._testRunners.set('integration', integrationRunner);
    this._testRunners.set('integration-tests', integrationRunner);

    // Create handler test runner
    const handlerRunner = new HandlerTestRunner(this._events, this._logService, this._storage);
    this._register(handlerRunner);
    this._testRunners.set('handler', handlerRunner);
    this._testRunners.set('handlers', handlerRunner);
    this._testRunners.set('simple-handlers', handlerRunner);
  }

  public getTestRunner(name: string): ITestRunner | undefined {
    return this._testRunners.get(name.toLowerCase());
  }

  public getAllTestRunners(): ITestRunner[] {
    return Array.from(this._testRunners.values());
  }

  public async runTest(testName: string): Promise<void> {
    const runner = this.getTestRunner(testName);
    if (!runner) {
      throw new Error(`Test runner not found: ${testName}`);
    }

    await runner.run();
  }

  public async runAllTests(): Promise<void> {
    this._logService.info('TestRegistry: Running all tests in sequence...');

    for (const runner of this.getAllTestRunners()) {
      try {
        await runner.run();
      } catch (error) {
        this._logService.error(`Test runner ${runner.name} failed:`, error);
        // Continue with other tests even if one fails
      }
    }
  }

  public async runFallbackContentScriptTests(): Promise<void> {
    const runner = this._testRunners.get('fallback') as FallbackContentScriptTestRunner;
    if (!runner) {
      throw new Error('Fallback content script test runner not found');
    }

    await runner.run();
  }

  public async runIntegrationTests(): Promise<void> {
    const runner = this._testRunners.get('integration') as IntegrationTestRunner;
    if (!runner) {
      throw new Error('Integration test runner not found');
    }

    await runner.run();
  }

  public async runExampleBasicStepsTest(): Promise<void> {
    const runner = this._testRunners.get('integration') as IntegrationTestRunner;
    if (!runner) {
      throw new Error('Integration test runner not found');
    }

    await runner.runExampleBasicStepsTest();
  }

  public async runElephantResearchTest(): Promise<void> {
    const runner = this._testRunners.get('integration') as IntegrationTestRunner;
    if (!runner) {
      throw new Error('Integration test runner not found');
    }

    await runner.runElephantResearchTest();
  }

  public async runAriaRefProcessingTest(): Promise<void> {
    const runner = this._testRunners.get('fallback') as FallbackContentScriptTestRunner;
    if (!runner) {
      throw new Error('Fallback content script test runner not found');
    }

    await runner.runAriaRefProcessingTests();
  }

  public async runHandlerTests(): Promise<void> {
    const runner = this._testRunners.get('handler') as HandlerTestRunner;
    if (!runner) {
      throw new Error('Handler test runner not found');
    }

    await runner.run();
  }
}
