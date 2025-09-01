import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { TestContext } from './playgroundTests/api';
import { LocatorTest } from './playgroundTests/locatorTest';
import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage, Severity } from '@src/utils/types';
import { ICordycepsService } from '../cordyceps.service';
import { Progress } from '../core/progress';
import { Page } from '../page';
import { BrowserWindow } from '../browserWindow';

export const ICordycepsPlaygroundService = createDecorator<ICordycepsPlaygroundService>(
  'cordycepsPlaygroundService'
);

export interface ICordycepsPlaygroundService {
  readonly _serviceBrand: undefined;
  /** Event that fires when playground events occur. */
  readonly onEvent: Event<EventMessage>;
  /** Run locator test */
  runLocatorTest: () => Promise<void>;
}

export class CordycepsPlaygroundService
  extends Disposable
  implements ICordycepsPlaygroundService, TestContext
{
  public readonly _serviceBrand: undefined;

  readonly events = this._register(new SimpleEventEmitter<EventMessage>('CordycepsPlayground'));
  public readonly onEvent: Event<EventMessage> = this.events.event;

  private readonly _locatorTest = new LocatorTest(this);

  constructor(@ICordycepsService public readonly cordycepsService: ICordycepsService) {
    super();
  }

  public async runLocatorTest(): Promise<void> {
    await this._locatorTest.run(20_000, 'Locator Test');
  }

  async getBrowser(progress: Progress): Promise<BrowserWindow> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Obtaining browser instance',
    });
    const browser = await this.cordycepsService.getBrowser();
    progress.log('Browser instance obtained');
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Browser instance ready',
    });
    return browser;
  }

  async newPage(browser: BrowserWindow, progress: Progress): Promise<Page> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Creating new page',
    });
    const page = await browser.newPage({ progress });
    progress.log('New page created and main frame attached');
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Page created successfully',
    });
    return page;
  }

  async navigate(page: Page, progress: Progress): Promise<void> {
    const url = 'http://localhost:3005';
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: `Navigating to ${url}`,
      details: { url },
    });

    const navigationStart = Date.now();
    // Use commit for reliability (redirect-tolerant), then opportunistically wait for DOM readiness
    await page.goto(url, { progress, waitUntil: 'commit', timeout: 30000 });
    // Don't fail the test suite if DOMContentLoaded is slow; prefer resilience
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => void 0);
    const navigationDuration = Date.now() - navigationStart;

    progress.log('Navigation completed to local example server.');
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Navigation completed',
      details: {
        duration: navigationDuration,
        url,
      },
    });
  }
}
