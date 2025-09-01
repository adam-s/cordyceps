export {}; // Ensure this file is treated as a module.

declare global {
  interface Window {
    ariaSnapshot(node: Node, options: { forAI: boolean; refPrefix: string }): string | boolean;
  }
}

import { InjectedScript } from '@injected/injectedScript';
import type { ParsedSelector } from '@injected/isomorphic/selectorParser';
import type { SelectorEngine } from '@injected/selectorEngine';
import { FileTransferPortManager } from './fileTransferPortManager';
import { HandleManager } from '@shared/utils/handleManager';

/**
 * HandledInjectedScript provides handle-based DOM interaction by wrapping InjectedScript.
 *
 * This class uses composition instead of inheritance to provide a modified interface
 * where querySelector and querySelectorAll return UUID handles instead of DOM Elements.
 * This design follows the composition-over-inheritance principle and provides clean
 * type safety without violating TypeScript's method override constraints.
 *
 * The class maintains compatibility with InjectedScript's API while enabling safe
 * serialization across different JavaScript contexts.
 */
export class HandledInjectedScript {
  private readonly _injectedScript: InjectedScript;
  private readonly _handleManager: HandleManager;
  private readonly _fileTransferPortManager: FileTransferPortManager;

  constructor(
    window: Window & typeof globalThis,
    isUnderTest: boolean,
    sdkLanguage: 'javascript' | 'python' | 'java' | 'csharp',
    testIdAttributeNameForStrictErrorAndConsoleCodegen: string,
    stableRafCount: number,
    browserName: string,
    customEngines: { name: string; engine: SelectorEngine }[],
    handleManager?: HandleManager
  ) {
    this._injectedScript = new InjectedScript(window, {
      isUnderTest,
      sdkLanguage,
      testIdAttributeName: testIdAttributeNameForStrictErrorAndConsoleCodegen,
      stableRafCount,
      browserName,
      customEngines: customEngines.map(engine => ({ name: engine.name, source: '' })),
    });

    this._handleManager = handleManager || new HandleManager();
    this._fileTransferPortManager = new FileTransferPortManager();
  }

  // Delegate all non-overridden methods to the wrapped InjectedScript
  parseSelector(selector: string): ParsedSelector {
    return this._injectedScript.parseSelector(selector);
  }

  /**
   * Mark target elements for debugging/tracing purposes.
   * This method provides access to the underlying InjectedScript's markTargetElements functionality.
   */
  markTargetElements(markedElements: Set<Element>, callId: string): void {
    return this._injectedScript.markTargetElements(markedElements, callId);
  }

