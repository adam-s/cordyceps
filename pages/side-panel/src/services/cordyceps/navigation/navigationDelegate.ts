import { executeHistoryBack, executeHistoryForward } from '../utilities/frameUtils';

/**
 * Handles back/forward navigation actions for Chrome extension context.
 * Prefers chrome.tabs API when available, falls back to history API.
 * Uses proper function execution following frameExecutionContext patterns.
 */
export class NavigationDelegate {
  constructor(private readonly _tabId: number) {}

  /**
   * Navigate back in history, mimicking Playwright's goBack behavior.
   * @returns true if navigation was attempted, false if no history available
   */
  async goBack(): Promise<boolean> {
    try {
      // Use chrome.tabs.goBack API
      await chrome.tabs.goBack(this._tabId);
      return true;
    } catch (error) {
      // Chrome tabs API might fail if no browser-level history available
      // This is expected behavior - fallback to history.back() for document-level history

      // Fallback to history.back() via script injection
      const result = executeHistoryBack(this._tabId);
      return result;
    }
  }

  /**
   * Navigate forward in history, mimicking Playwright's goForward behavior.
   * @returns true if navigation was attempted, false if no forward history available
   */
  async goForward(): Promise<boolean> {
    try {
      // Use chrome.tabs.goForward API
      await chrome.tabs.goForward(this._tabId);
      return true;
    } catch (error) {
      // Fallback to history.forward() via script injection
      const result = executeHistoryForward(this._tabId);
      return result;
    }
  }
}
