import { Progress, executeWithProgress } from '../core/progress';
import { ClickOptions } from './types';

// #region Result Types and Error Handling

/**
 * Common result types used throughout the cordyceps framework
 */
export type OperationResult = 'done' | 'error:notconnected';

/**
 * Assert that an operation completed successfully
 */
export function assertDone(result: OperationResult): asserts result is 'done' {
  if (result !== 'done') {
    throw new Error(`Expected 'done', but got '${result}'`);
  }
}

/**
 * Throw error for retargetable DOM operations that fail due to disconnection
 */
export function throwRetargetableDOMError<T>(result: T | 'error:notconnected'): T {
  if (result === 'error:notconnected') {
    throwElementIsNotAttached();
  }
  return result;
}

/**
 * Throw standardized error for elements not attached to DOM
 */
export function throwElementIsNotAttached(): never {
  throw new Error('Element is not attached to the DOM');
}

/**
 * Handle operation result and throw error if not done
 */
export function handleOperationResult(result: OperationResult, operation: string): void {
  if (result !== 'done') {
    throw new Error(`${operation} failed: ${result}`);
  }
}

// #region Injected Script Helpers

/**
 * Get the cordyceps injected script from window
 */
export function getInjectedScript() {
  return window.__cordyceps_handledInjectedScript;
}

/**
 * Get element by handle from injected script
 */
export function getElementByHandle(handle: string): Element {
  const injected = getInjectedScript();
  const element = injected.getElementByHandle(handle);
  if (!element) {
    throw new Error('Element not found for handle');
  }
  return element;
}

/**
 * Common wrapper function to get element by handle for use in executeScript
 */
export function createElementGetter() {
  return (handle: string) => {
    const injected = window.__cordyceps_handledInjectedScript;
    const element = injected.getElementByHandle(handle);
    if (!element) {
      throw new Error('Element not found for handle');
    }
    return element;
  };
}

// #region Progress and Execution Wrappers

/**
 * Common pattern for executing operations with progress and error handling
 */
export async function executeOperationWithProgress(
  operation: (progress: Progress) => Promise<OperationResult>,
  operationName: string,
  options: { timeout?: number } = {}
): Promise<void> {
  return executeWithProgress(
    async progress => {
      const result = await operation(progress);
      handleOperationResult(result, operationName);
    },
    { timeout: options.timeout || 30000 }
  );
}

/**
 * Execute a function with element handle resolution and proper error handling
 */
export async function executeWithElementHandleOperation<T>(
  progress: Progress,
  handle: string,
  operation: (element: Element) => T
): Promise<T> {
  const element = getElementByHandle(handle);
  return operation(element);
}

// #region Common Click Patterns

export interface ClickResult {
  success: boolean;
  error?: string;
}

/**
 * Common pattern for click operations with options
 */
export function createClickHandler(
  clickWithOptions: (handle: string, options: ClickOptions) => Promise<ClickResult | null>,
  clickSimple: (handle: string) => Promise<ClickResult | null>
) {
  return async (
    progress: Progress,
    handle: string,
    options?: ClickOptions
  ): Promise<OperationResult> => {
    // Use enhanced click if options are provided
    if (options && (options.position || options.force || options.button || options.clickCount)) {
      const clickResult = await progress.race(
        clickWithOptions(handle, {
          position: options.position,
          force: options.force,
          button: options.button,
          clickCount: options.clickCount,
        })
      );

      if (!clickResult) {
        return 'error:notconnected';
      }

      if (!clickResult.success) {
        throw new Error(clickResult.error || 'Failed to click element');
      }

      // Handle delay if specified
      if (options.delay) {
        await progress.race(new Promise(resolve => setTimeout(resolve, options.delay)));
      }

      return 'done';
    }

    // Use simple click for basic cases
    const clickResult = await progress.race(clickSimple(handle));
    if (!clickResult) {
      return 'error:notconnected';
    }

    if (!clickResult.success) {
      throw new Error(clickResult.error || 'Failed to click element');
    }

    return 'done';
  };
}

// #region Frame and Element Handle Patterns

export interface ElementHandleLike {
  dispose?(): void;
}

export interface FrameLike {
  waitForSelector(
    progress: Progress,
    selector: string,
    performActionPreChecksAndLog: boolean,
    options: { strict: boolean }
  ): Promise<ElementHandleLike | null>;
}

