import type { BrowserWindow } from '../../cordyceps/browserWindow';
import type { Page as CordycepsPage } from '../../cordyceps/page';
import { z } from 'zod/v3';
import type {
  ActOptions,
  ActResult,
  ExtractOptions,
  ExtractResult,
  ObserveOptions,
  ObserveResult,
} from './stagehand';

export const defaultExtractSchema = z.object({
  extraction: z.string(),
});

export const pageTextSchema = z.object({
  page_text: z.string(),
});

export interface Page
  extends Omit<
    CordycepsPage,
    | 'onFrameAttached'
    | 'onFrameDetached'
    | 'onInternalFrameNavigatedToNewDocument'
    | 'onDomContentLoaded'
    | 'onLoad'
    | 'onDownload'
    | 'onClose'
  > {
  act(action: string): Promise<ActResult>;
  act(options: ActOptions): Promise<ActResult>;
  act(observation: ObserveResult): Promise<ActResult>;

  extract(instruction: string): Promise<ExtractResult<typeof defaultExtractSchema>>;
  extract<T extends z.AnyZodObject>(options: ExtractOptions<T>): Promise<ExtractResult<T>>;
  extract(): Promise<ExtractResult<typeof pageTextSchema>>;

  observe(): Promise<ObserveResult[]>;
  observe(instruction: string): Promise<ObserveResult[]>;
  observe(options?: ObserveOptions): Promise<ObserveResult[]>;

  // Custom event handling for popup events (Stagehand-specific)
  on: {
    (event: 'popup', listener: (page: Page) => unknown): Page;
  };
}

// BrowserContext in Cordyceps is handled by BrowserWindow
export type BrowserContext = BrowserWindow;

// Browser functionality is provided by BrowserWindow in the Chrome extension context
export type Browser = BrowserWindow;