  /**
   * Perform a tap on an element by its handle.
   * This method handles the core tap logic using touch events.
   */
  tapElement(handle: string): { success: boolean; error?: string } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    try {
      const htmlElement = element as HTMLElement;

      // Get element center point for touch
      const rect = htmlElement.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;

      // Create and dispatch touch events
      const touchStartEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [
          new Touch({
            identifier: 0,
            target: htmlElement,
            clientX,
            clientY,
            pageX: clientX + window.pageXOffset,
            pageY: clientY + window.pageYOffset,
          }),
        ],
      });

      const touchEndEvent = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({
            identifier: 0,
            target: htmlElement,
            clientX,
            clientY,
            pageX: clientX + window.pageXOffset,
            pageY: clientY + window.pageYOffset,
          }),
        ],
      });

      htmlElement.dispatchEvent(touchStartEvent);
      htmlElement.dispatchEvent(touchEndEvent);

      // Also dispatch a click event for compatibility
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
      });
      htmlElement.dispatchEvent(clickEvent);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to tap element',
      };
    }
  }

  /**
   * Enhanced tap with position and options support.
   * This method handles advanced tapping with validation.
   */
  tapElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
    } = {}
  ): { success: boolean; error?: string; needsForce?: boolean } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    const htmlElement = element as HTMLElement;

    // Check if element is visible (unless forced)
    if (!options.force && !this._injectedScript.utils.isElementVisible(element)) {
      return {
        success: false,
        error: 'Element is not visible',
        needsForce: true,
      };
    }

    // Check if element is enabled (for form controls)
    if (!options.force && htmlElement.tagName) {
      const tagName = htmlElement.tagName.toLowerCase();
      if (['button', 'input', 'select', 'textarea'].includes(tagName)) {
        const formElement = htmlElement as
          | HTMLInputElement
          | HTMLButtonElement
          | HTMLSelectElement
          | HTMLTextAreaElement;
        if (formElement.disabled) {
          return {
            success: false,
            error: 'Element is disabled',
          };
        }
      }
    }

    try {
      const rect = htmlElement.getBoundingClientRect();
      // Use specified position or center of element
      const clientX = options.position
        ? rect.left + options.position.x
        : rect.left + rect.width / 2;
      const clientY = options.position ? rect.top + options.position.y : rect.top + rect.height / 2;

      // Create and dispatch touch events
      const touchStartEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [
          new Touch({
            identifier: 0,
            target: htmlElement,
            clientX,
            clientY,
            pageX: clientX + window.pageXOffset,
            pageY: clientY + window.pageYOffset,
          }),
        ],
      });

      const touchEndEvent = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({
            identifier: 0,
            target: htmlElement,
            clientX,
            clientY,
            pageX: clientX + window.pageXOffset,
            pageY: clientY + window.pageYOffset,
          }),
        ],
      });

      htmlElement.dispatchEvent(touchStartEvent);
      htmlElement.dispatchEvent(touchEndEvent);

      // Also dispatch a click event for compatibility
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
      });
      htmlElement.dispatchEvent(clickEvent);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to tap element',
      };
    }
  }

  /**
   * Modified querySelector that returns a UUID handle instead of an Element.
   * This method matches the interface expected by FrameExecutionContext.
   *
   * @param parsedSelector - The parsed selector to query
   * @param root - The root element to search within
   * @param strict - Whether to enforce strict mode (single element match)
   * @returns UUID handle of the found element, or null if not found
   */
  querySelector(parsedSelector: unknown, root: Node, strict: boolean): string | null {
    const element = this._injectedScript.querySelector(
      parsedSelector as ParsedSelector,
      root,
      strict
    );
    if (!element) {
      return null;
    }
    return this._handleManager.getHandleForElement(element);
  }

  /**
   * Modified querySelectorAll that returns UUID handles instead of Elements.
   *
   * @param parsedSelector - The parsed selector to query
   * @param root - The root element to search within
   * @returns Array of UUID handles for all found elements
   */
  querySelectorAll(parsedSelector: unknown, root: Node): string[] {
    const elements = this._injectedScript.querySelectorAll(parsedSelector as ParsedSelector, root);

    const handles = elements.map(element => this._handleManager.getHandleForElement(element));

    return handles;
  }

  /**
   * Captures an ARIA snapshot for an element specified by its handle.
   *
   * @param handle - The UUID handle of the element.
   * @returns A string representation of the ARIA tree, or undefined if the handle is invalid.
   */
  ariaSnapshot(node: Node, options: { forAI: boolean; refPrefix: string }): string | undefined {
    if (!node) {
      return undefined;
    }
    return this._injectedScript.ariaSnapshot(node, options);
  }

  /**
   * Provides access to the underlying HandleManager for advanced operations.
   */
  get handleManager(): HandleManager {
    return this._handleManager;
  }

  /**
   * Provides access to the underlying InjectedScript for methods not wrapped.
   */
  get injectedScript(): InjectedScript {
    return this._injectedScript;
  }

  get document(): Document {
    return this._injectedScript.document;
  }

  /**
   * Convenience method to get an Element by its handle.
   */
  getElementByHandle(handle: string): Element | undefined {
    return this._handleManager.getElementByHandle(handle);
  }

  /**
   * Convenience method to get a handle for an Element.
   */
  getHandleForElement(element: Element): string {
    return this._handleManager.getHandleForElement(element);
  }

  /**
   * Wait for selector evaluation logic moved from FrameExecutionContext.
   * This method handles the core selector resolution and state checking.
   */
  waitForSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string
  ): {
    log: string;
    elementHandle: string | null;
    visible: boolean;
    attached: boolean;
    error?: string;
  } {
    try {
      // Get root element
      const root = scopeHandle ? this.getElementByHandle(scopeHandle) : this.document || document;
      if (!root) {
        return {
          log: '',
          elementHandle: null,
          visible: false,
          attached: false,
          error: 'Root element not found',
        };
      }

      // Check if root is connected (for scoped searches)
      if (scopeHandle && root && !(root as Element).isConnected) {
        return {
          log: '',
          elementHandle: null,
          visible: false,
          attached: false,
          error: 'Element is not attached to the DOM',
        };
      }

      // Get all matching elements
      const elementHandles = this.querySelectorAll(parsedSelector, root);
      const elements = elementHandles
        .map(handle => this.getElementByHandle(handle))
        .filter(Boolean);
      const element = elements[0];
      const visible = element ? this._injectedScript.utils.isElementVisible(element) : false;
      let log = '';
      if (elements.length > 1) {
        if (strict) {
          return {
            log: '',
            elementHandle: null,
            visible: false,
            attached: false,
            error:
              `Selector "${selectorString}" resolved to ${elements.length} elements. ` +
              'Use a more specific selector.',
          };
        }
        const firstElement = elements[0];
        if (firstElement) {
          const previewText = this._injectedScript.previewNode(firstElement);
          log =
            `  locator resolved to ${elements.length} elements. ` +
            `Proceeding with the first one: ${previewText}`;
        }
      } else if (element) {
        log = `  locator resolved to ${visible ? 'visible' : 'hidden'} ${this._injectedScript.previewNode(element)}`;
      }

      const result = {
        log,
        elementHandle: elementHandles[0] || null,
        visible,
        attached: !!element,
      };

      return result;
    } catch (error) {
      // Catch any unexpected errors and return them as error results
      return {
        log: '',
        elementHandle: null,
        visible: false,
        attached: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Frame selector evaluation logic moved from FrameSelectors.
   * This method handles iframe/frame element validation.
   */
  frameSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string
  ): string | null {
    const root = scopeHandle ? this.getElementByHandle(scopeHandle) : this.document;
    if (!root) {
      throw new Error('Root element not found for scope');
    }

    const elementHandle = this.querySelector(parsedSelector, root, strict);
    if (!elementHandle) {
      return null;
    }

    const element = this.getElementByHandle(elementHandle);
    if (element && element.nodeName !== 'IFRAME' && element.nodeName !== 'FRAME') {
      // This will throw inside the content script, and the error will be propagated.
      throw this._injectedScript.createStacklessError(
        `Selector "${selectorString}" resolved to ${this._injectedScript.previewNode(
          element
        )}, but an <iframe> was expected`
      );
    }
    return elementHandle;
  }

  /**
   * Get bounding box for an element by its handle.
   * This method handles the core bounding box calculation logic.
   */
  getBoundingBox(handle: string): { x: number; y: number; width: number; height: number } | null {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return null;
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return null;
    }

    // Get the bounding client rect
    const rect = (element as Element).getBoundingClientRect();

    // Return null if element has no dimensions
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  /**
   * Check if an element is currently checked (for checkboxes and radio buttons).
   * This method handles the core checked state evaluation logic.
   */
  isChecked(handle: string): boolean {
    const element = this.getElementByHandle(handle) as HTMLInputElement;
    if (!element) {
      return false;
    }

    // Check if element is connected to the DOM
    if (!element.isConnected) {
      return false;
    }

    // Check if it's a checkable element
    if (element.tagName !== 'INPUT') {
      return false;
    }

    const inputType = element.type.toLowerCase();
    if (inputType !== 'checkbox' && inputType !== 'radio') {
      return false;
    }

    return element.checked;
  }

  /**
   * Set the checked state of a checkbox or radio button.
   * This method handles the core check/uncheck logic following Playwright patterns.
   */
  setChecked(
    handle: string,
    state: boolean
  ): {
    success: boolean;
    error?: string;
    needsClick: boolean;
    currentState: boolean;
  } {
    const element = this.getElementByHandle(handle) as HTMLInputElement;
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
        needsClick: false,
        currentState: false,
      };
    }

    // Check if element is connected to the DOM
    if (!element.isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
        needsClick: false,
        currentState: false,
      };
    }

    // Check if it's a checkable element
    if (element.tagName !== 'INPUT') {
      return {
        success: false,
        error: 'Element is not an input element',
        needsClick: false,
        currentState: false,
      };
    }

    const inputType = element.type.toLowerCase();
    if (inputType !== 'checkbox' && inputType !== 'radio') {
      return {
        success: false,
        error: `Input element type "${inputType}" is not checkable. Only 'checkbox' and 'radio' are supported.`,
        needsClick: false,
        currentState: false,
      };
    }

    const currentState = element.checked;

    // If already in the desired state, no action needed
    if (currentState === state) {
      return {
        success: true,
        needsClick: false,
        currentState,
      };
    }

    // Check if element is disabled
    if (element.disabled) {
      return {
        success: false,
        error: 'Element is disabled',
        needsClick: false,
        currentState,
      };
    }

    // Check if element is visible using InjectedScript utilities
    if (!this._injectedScript.utils.isElementVisible(element)) {
      return {
        success: false,
        error: 'Element is not visible',
        needsClick: false,
        currentState,
      };
    }

    // Return that a click is needed to change the state
    return {
      success: true,
      needsClick: true,
      currentState,
    };
  }

  /**
   * Perform a click on an element by its handle.
   * This method handles the core click logic.
   */
  clickElement(handle: string): { success: boolean; error?: string } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    try {
      (element as HTMLElement).click();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to click element',
      };
    }
  }

  /**
   * Enhanced click with position and options support.
   * This method handles advanced clicking with validation.
   */
  clickElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
      button?: 'left' | 'right' | 'middle';
      clickCount?: number;
    } = {}
  ): { success: boolean; error?: string; needsForce?: boolean } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    const htmlElement = element as HTMLElement;

    // Check if element is visible (unless forced)
    if (!options.force && !this._injectedScript.utils.isElementVisible(element)) {
      return {
        success: false,
        error: 'Element is not visible',
        needsForce: true,
      };
    }

    // Check if element is enabled (for form controls)
    if (!options.force && htmlElement.tagName) {
      const tagName = htmlElement.tagName.toLowerCase();
      if (['button', 'input', 'select', 'textarea'].includes(tagName)) {
        const formElement = htmlElement as
          | HTMLInputElement
          | HTMLButtonElement
          | HTMLSelectElement
          | HTMLTextAreaElement;
        if (formElement.disabled) {
          return {
            success: false,
            error: 'Element is disabled',
          };
        }
      }
    }

    try {
      // Use enhanced mouse events for right/middle clicks or when position is specified
      if (options.position || options.button === 'right' || options.button === 'middle') {
        const rect = htmlElement.getBoundingClientRect();
        // Use center of element if no position specified
        const clientX = options.position
          ? rect.left + options.position.x
          : rect.left + rect.width / 2;
        const clientY = options.position
          ? rect.top + options.position.y
          : rect.top + rect.height / 2;

        // Create and dispatch mouse events
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          button: options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0,
        });

        const mouseUpEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          button: options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0,
        });

        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          button: options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0,
          detail: options.clickCount || 1,
        });

        htmlElement.dispatchEvent(mouseDownEvent);
        htmlElement.dispatchEvent(mouseUpEvent);
        htmlElement.dispatchEvent(clickEvent);

        // Dispatch contextmenu event for right-clicks
        if (options.button === 'right') {
          const contextMenuEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            button: 2,
          });
          htmlElement.dispatchEvent(contextMenuEvent);
        }

        // Handle multiple clicks
        if (options.clickCount && options.clickCount > 1) {
          for (let i = 1; i < options.clickCount; i++) {
            const multiClickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              clientX,
              clientY,
              button: options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0,
              detail: i + 1,
            });
            htmlElement.dispatchEvent(multiClickEvent);
          }
        }
      } else {
        // Use simple click for better compatibility
        htmlElement.click();

        // Handle multiple clicks
        if (options.clickCount && options.clickCount > 1) {
          for (let i = 1; i < options.clickCount; i++) {
            htmlElement.click();
          }
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to click element',
      };
    }
  }

  /**
   * Dispatch a custom event on an element by its handle.
   * This method handles event creation and dispatching with proper browser compatibility.
   */
  dispatchEvent(
    handle: string,
    type: string,
    eventInit: Record<string, unknown> = {}
  ): { success: boolean; error?: string } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    try {
      const htmlElement = element as HTMLElement;

      // Create the appropriate event based on type
      let event: Event;

      // Common event types with their proper constructors
      if (type.startsWith('mouse') || ['click', 'dblclick', 'contextmenu'].includes(type)) {
        event = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          ...eventInit,
        });
      } else if (type.startsWith('key')) {
        event = new KeyboardEvent(type, {
          bubbles: true,
          cancelable: true,
          ...eventInit,
        });
      } else if (['focus', 'blur', 'focusin', 'focusout'].includes(type)) {
        event = new FocusEvent(type, {
          bubbles: type === 'focusin' || type === 'focusout',
          cancelable: false,
          ...eventInit,
        });
      } else if (['input', 'change'].includes(type)) {
        event = new Event(type, {
          bubbles: true,
          cancelable: true,
          ...eventInit,
        });
      } else {
        // Generic event for custom event types
        event = new CustomEvent(type, {
          bubbles: true,
          cancelable: true,
          detail: eventInit.detail,
          ...eventInit,
        });
      }

      // Dispatch the event
      htmlElement.dispatchEvent(event);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to dispatch event',
      };
    }
  }

  /**
   * Highlight elements matching the given parsed selector.
   */
  highlight(parsedSelector: unknown): void {
    this._injectedScript.highlight(parsedSelector as ParsedSelector);
  }

  /**
   * Hide any currently displayed highlights.
   */
  hideHighlight(): void {
    this._injectedScript.hideHighlight();
  }

  /**
   * Creates a new file transfer port for communication with the side panel.
   * This allows for transferring files and buffers between content script and side panel.
   *
   * @returns The port ID that can be used by the side panel to communicate with this port
   */
  createFileTransferPort(): string {
    const port = this._fileTransferPortManager.createPort();
    return port.portId;
  }

  /**
   * Sets files on an input element following Playwright patterns.
   * This method validates the input element and creates File objects from the provided data.
   *
   * @param handle The element handle for the input element
   * @param files Array of file payloads to set
   * @param options Options for the operation
   * @returns Result of the operation
   */
  setInputFiles(
    handle: string,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[],
    options: { force?: boolean; directoryUpload?: boolean } = {}
  ): {
    success: boolean;
    error?: string;
    filesSet: number;
  } {
    console.log(options);

    try {
      const element = this.getElementByHandle(handle);

      if (!element) {
        console.log(
          `[HandledInjectedScript.setInputFiles] Returning element not found error ######`
        );
        return {
          success: false,
          error: 'Element not found for handle',
          filesSet: 0,
        };
      }
      // Check if element is connected to the DOM
      if (!element.isConnected) {
        return {
          success: false,
          error: 'Element is not connected to the DOM',
          filesSet: 0,
        };
      }

      // Validate it's an input element
      if (element.tagName !== 'INPUT') {
        return {
          success: false,
          error: 'Element is not an INPUT element',
          filesSet: 0,
        };
      }

      const inputElement = element as HTMLInputElement;

      // Validate input type
      if (inputElement.type !== 'file') {
        return {
          success: false,
          error: 'Input element is not of type "file"',
          filesSet: 0,
        };
      }

      // Validate multiple files support
      const multiple = files.length > 1;
      if (multiple && !inputElement.multiple && !inputElement.webkitdirectory) {
        return {
          success: false,
          error: 'Input element does not support multiple files',
          filesSet: 0,
        };
      }

      // Validate directory upload
      if (options.directoryUpload && !inputElement.webkitdirectory) {
        return {
          success: false,
          error: 'Input element does not support directory upload (webkitdirectory)',
          filesSet: 0,
        };
      }

      if (!options.directoryUpload && inputElement.webkitdirectory) {
        return {
          success: false,
          error: 'Directory input requires directoryUpload option',
          filesSet: 0,
        };
      }

      // Check if element is disabled (unless forced)
      if (!options.force && inputElement.disabled) {
        return {
          success: false,
          error: 'Input element is disabled',
          filesSet: 0,
        };
      }

      // Check if element is visible (unless forced)
      if (!options.force && !this._injectedScript.utils.isElementVisible(element)) {
        return {
          success: false,
          error: 'Input element is not visible',
          filesSet: 0,
        };
      }

      // Convert ArrayBuffers to File objects
      const fileObjects: File[] = files.map(fileData => {
        const blob = new Blob([fileData.buffer], { type: fileData.mimeType });
        const file = new File([blob], fileData.name, { type: fileData.mimeType });

        return file;
      });

      // Create a new FileList-like object
      const fileList = this._createFileList(fileObjects);

      // Set the files on the input element
      Object.defineProperty(inputElement, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      // Dispatch input and change events to notify the page
      this._dispatchFileEvents(inputElement);

      const result = {
        success: true,
        filesSet: files.length,
      };

      console.log(
        `[HandledInjectedScript.setInputFiles] Success! Files set: ${files.length} ######`
      );
      return result;
    } catch (error) {
      console.log(error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        filesSet: 0,
      };
    }
  }

  /**
   * Creates a FileList-like object from an array of File objects.
   * This mimics the native FileList interface that input elements use.
   */
  private _createFileList(files: File[]): FileList {
    const fileList = Object.create(FileList.prototype);

    // Add files as indexed properties
    files.forEach((file, index) => {
      Object.defineProperty(fileList, index, {
        value: file,
        enumerable: true,
        configurable: true,
      });
    });

    // Add length property
    Object.defineProperty(fileList, 'length', {
      value: files.length,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    // Add item method
    Object.defineProperty(fileList, 'item', {
      value: function (index: number): File | null {
        return index >= 0 && index < files.length ? files[index] : null;
      },
      writable: false,
      enumerable: false,
      configurable: false,
    });

    // Add iterator support
    Object.defineProperty(fileList, Symbol.iterator, {
      value: function* () {
        for (let i = 0; i < files.length; i++) {
          yield files[i];
        }
      },
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return fileList as FileList;
  }

  /**
   * Dispatches appropriate events after setting files on an input element.
   * This ensures that event listeners on the page are properly notified.
   */
  private _dispatchFileEvents(inputElement: HTMLInputElement): void {
    // Dispatch input event (fires during the file selection)
    const inputEvent = new Event('input', {
      bubbles: true,
      cancelable: false,
    });
    inputElement.dispatchEvent(inputEvent);

    // Dispatch change event (fires after file selection is complete)
    const changeEvent = new Event('change', {
      bubbles: true,
      cancelable: false,
    });
    inputElement.dispatchEvent(changeEvent);
  }

  /**
   * Gets access to the file transfer port manager for advanced operations.
   */
  get fileTransferPortManager(): FileTransferPortManager {
    return this._fileTransferPortManager;
  }
}
