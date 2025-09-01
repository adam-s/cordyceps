import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage } from '@src/utils/types';
import { IStagehandService } from '../stagehand.service';
import { ILogService } from '@shared/services/log.service';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';

// Import new test infrastructure
import { TestRegistry, ITestRegistry } from './core';

export const IStagehandPlaygroundService = createDecorator<IStagehandPlaygroundService>(
  'stagehandPlaygroundService'
);

export interface IStagehandPlaygroundService {
  readonly _serviceBrand: undefined;
  /** Event that fires when stagehand playground events occur. */
  readonly onEvent: Event<EventMessage>;
  /** Run fallback content script tests */
  runFallbackContentScriptTests: () => Promise<void>;
  /** Run example basic steps test */
  runExampleBasicStepsTest: () => Promise<void>;
  /** Run elephant research test */
  runElephantResearchTest: () => Promise<void>;
  /** Run ARIA reference processing tests */
  runAriaRefProcessingTest: () => Promise<void>;
  /** Run handler tests */
  runHandlerTests: () => Promise<void>;
  /** Run all tests in sequence */
  runAllTests: () => Promise<void>;
  /** Run integration tests only */
  runIntegrationTests: () => Promise<void>;
}

export class StagehandPlaygroundService extends Disposable implements IStagehandPlaygroundService {
  public readonly _serviceBrand: undefined;

  readonly events = this._register(new SimpleEventEmitter<EventMessage>('StagehandPlayground'));
  public readonly onEvent: Event<EventMessage> = this.events.event;

  private readonly _testRegistry: ITestRegistry;

  constructor(
    @IStagehandService private readonly _stagehandService: IStagehandService,
    @ILogService private readonly _logService: ILogService,
    @ILocalAsyncStorage private readonly _storage: ILocalAsyncStorage<SidePanelAppStorageSchema>
  ) {
    super();
    this._logService.info('StagehandPlaygroundService: constructed');

    // Initialize test registry with event emitter
    this._testRegistry = this._register(
      new TestRegistry(this.events, this._logService, this._storage)
    );
  }

  public async runFallbackContentScriptTests(): Promise<void> {
    await this._testRegistry.runFallbackContentScriptTests();
  }

  public async runExampleBasicStepsTest(): Promise<void> {
    await this._testRegistry.runExampleBasicStepsTest();
  }

  public async runElephantResearchTest(): Promise<void> {
    await this._testRegistry.runElephantResearchTest();
  }

  public async runAriaRefProcessingTest(): Promise<void> {
    await this._testRegistry.runAriaRefProcessingTest();
  }

  public async runHandlerTests(): Promise<void> {
    await this._testRegistry.runHandlerTests();
  }

  public async runAllTests(): Promise<void> {
    await this._testRegistry.runAllTests();
  }

  public async runIntegrationTests(): Promise<void> {
    await this._testRegistry.runIntegrationTests();
  }
}
