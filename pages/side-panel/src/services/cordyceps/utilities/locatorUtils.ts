import { TIMEOUTS } from './constants';
import { Progress, executeWithProgress } from '../core/progress';
import { OperationResult, STANDARD_TIMEOUT } from './utils';
import { Frame } from '../frame';
import { ElementHandle } from '../elementHandle';
import { LocatorOptions } from '../locator';
import { escapeForTextSelector } from '@injected/isomorphic/stringUtils';

export async function executeProgressElementOperation(
  selector: string,
  frame: Frame,
  operation: (handle: ElementHandle, progress: Progress) => Promise<OperationResult>,
  operationName: string,
  timeout?: number,
): Promise<void> {
  return executeWithProgress(
    async progress => {
      const handle = await frame.waitForSelector(progress, selector, false, {
        strict: true,
      });

      if (!handle) {
        throw new Error(`Element not found for selector: ${selector}`);
      }

      try {
        const result = await operation(handle, progress);
        if (result !== 'done') {
          throw new Error(`${operationName} failed: ${result}`);
        }
      } finally {
        handle.dispose();
      }
    },
    { timeout: timeout || STANDARD_TIMEOUT },
  );
}

export function buildSelectorWithOptions(
  baseSelector: string,
  options: LocatorOptions,
  frame: Frame,
): string {
  let selector = baseSelector;

  if (options.hasText) {
    selector += ` >> internal:has-text=${escapeForTextSelector(options.hasText, false)}`;
  }

  if (options.hasNotText) {
    selector += ` >> internal:has-not-text=${escapeForTextSelector(options.hasNotText, false)}`;
  }

  if (options.has) {
    const locator = options.has;
    if (locator._frame !== frame) {
      throw new Error(`Inner "has" locator must belong to the same frame.`);
    }
    selector += ` >> internal:has=` + JSON.stringify(locator._selector);
  }

  if (options.hasNot) {
    const locator = options.hasNot;
    if (locator._frame !== frame) {
      throw new Error(`Inner "hasNot" locator must belong to the same frame.`);
    }
    selector += ` >> internal:has-not=` + JSON.stringify(locator._selector);
  }

  if (options.visible !== undefined) {
    selector += ` >> visible=${options.visible ? 'true' : 'false'}`;
  }

  return selector;
}

export function createChainedSelector(baseSelector: string, chainSelector: string): string {
  return baseSelector + ' >> ' + chainSelector;
}

export function createInternalChainSelector(baseSelector: string, chainSelector: string): string {
  return baseSelector + ' >> internal:chain=' + JSON.stringify(chainSelector);
}

export function createNthSelector(baseSelector: string, index: number): string {
  return baseSelector + ` >> nth=${index}`;
}

export function createFirstSelector(baseSelector: string): string {
  return createNthSelector(baseSelector, 0);
}

export function createLastSelector(baseSelector: string): string {
  return createNthSelector(baseSelector, -1);
}

export function createAndSelector(baseSelector: string, andSelector: string): string {
  return baseSelector + ` >> internal:and=` + JSON.stringify(andSelector);
}

export function createOrSelector(baseSelector: string, orSelector: string): string {
  return baseSelector + ` >> internal:or=` + JSON.stringify(orSelector);
}

export function createVisibleSelector(baseSelector: string, visible: boolean): string {
  return baseSelector + ` >> visible=${visible ? 'true' : 'false'}`;
}

export function validateSameFrame(frame1: Frame, frame2: Frame, operation: string): void {
  if (frame1 !== frame2) {
    throw new Error(`${operation} requires locators to belong to the same frame.`);
  }
}

export function createElementNotFoundError(selector: string): Error {
  return new Error(`Element not found for selector: ${selector}`);
}

export function createOperationFailedError(operationName: string, result: string): Error {
  return new Error(`${operationName} failed: ${result}`);
}

export function isLocatorEqual(
  locator1: { _frame: Frame; _selector: string },
  locator2: { _frame: Frame; _selector: string },
): boolean {
  return locator1._frame === locator2._frame && locator1._selector === locator2._selector;
}

export function createFrameLocatorSelector(baseSelector: string, frameSelector: string): string {
  return baseSelector + ' >> ' + frameSelector;
}

export function createDragAndDropFrameError(): Error {
  return new Error('Drag and drop between different frames is not supported');
}

export function createDifferentFrameError(operation: string = 'operation'): Error {
  return new Error(`${operation} requires locators to belong to the same frame.`);
}

