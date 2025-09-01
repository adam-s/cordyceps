/**
 * Cordyceps Download Manager
 * Chrome Extension download handling with Playwright-like API
 */

import { Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { Download } from './download';
import type { Page } from '../page';

export interface DownloadInfo {
  id: number;
  url: string;
  filename: string;
  suggestedFilename: string;
  state: 'in_progress' | 'interrupted' | 'complete';
  totalBytes?: number;
  receivedBytes?: number;
  danger?: string;
  interruptReason?: string;
  tabId?: number;
}

export interface DownloadEventData {
  download: Download; // Use our Download class instead of DownloadInfo
  page?: Page;
}

/**
 * Download manager providing Playwright-like download API for Chrome extensions
 * Singleton pattern ensures consistent download tracking across the application
 */
export class DownloadManager extends Disposable {
  private static instance: DownloadManager;

  // Event emitters for download events
  private readonly _onDownloadStarted = this._register(new Emitter<DownloadEventData>());
  private readonly _onDownloadCompleted = this._register(new Emitter<DownloadEventData>());
  private readonly _onDownloadFailed = this._register(new Emitter<DownloadEventData>());

  public readonly onDownloadStarted: Event<DownloadEventData> = this._onDownloadStarted.event;
  public readonly onDownloadCompleted: Event<DownloadEventData> = this._onDownloadCompleted.event;
  public readonly onDownloadFailed: Event<DownloadEventData> = this._onDownloadFailed.event;

  // Internal tracking
  private readonly _downloadListeners = new Map<number, (download: Download) => void>();
  private readonly _downloadTimeouts = new Map<number, NodeJS.Timeout>();
  private readonly _tabToDownloadMap = new Map<number, number>();
  private readonly _pageRegistry = new Map<number, Page>();
  private readonly _downloads = new Map<number, Download>(); // Track active downloads
  private _lastActivePage: Page | undefined; // Track the most recently active page

  private constructor() {
    super();
    this._setupChromeDownloadListeners();
  }

  static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  /**
   * Register a page with the download manager for download tracking
   * Also tracks the tab ID for better download association
   */
  registerPage(page: Page): void {
    this._pageRegistry.set(page.tabId, page);
    this._lastActivePage = page; // Update the most recently active page

    // Track tab changes to update active page
    if (page.tabId) {
      this._updateActiveTab(page.tabId);
    }
  }

  /**
   * Update the currently active tab for download association
   */
  private _updateActiveTab(tabId: number): void {
    this._lastActivePage = this._pageRegistry.get(tabId);
  }

  /**
   * Unregister a page from download tracking
   */
  unregisterPage(page: Page): void {
    this._pageRegistry.delete(page.tabId);
    this._downloadListeners.delete(page.tabId);

    const timeout = this._downloadTimeouts.get(page.tabId);
    if (timeout) {
      clearTimeout(timeout);
      this._downloadTimeouts.delete(page.tabId);
    }
  }

  private _setupChromeDownloadListeners(): void {
    // Listen for download creation
    chrome.downloads.onCreated.addListener((downloadItem: chrome.downloads.DownloadItem) => {
      const downloadInfo: DownloadInfo = {
        id: downloadItem.id,
        url: downloadItem.url,
        filename: downloadItem.filename,
        suggestedFilename: this._extractFilenameFromUrl(downloadItem.url),
        state: downloadItem.state as 'in_progress' | 'interrupted' | 'complete',
        totalBytes: downloadItem.totalBytes,
        receivedBytes: downloadItem.bytesReceived,
        danger: downloadItem.danger,
        interruptReason: downloadItem.error,
      };

      this._handleDownloadCreated(downloadInfo);
    });

    // Listen for download state changes
    chrome.downloads.onChanged.addListener((delta: chrome.downloads.DownloadDelta) => {
      this._handleDownloadChanged(delta);
    });

    // Listen for filename determination
    chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
      // Use default behavior for now
      suggest();
    });

    // Listen for download erasure
    chrome.downloads.onErased.addListener((downloadId: number) => {
      this._cleanupDownloadTracking(downloadId);
    });
  }

  private _handleDownloadCreated(downloadInfo: DownloadInfo): void {
    // Find the page that might be associated with this download
    const page = this._findAssociatedPage();

    if (page) {
      downloadInfo.tabId = page.tabId;
      this._tabToDownloadMap.set(page.tabId, downloadInfo.id);
    }

    // Create Download instance - use the page or a default page
    const targetPage = page || this._getDefaultPage();
    if (!targetPage) {
      console.warn('No page available for download, cannot create Download instance');
      return;
    }

    const download = this._register(
      new Download(targetPage, downloadInfo.id, downloadInfo.url, downloadInfo.suggestedFilename)
    );

    // Store the download instance
    this._downloads.set(downloadInfo.id, download);

    // Add a small delay to ensure waitForEvent is set up before firing
    setTimeout(() => {
      this._onDownloadStarted.fire({ download, page: targetPage });
    }, 10); // Small delay to ensure event listeners are ready

    // Notify any waiting listeners
    const listeners = Array.from(this._downloadListeners.entries());
    if (listeners.length > 0) {
      const [tabId, listener] = listeners[0];
      listener(download);
      this._downloadListeners.delete(tabId);

      // Clear timeout
      const timeout = this._downloadTimeouts.get(tabId);
      if (timeout) {
        clearTimeout(timeout);
        this._downloadTimeouts.delete(tabId);
      }
    }
  }

  private _getDefaultPage(): Page | undefined {
    const pages = Array.from(this._pageRegistry.values());
    return pages.length > 0 ? pages[0] : undefined;
  }

  private _handleDownloadChanged(delta: chrome.downloads.DownloadDelta): void {
    if (delta.state?.current === 'complete') {
      const download = this._downloads.get(delta.id);
      if (download) {
        const page = this._pageRegistry.get(download.page().tabId);
        this._onDownloadCompleted.fire({ download, page });
      }
    } else if (delta.state?.current === 'interrupted') {
      const download = this._downloads.get(delta.id);
      if (download) {
        const page = this._pageRegistry.get(download.page().tabId);
        this._onDownloadFailed.fire({ download, page });
      }
    }
  }

  private _findAssociatedPage(): Page | undefined {
    // Return the most recently active page
    if (this._lastActivePage) {
      return this._lastActivePage;
    }

    // Fallback to any registered page
    const pages = Array.from(this._pageRegistry.values());
    const fallbackPage = pages.length > 0 ? pages[pages.length - 1] : undefined;
    return fallbackPage;
  }

  private _cleanupDownloadTracking(downloadId: number): void {
    // Remove from storage
    chrome.storage.local.remove(`download_${downloadId}`).catch(console.warn);

    // Remove from internal tracking maps
    for (const [tabId, trackedDownloadId] of this._tabToDownloadMap.entries()) {
      if (trackedDownloadId === downloadId) {
        this._tabToDownloadMap.delete(tabId);
        break;
      }
    }
  }

  private _extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      return filename || 'download';
    } catch {
      return 'download';
    }
  }

  /**
   * Wait for a download to be triggered - Playwright-like API
   * @param page The page to wait for downloads on
   * @param timeout Timeout in milliseconds
   * @returns Promise that resolves with download info
   */
  async waitForDownload(page: Page, timeout: number = 5000): Promise<Download> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this._downloadListeners.delete(page.tabId);
        reject(new Error(`Download timeout after ${timeout}ms`));
      }, timeout);

      this._downloadTimeouts.set(page.tabId, timeoutHandle);
      this._downloadListeners.set(page.tabId, download => {
        clearTimeout(timeoutHandle);
        resolve(download);
      });
    });
  }

  /**
   * Get download state using Chrome downloads API
   */
  async _getDownloadInfo(downloadId: number): Promise<DownloadInfo | null> {
    try {
      const downloads = await chrome.downloads.search({ id: downloadId });
      if (downloads.length === 0) {
        return null;
      }

      const downloadItem = downloads[0];
      return {
        id: downloadItem.id,
        url: downloadItem.url,
        filename: downloadItem.filename,
        suggestedFilename: this._extractFilenameFromUrl(downloadItem.url),
        state: downloadItem.state as 'in_progress' | 'interrupted' | 'complete',
        totalBytes: downloadItem.totalBytes,
        receivedBytes: downloadItem.bytesReceived,
        danger: downloadItem.danger,
        interruptReason: downloadItem.error,
      };
    } catch (error) {
      console.error('Failed to get download state:', error);
      return null;
    }
  }

  /**
   * Generate unique filename to avoid conflicts
   */
  async getUniqueFilename(basePath: string, suggestedFilename: string): Promise<string> {
    const storageKey = `used_filenames_${basePath}`;

    try {
      const result = await chrome.storage.local.get(storageKey);
      const usedFilenames: Set<string> = new Set(result[storageKey] || []);

      if (!usedFilenames.has(suggestedFilename)) {
        usedFilenames.add(suggestedFilename);
        await chrome.storage.local.set({
          [storageKey]: Array.from(usedFilenames),
        });
        return suggestedFilename;
      }

      // Generate unique filename with number suffix
      const lastDotIndex = suggestedFilename.lastIndexOf('.');
      const basename =
        lastDotIndex > 0 ? suggestedFilename.substring(0, lastDotIndex) : suggestedFilename;
      const extension = lastDotIndex > 0 ? suggestedFilename.substring(lastDotIndex) : '';

      let counter = 1;
      let uniqueFilename: string;

      do {
        uniqueFilename = `${basename}_${counter}${extension}`;
        counter++;
      } while (usedFilenames.has(uniqueFilename));

      usedFilenames.add(uniqueFilename);
      await chrome.storage.local.set({
        [storageKey]: Array.from(usedFilenames),
      });

      return uniqueFilename;
    } catch (error) {
      console.warn('Failed to generate unique filename:', error);
      const timestamp = new Date().getTime();
      const lastDotIndex = suggestedFilename.lastIndexOf('.');
      const basename =
        lastDotIndex > 0 ? suggestedFilename.substring(0, lastDotIndex) : suggestedFilename;
      const extension = lastDotIndex > 0 ? suggestedFilename.substring(lastDotIndex) : '';
      return `${basename}_${timestamp}${extension}`;
    }
  }

  /**
   * Download a file using chrome.downloads API
   */
  async downloadFile(url: string, filename: string, saveToPath?: string): Promise<number> {
    try {
      const downloadOptions: chrome.downloads.DownloadOptions = {
        url: url,
        filename: saveToPath ? `${saveToPath}/${filename}` : filename,
        saveAs: false,
      };

      return new Promise((resolve, reject) => {
        chrome.downloads.download(downloadOptions, downloadId => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(downloadId);
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  /**
   * Wait for a download to complete
   */
  async waitForDownloadComplete(downloadId: number, timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        chrome.downloads.onChanged.removeListener(changeListener);
        reject(new Error(`Download completion timeout after ${timeout}ms`));
      }, timeout);

      const changeListener = (delta: chrome.downloads.DownloadDelta) => {
        if (delta.id === downloadId) {
          if (delta.state?.current === 'complete') {
            clearTimeout(timeoutHandle);
            chrome.downloads.onChanged.removeListener(changeListener);
            resolve();
          } else if (delta.state?.current === 'interrupted') {
            clearTimeout(timeoutHandle);
            chrome.downloads.onChanged.removeListener(changeListener);
            reject(new Error('Download was interrupted'));
          }
        }
      };

      chrome.downloads.onChanged.addListener(changeListener);
    });
  }

  /**
   * Check if a download is safe (not dangerous)
   */
  isDownloadSafe(downloadInfo: DownloadInfo): boolean {
    const safeDangerTypes = ['safe', 'accepted', 'allowlistedByPolicy', 'deepScannedSafe'];
    return !downloadInfo.danger || safeDangerTypes.includes(downloadInfo.danger);
  }

  /**
   * Show download in system file manager
   */
  async showDownload(downloadId: number): Promise<void> {
    try {
      await chrome.downloads.show(downloadId);
    } catch (error) {
      console.error('Failed to show download:', error);
    }
  }

  /**
   * Open downloaded file (if safe and complete)
   */
  async openDownload(downloadId: number): Promise<void> {
    try {
      const downloadInfo = await this._getDownloadInfo(downloadId);
      if (!downloadInfo) {
        throw new Error('Download not found');
      }

      if (downloadInfo.state !== 'complete') {
        throw new Error('Download is not complete');
      }

      if (!this.isDownloadSafe(downloadInfo)) {
        throw new Error('Download is marked as dangerous');
      }

      await chrome.downloads.open(downloadId);
    } catch (error) {
      console.error('Failed to open download:', error);
      throw error;
    }
  }

  /**
   * Cancel an in-progress download
   */
  async cancelDownload(downloadId: number): Promise<void> {
    try {
      await chrome.downloads.cancel(downloadId);
    } catch (error) {
      console.error('Failed to cancel download:', error);
      throw error;
    }
  }

  /**
   * Remove download from Chrome's download history
   */
  async removeDownload(downloadId: number): Promise<void> {
    try {
      await chrome.downloads.erase({ id: downloadId });
      this._cleanupDownloadTracking(downloadId);
    } catch (error) {
      console.error('Failed to remove download:', error);
      throw error;
    }
  }

  dispose(): void {
    this._downloadListeners.clear();

    // Clear all timeouts
    for (const timeout of this._downloadTimeouts.values()) {
      clearTimeout(timeout);
    }
    this._downloadTimeouts.clear();

    this._tabToDownloadMap.clear();
    this._pageRegistry.clear();

    super.dispose();
  }
}
