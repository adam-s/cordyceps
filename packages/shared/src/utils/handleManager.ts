import { generateUuid } from 'vs/base/common/uuid';

/**
 * HandleManager is responsible for managing the bidirectional mapping between
 * DOM Elements and their UUID handles for safe serialization across contexts.
 *
 * This class encapsulates all handle lifecycle management, following the
 * Single Responsibility Principle.
 */
export class HandleManager {
  private readonly _elementCache = new Map<string, Element>();
  private readonly _elementToUuid = new WeakMap<Element, string>();

  /**
   * Gets or creates a UUID handle for a DOM Element.
   * Maintains bidirectional mapping for efficient lookups.
   */
  getHandleForElement(element: Element): string {
    let uuid = this._elementToUuid.get(element);

    if (!uuid) {
      uuid = generateUuid();
      this._elementCache.set(uuid, element);
      this._elementToUuid.set(element, uuid);
    }

    return uuid;
  }

  /**
   * Retrieves a DOM Element by its UUID handle.
   * Returns undefined if element is destroyed or disconnected.
   */
  getElementByHandle(handle: string): Element | undefined {
    const element = this._elementCache.get(handle);

    // Check if element is still connected to the DOM
    if (element && !element.isConnected) {
      // Element was destroyed, clean up the stale reference
      this._elementCache.delete(handle);
      return undefined;
    }

    return element;
  }

  /**
   * Converts an Element to its handle, or returns the value unchanged if not an Element.
   */
  convertElementToHandle(value: unknown): unknown {
    if (value instanceof Element) {
      return this.getHandleForElement(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.convertElementToHandle(item));
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      const converted: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        converted[key] = this.convertElementToHandle(val);
      }
      return converted;
    }

    return value;
  }

  /**
   * Converts a handle back to its Element, or returns the value unchanged if not a handle.
   */
  convertHandleToElement(value: unknown): unknown {
    if (typeof value === 'string' && this._elementCache.has(value)) {
      return this.getElementByHandle(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.convertHandleToElement(item));
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      const converted: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        converted[key] = this.convertHandleToElement(val);
      }
      return converted;
    }

    return value;
  }

  /**
   * Manually registers an Element with a specific handle (useful for testing).
   */
  registerElement(element: Element, handle?: string): string {
    const finalHandle = handle || generateUuid();

    // Remove any existing mapping for this element
    const existingHandle = this._elementToUuid.get(element);
    if (existingHandle) {
      this._elementCache.delete(existingHandle);
    }

    // Store the new mappings
    this._elementCache.set(finalHandle, element);
    this._elementToUuid.set(element, finalHandle);

    return finalHandle;
  }

  /**
   * Removes an Element and its handle from the cache.
   */
  unregisterElement(element: Element): boolean {
    const handle = this._elementToUuid.get(element);
    if (handle) {
      this._elementCache.delete(handle);
      this._elementToUuid.delete(element);
      return true;
    }
    return false;
  }

  /**
   * Removes a handle and its Element from the cache.
   */
  unregisterHandle(handle: string): boolean {
    const element = this._elementCache.get(handle);
    if (element) {
      this._elementCache.delete(handle);
      this._elementToUuid.delete(element);
      return true;
    }
    return false;
  }

  /**
   * Validates and cleans up destroyed elements from the cache.
   * Call this periodically to prevent memory leaks.
   * @returns Number of elements cleaned up
   */
  cleanupDestroyedElements(): number {
    let cleanedCount = 0;

    for (const [handle, element] of this._elementCache.entries()) {
      if (!element.isConnected) {
        this._elementCache.delete(handle);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Checks if a handle points to a valid, connected element.
   */
  isHandleValid(handle: string): boolean {
    const element = this._elementCache.get(handle);
    return element ? element.isConnected : false;
  }

  /**
   * Clears all cached Elements and handles.
   */
  clear(): void {
    this._elementCache.clear();
    // WeakMap doesn't have a clear method, but clearing strong references
    // allows weak references to be garbage collected
  }

  /**
   * Gets the number of cached Elements.
   */
  get cacheSize(): number {
    return this._elementCache.size;
  }
}
