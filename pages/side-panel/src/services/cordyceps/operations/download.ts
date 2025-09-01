/**
 * Chrome Extension Download API - Playwright-compatible
 * Provides the same API surface as Playwright's Download class
 */

import { Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import type { Page } from '../page';

/**
 * Chrome Extension Download class providing Playwright-compatible API
 * This class wraps Chrome's download functionality to match Playwright's interface
 */
export class Download extends Disposable {
  private readonly _id: number;
  private readonly _url: string;
  private readonly _page: Page;
  private readonly _suggestedFilename: string;
  private _state: 'in_progress' | 'interrupted' | 'complete' = 'in_progress';
  private _failure: string | null = null;
  private _localPath: string | null = null;
  private readonly _startTime: number;

  // Event emitters for download lifecycle
  private readonly _onFinished = this._register(new Emitter<void>());
  private readonly _onFailed = this._register(new Emitter<string>());

  public readonly onFinished: Event<void> = this._onFinished.event;
  public readonly onFailed: Event<string> = this._onFailed.event;

  constructor(page: Page, downloadId: number, url: string, suggestedFilename: string) {
    super();
    this._id = downloadId;
    this._url = url;
    this._page = page;
    this._suggestedFilename = suggestedFilename;
    this._startTime = Date.now();

    // Listen for download state changes
    this._setupDownloadListeners();
  }

  private _setupDownloadListeners(): void {
    const changeListener = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id === this._id) {
        if (delta.state?.current === 'complete') {
          this._state = 'complete';
          this._onFinished.fire();
        } else if (delta.state?.current === 'interrupted') {
          this._state = 'interrupted';
          this._failure = delta.error?.current || 'Unknown error';
          this._onFailed.fire(this._failure);
        }
      }
    };

    chrome.downloads.onChanged.addListener(changeListener);

    // Clean up listener when disposed
    this._register({
      dispose: () => {
        chrome.downloads.onChanged.removeListener(changeListener);
      },
    });
  }

  /**
   * Get the page that the download belongs to
   * @returns The page that initiated the download
   */
  page(): Page {
    return this._page;
  }

  /**
   * Returns downloaded url
   * @returns The URL of the downloaded file
   */
  url(): string {
    return this._url;
  }

  /**
   * Returns suggested filename for this download
   * @returns The suggested filename
   */
  suggestedFilename(): string {
    return this._suggestedFilename;
  }

  /**
   * Returns path to the downloaded file for a successful download
   * Note: In Chrome extension environment, this returns the default download path
   * @returns Promise that resolves to the file path
   */
  async path(): Promise<string> {
    await this._waitForCompletion();

    if (this._state === 'interrupted') {
      throw new Error(`Download failed: ${this._failure}`);
    }

    // Get the actual download info from Chrome
    const downloads = await chrome.downloads.search({ id: this._id });
    if (downloads.length === 0) {
      throw new Error('Download not found');
    }

    return downloads[0].filename;
  }

  /**
   * Copy the download to a user-specified path
   * Note: In Chrome extension environment, this tracks the save location but
   * cannot directly move files due to security restrictions
   * @param path Path where the download should be copied
   */
  async saveAs(path: string): Promise<void> {
    await this._waitForCompletion();

    if (this._state === 'interrupted') {
      throw new Error(`Cannot save interrupted download: ${this._failure}`);
    }

    // Store the intended save path for tracking
    await chrome.storage.local.set({
      [`download_${this._id}_savePath`]: path,
      [`download_${this._id}_timestamp`]: new Date().toISOString(),
    });

    console.log(`📁 Download ${this._id} marked for save to: ${path}`);
    console.log(
      'Note: Actual file copy must be handled by user due to Chrome extension security restrictions'
    );
  }

  /**
   * Returns download error if any
   * @returns Promise that resolves to error message or null
   */
  async failure(): Promise<string | null> {
    await this._waitForCompletion();
    return this._failure;
  }

  /**
   * Cancels a download
   * @returns Promise that resolves when cancellation is complete
   */
  async cancel(): Promise<void> {
    try {
      await chrome.downloads.cancel(this._id);
    } catch (error) {
      // Download might already be finished or canceled
      console.warn(`Failed to cancel download ${this._id}:`, error);
    }
  }

  /**
   * Deletes the downloaded file
   * Note: In Chrome extension environment, this removes from download history
   * @returns Promise that resolves when deletion is complete
   */
  async delete(): Promise<void> {
    try {
      await chrome.downloads.erase({ id: this._id });
      // Clean up our tracking data
      await chrome.storage.local.remove([
        `download_${this._id}_savePath`,
        `download_${this._id}_timestamp`,
      ]);
    } catch (error) {
      console.warn(`Failed to delete download ${this._id}:`, error);
      throw new Error(`Failed to delete download: ${error}`);
    }
  }

  /**
   * Creates a readable stream for the download
   * Note: Chrome extensions cannot create Node.js streams, so this is not supported
   * @throws Always throws as this is not supported in Chrome extension environment
   */
  async createReadStream(): Promise<never> {
    throw new Error(
      'createReadStream is not supported in Chrome extension environment. Use chrome.downloads API directly for file access.'
    );
  }

  /**
   * Chrome Extension specific: Show download in system file manager
   * @returns Promise that resolves when file manager is opened
   */
  async show(): Promise<void> {
    try {
      await chrome.downloads.show(this._id);
    } catch (error) {
      throw new Error(`Failed to show download: ${error}`);
    }
  }

  /**
   * Chrome Extension specific: Open the downloaded file
   * @returns Promise that resolves when file is opened
   */
  async open(): Promise<void> {
    await this._waitForCompletion();

    if (this._state !== 'complete') {
      throw new Error('Cannot open incomplete download');
    }

    try {
      await chrome.downloads.open(this._id);
    } catch (error) {
      throw new Error(`Failed to open download: ${error}`);
    }
  }

  /**
   * Get download progress information
   * @returns Promise that resolves to download progress
   */
  async getProgress(): Promise<{
    state: 'in_progress' | 'interrupted' | 'complete';
    totalBytes?: number;
    receivedBytes?: number;
    startTime: number;
  }> {
    const downloads = await chrome.downloads.search({ id: this._id });
    if (downloads.length === 0) {
      throw new Error('Download not found');
    }

    const download = downloads[0];
    return {
      state: download.state as 'in_progress' | 'interrupted' | 'complete',
      totalBytes: download.totalBytes,
      receivedBytes: download.bytesReceived,
      startTime: this._startTime,
    };
  }

  /**
   * Wait for the download to complete or fail
   * @returns Promise that resolves when download finishes
   */
  private async _waitForCompletion(): Promise<void> {
    if (this._state === 'complete' || this._state === 'interrupted') {
      return;
    }

    return new Promise((resolve, reject) => {
      const finishedDisposable = this.onFinished(() => {
        finishedDisposable.dispose();
        failedDisposable.dispose();
        resolve();
      });

      const failedDisposable = this.onFailed(() => {
        finishedDisposable.dispose();
        failedDisposable.dispose();
        resolve(); // Don't reject here, let calling methods handle failure state
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        finishedDisposable.dispose();
        failedDisposable.dispose();
        reject(new Error('Download timeout after 30 seconds'));
      }, 30000);
    });
  }

  /**
   * Get the Chrome download ID for advanced operations
   * @returns The internal Chrome download ID
   */
  get chromeDownloadId(): number {
    return this._id;
  }

  dispose(): void {
    super.dispose();
  }
}
