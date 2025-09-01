import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage, Severity } from '@src/utils/types';
import { ICordycepsService } from '../../cordyceps.service';
import { Progress, ProgressController } from '../../core/progress';
import { Page } from '../../page';
import { BrowserWindow } from '../../browserWindow';

export interface TestContext {
  readonly events: SimpleEventEmitter<EventMessage>;
  readonly cordycepsService: ICordycepsService;
  getBrowser(progress: Progress): Promise<BrowserWindow>;
  newPage(browser: BrowserWindow, progress: Progress): Promise<Page>;
  navigate(page: Page, progress: Progress): Promise<void>;
}

export abstract class PlaygroundTest {
  constructor(protected readonly context: TestContext) {}

  protected abstract _run(progress: Progress): Promise<void>;

  public async run(timeout: number, name: string): Promise<void> {
    const startTime = Date.now();
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: `Starting ${name}`,
    });

    try {
      const progressController = new ProgressController(timeout);
      await progressController.run(async progress => {
        await this._run(progress);
      });

      const duration = Date.now() - startTime;
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: `${name} completed`,
        details: { duration },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: `${name} failed`,
        error: error instanceof Error ? error : new Error(String(error)),
        details: { duration },
      });
      throw error;
    }
  }
}