/**
 * Common pattern for executing actions with element handle in frames
 */
export async function executeWithElementHandle<T>(
  frame: FrameLike,
  selector: string,
  timeout: number,
  action: (handle: ElementHandleLike, progress: Progress) => Promise<T>
): Promise<T> {
  return await executeWithProgress(
    async progress => {
      const handle = await frame.waitForSelector(progress, selector, false, { strict: true });
      if (!handle) {
        throw new Error(`Element not found for selector: ${selector}`);
      }
      try {
        return await action(handle, progress);
      } finally {
        if (handle.dispose) {
          handle.dispose();
        }
      }
    },
    { timeout }
  );
}

/**
 * Common pattern for element handle operations with task execution
 */
export async function withElementHandle<R>(
  getElement: () => Promise<ElementHandleLike | null>,
  task: (handle: ElementHandleLike, timeout?: number) => Promise<R>,
  options: { title: string; timeout?: number }
): Promise<R> {
  return executeWithProgress(
    async () => {
      const handle = await getElement();

      if (!handle) {
        throw new Error(`Element not found for operation: ${options.title}`);
      }

      try {
        return await task(handle, options.timeout);
      } finally {
        if (handle.dispose) {
          handle.dispose();
        }
      }
    },
    { timeout: options.timeout }
  );
}

// #region Evaluate Function Helpers

/**
 * Create a wrapper function for element evaluation (no arguments)
 */
export function createElementEvaluator() {
  return (handle: string) => {
    const injected = window.__cordyceps_handledInjectedScript;
    const element = injected.getElementByHandle(handle);
    if (!element) {
      throw new Error('Element not found for handle');
    }
    // Return tagName directly for basic testing
    return (element as Element).tagName;
  };
}

/**
 * Create a wrapper function for element evaluation with arguments
 */
export function createElementEvaluatorWithArg<Arg>() {
  return (handle: string, arg: Arg) => {
    const injected = window.__cordyceps_handledInjectedScript;
    const element = injected.getElementByHandle(handle);
    if (!element) {
      throw new Error('Element not found for handle');
    }
    // This is a basic implementation - would need to be customized per use case
    return { element: element.tagName, arg };
  };
}

// #region Selector and Query Helpers

/**
 * Common pattern for querySelector operations
 */
export function createQuerySelector() {
  return (selector: string, rootHandle: string | null) => {
    const injectedScript = window.__cordyceps_handledInjectedScript;
    const parsed = injectedScript.parseSelector(selector);
    const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
    if (!root) {
      throw new Error('Root element not found for handle');
    }
    return injectedScript.querySelector(parsed, root, false);
  };
}

/**
 * Common pattern for querySelectorAll operations
 */
export function createQuerySelectorAll() {
  return (selector: string, rootHandle: string | null) => {
    const injectedScript = window.__cordyceps_handledInjectedScript;
    const parsed = injectedScript.parseSelector(selector);
    const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
    if (!root) {
      return [];
    }
    return injectedScript.querySelectorAll(parsed, root);
  };
}

// #region Event Dispatch Helpers

/**
 * Common pattern for event dispatching
 */
export function createEventDispatcher() {
  return (handle: string, type: string, eventInit: Record<string, unknown>) => {
    const injected = window.__cordyceps_handledInjectedScript;
    const element = injected.getElementByHandle(handle);
    if (!element) {
      throw new Error('Element not found for handle');
    }
    // Return the dispatch result - implementation depends on injected script
    return injected.dispatchEvent(handle, type, eventInit);
  };
}

// #region Chrome Extension Helpers

/**
 * Common error handling for Chrome runtime errors
 */
export function handleChromeRuntimeError(operation: string): void {
  if (chrome.runtime.lastError) {
    throw new Error(`${operation}: ${chrome.runtime.lastError.message}`);
  }
}

/**
 * Create Chrome scripting injection configuration
 */
export function createScriptInjectionConfig(
  tabId: number,
  frameId: number,
  world: chrome.scripting.ExecutionWorld
) {
  return {
    target: {
      tabId,
      frameIds: [frameId],
    },
    world,
  };
}

// #region Type Guards and Validators

/**
 * Check if result is an error
 */