export type LocatorSelector = {
  base: string;
  options?: LocatorOptions;
};

export function createSelector(base: string, options?: LocatorOptions, frame?: Frame): string {
  if (!options) {
    return base;
  }

  if (!frame) {
    throw new Error('Frame is required when options are provided');
  }

  return buildSelectorWithOptions(base, options, frame);
}

export function joinSelectors(baseSelector: string, ...additionalSelectors: string[]): string {
  return [baseSelector, ...additionalSelectors].join(' >> ');
}

// #region Locator Constants and Pure Functions

/**
 * Default timeout for locator operations in milliseconds
 */
export const DEFAULT_LOCATOR_TIMEOUT = TIMEOUTS.DEFAULT_OPERATION;

/**
 * Resolves timeout value with fallback to default
 * @param timeout User-provided timeout or undefined
 * @param defaultTimeout Default timeout to use if none provided
 * @returns Resolved timeout value
 */
export function resolveTimeout(
  timeout?: number,
  defaultTimeout: number = DEFAULT_LOCATOR_TIMEOUT,
): number {
  return timeout ?? defaultTimeout;
}

/**
 * Creates a standardized element not found error message for locators
 * @param selector The CSS selector that wasn't found
 * @returns A formatted error message
 */
export function createLocatorElementNotFoundError(selector: string): string {
  return `Element not found for selector: ${selector}`;
}

/**
 * Creates a standardized error for operations that require elements to be on the same frame
 * @param operation The operation name that failed
 * @returns A formatted error message
 */
export function createSameFrameRequiredError(operation: string): string {
  return `${operation} requires locators to belong to the same frame.`;
}

/**
 * Creates an error for unsupported operations
 * @param operation The operation name
 * @param reason The reason why it's not supported
 * @returns A formatted error message
 */
export function createUnsupportedOperationError(operation: string, reason: string): string {
  return `${operation} is not supported: ${reason}`;
}

/**
 * Validates that a locator operation timeout is reasonable
 * @param timeout The timeout to validate
 * @param maxTimeout Maximum allowed timeout (default: 5 minutes)
 * @returns True if valid, throws if invalid
 */
export function validateTimeout(
  timeout?: number,
  maxTimeout: number = TIMEOUTS.MAX_TIMEOUT,
): boolean {
  if (timeout !== undefined && (timeout < 0 || timeout > maxTimeout)) {
    throw new Error(`Timeout must be between 0 and ${maxTimeout}ms, got ${timeout}ms`);
  }
  return true;
}

/**
 * Executes an element method with proper error handling and timeout
 * This is a reusable pattern for locator element operations
 */
export async function executeElementMethodWithProgress<T>(
  frame: Frame,
  selector: string,
  methodName: string,
  args: unknown[],
  timeout?: number,
): Promise<T> {
  const resolvedTimeout = resolveTimeout(timeout);
  validateTimeout(resolvedTimeout);

  return executeWithProgress(
    async progress => {
      // Use 'attached' state instead of default 'visible' so we can operate on hidden elements
      const handle = await frame.waitForSelector(progress, selector, false, {
        strict: true,
        state: 'attached',
      });

      if (!handle) {
        throw new Error(createLocatorElementNotFoundError(selector));
      }

      try {
        const method = handle[methodName as keyof ElementHandle] as (
          ...args: unknown[]
        ) => Promise<T>;
        const result = await method.apply(handle, args);
        return result;
      } finally {
        handle.dispose();
      }
    },
    { timeout: resolvedTimeout },
  );
}

/**
 * Executes an operation with an element handle, handling lifecycle properly
 * This is a reusable pattern for locator operations that need access to the element
 */
export async function executeWithElementHandle<R>(
  frame: Frame,
  selector: string,
  task: (handle: ElementHandle) => Promise<R>,
  options: { title: string; timeout?: number; state?: 'attached' | 'visible' },
): Promise<R> {
  const resolvedTimeout = resolveTimeout(options.timeout);
  const state = options.state ?? 'attached';

  return executeWithProgress(
    async progress => {
      const handle = await frame.waitForSelector(progress, selector, false, {
        strict: true,
        state,
      });

      if (!handle) {
        throw new Error(createLocatorElementNotFoundError(selector));
      }

      try {
        return await task(handle);
      } finally {
        handle.dispose();
      }
    },
    { timeout: resolvedTimeout },
  );
}

// #endregion
