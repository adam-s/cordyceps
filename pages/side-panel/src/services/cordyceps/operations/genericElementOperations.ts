/**
 * Generic element operation system for Chrome extension
 * Domain-agnostic, type-safe function execution on DOM elements
 */

// Generic operation result type
export type ElementOperationResult<T = unknown> =
  | { success: true; result: T }
  | { success: false; error: string };

// Generic function registry entry
export interface ElementFunctionEntry {
  readonly name: string;
  readonly fn: (element: Element, args: unknown) => unknown | Promise<unknown>;
  readonly description?: string;
}

// Generic element operation request
export interface ElementOperationRequest<TArgs = unknown> {
  readonly functionName: string;
  readonly args?: TArgs;
  readonly timeout?: number;
}

/**
 * Generic element function executor - CSP compliant
 * This function is injected and must be self-contained
 */
export function executeGenericElementFunction<TArgs, TResult>(
  handle: string,
  request: ElementOperationRequest<TArgs>
): ElementOperationResult<TResult> {
  // Get element from handle
  const injected = (
    window as {
      __cordyceps_handledInjectedScript?: {
        getElementByHandle: (handle: string) => Element | null;
      };
    }
  ).__cordyceps_handledInjectedScript;

  if (!injected) {
    return { success: false, error: 'Cordyceps injected script not found' };
  }

  const element = injected.getElementByHandle(handle);
  if (!element) {
    return { success: false, error: 'Element not found' };
  }

  // Get function registry from window
  const registry = (
    window as {
      __cordyceps_elementFunctionRegistry?: Map<string, ElementFunctionEntry>;
    }
  ).__cordyceps_elementFunctionRegistry;

  if (!registry) {
    return { success: false, error: 'Element function registry not found' };
  }

  const functionEntry = registry.get(request.functionName);
  if (!functionEntry) {
    return { success: false, error: `Function '${request.functionName}' not registered` };
  }

  try {
    const result = functionEntry.fn(element, request.args);
    return { success: true, result: result as TResult };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Type-safe function registry for element operations
 */
export class ElementFunctionRegistry {
  private readonly _functions = new Map<string, ElementFunctionEntry>();

  /**
   * Register a new element function with strong typing
   */
  register<TArgs, TResult>(
    name: string,
    fn: (element: Element, args: TArgs) => TResult | Promise<TResult>,
    description?: string
  ): void {
    this._functions.set(name, {
      name,
      fn: fn as (element: Element, args: unknown) => unknown | Promise<unknown>,
      description,
    });
  }

  /**
   * Get all registered function names
   */
  getRegisteredFunctions(): string[] {
    return Array.from(this._functions.keys());
  }

  /**
   * Check if a function is registered
   */
  hasFunction(name: string): boolean {
    return this._functions.has(name);
  }

  /**
   * Export registry for injection into content script
   */
  exportForInjection(): Map<string, ElementFunctionEntry> {
    return new Map(this._functions);
  }
}

// Type helpers for common patterns
export type ScrollFunction = (element: Element) => void | Promise<void>;
export type ElementCheckFunction = (element: Element) => boolean;
export type ElementTransformFunction<T> = (element: Element, args: T) => void | Promise<void>;