export function isErrorResult(result: unknown): result is 'error:notconnected' {
  return result === 'error:notconnected';
}

/**
 * Check if result is successful
 */
export function isSuccessResult(result: unknown): result is 'done' {
  return result === 'done';
}

// #region Timeout and Retry Helpers

/**
 * Default timeout values used across the framework
 */
export const DEFAULT_TIMEOUTS = [0, 20, 50, 100, 100, 500] as const;

/**
 * Standard timeout for operations
 */
export const STANDARD_TIMEOUT = 30000;

/**
 * Create retry configuration
 */
export function createRetryConfig(timeouts: readonly number[] = DEFAULT_TIMEOUTS) {
  return { timeouts };
}

// #region URL Utilities

/**
 * Parse a URL string safely, returning null if invalid
 * Used for extracting URL components like origin, pathname, etc.
 */
export function parseURL(url: string): URL | null {
  try {
    return new URL(url);
  } catch (e) {
    return null;
  }
}

// #endregion

// #region Waiting and Condition Utilities

/**
 * Wait for a condition with race condition handling and progress support.
 * This is a general-purpose utility for waiting with proper abort support.
 *
 * @param progress Progress controller for abort handling
 * @param condition Function that returns true when condition is met
 * @param options Waiting options
 * @returns Promise that resolves when condition is met
 */
export async function waitForCondition(
  progress: Progress,
  condition: () => boolean | Promise<boolean>,
  options: {
    pollInterval?: number;
    timeout?: number;
    description?: string;
  } = {}
): Promise<void> {
  const { pollInterval = 100, timeout = 30000, description = 'condition' } = options;

  console.log(
    `[waitForCondition] Starting wait for ${description} pollInterval:${pollInterval}ms timeout:${timeout}ms ######`
  );
  progress.log(`Waiting for ${description} (polling: ${pollInterval}ms, timeout: ${timeout}ms)`);

  const conditionPromise = new Promise<void>((resolve, reject) => {
    let pollId: ReturnType<typeof setTimeout> | undefined;
    let pollCount = 0;

    const checkCondition = async () => {
      pollCount++;
      try {
        console.log(`[waitForCondition] ${description} check #${pollCount} ######`);
        const result = await condition();
        if (result) {
          console.log(
            `[waitForCondition] ${description} condition met after ${pollCount} polls ######`
          );
          progress.log(`${description} met`);
          if (pollId) {
            clearTimeout(pollId);
          }
          resolve();
          return;
        }
        console.log(
          `[waitForCondition] ${description} condition not met, scheduling next check ######`
        );
      } catch (error) {
        console.log(
          `[waitForCondition] ${description} error on check #${pollCount}: ${error} ######`
        );
        progress.log(`Error checking ${description}: ${error}`);
        if (pollId) {
          clearTimeout(pollId);
        }
        reject(error);
        return;
      }

      // Schedule next check
      pollId = setTimeout(checkCondition, pollInterval);
    };

    // Set up cleanup
    progress.cleanupWhenAborted(() => {
      console.log(`[waitForCondition] ${description} cleanup on progress abort ######`);
      if (pollId) {
        clearTimeout(pollId);
      }
    });

    // Start checking
    console.log(`[waitForCondition] ${description} starting initial condition check ######`);
    checkCondition();
  });

  // Helper to add timeout to a promise with proper cleanup
  const withTimeout = <T>(
    promise: Promise<T>,
    timeoutMs: number,
    onCancel: () => void,
    label: string
  ): Promise<T> => {
    let isComplete = false;

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (isComplete) return;
        isComplete = true;
        console.log(
          `[waitForCondition.withTimeout] ${label} timeout triggered after ${timeoutMs}ms ######`
        );
        onCancel();
        reject(new Error(`${label} timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(value => {
          if (isComplete) return;
          isComplete = true;
          clearTimeout(timeoutId);
          resolve(value);
        })
        .catch(error => {
          if (isComplete) return;
          isComplete = true;
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  };

  // Use withTimeout helper to avoid Promise resolve reassignment bugs
  const timeoutPromise = withTimeout(
    conditionPromise,
    timeout,
    () => {
      // Cleanup is handled by the conditionPromise itself
    },
    description
  );

  // Race against progress abort signal
  return progress.race(timeoutPromise);
}

// #endregion
