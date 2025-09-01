import { Disposable } from 'vs/base/common/lifecycle';
import { ProtocolError } from './protocolError';
import { ElementHandle } from '../elementHandle';
import type { Frame } from '../frame';
import type { Session } from '../session';
import { LongStandingScope } from '@injected/isomorphic/manualPromise';
import { arrayBufferToBase64, type Base64FileData } from '@shared/utils/base64Utils';
import {
  ElementOperationRequest,
  ElementOperationResult,
  executeGenericElementFunction,
} from '../operations/genericElementOperations';

type ScriptInjectionResult<T> = chrome.scripting.InjectionResult<Awaited<T>> & {
  error?: { message: string };
};

declare global {
  interface Window {
    __cordyceps_handledInjectedScript: CordycepsInjectedScript;
  }
}

interface CordycepsInjectedScript {
  parseSelector(selector: string): unknown;
  querySelector(parsedSelector: unknown, root: Node, strict: boolean): string | null;
  querySelectorAll(parsedSelector: unknown, root: Node): string[];
  ariaSnapshot(node: Node, options: { forAI: boolean; refPrefix: string }): string | undefined;
  getElementByHandle(handle: string): Element | undefined;
  document?: Document;
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
  };
  frameSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string
  ): string | null;
  getBoundingBox(handle: string): { x: number; y: number; width: number; height: number } | null;
  isChecked(handle: string): boolean;
  setChecked(
    handle: string,
    state: boolean
  ): {
    success: boolean;
    error?: string;
    needsClick: boolean;
    currentState: boolean;
  };
  clickElement(handle: string): { success: boolean; error?: string };
  clickElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
      button?: 'left' | 'right' | 'middle';
      clickCount?: number;
    }
  ): { success: boolean; error?: string; needsForce?: boolean };
  tapElement(handle: string): { success: boolean; error?: string };
  tapElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
    }
  ): { success: boolean; error?: string; needsForce?: boolean };
  dispatchEvent(
    handle: string,
    type: string,
    eventInit: Record<string, unknown>
  ): { success: boolean; error?: string };
  highlight(parsedSelector: unknown): void;
  hideHighlight(): void;
  maskSelectors(parsedSelectors: unknown[], color: string): void;
  markTargetElements(markedElements: Set<Element>, callId: string): void;
  createFileTransferPort(): string;
  fileTransferPortManager: {
    getPort(portId: string):
      | {
          getIncomingBuffer(
            transferId: string
          ): { buffer: ArrayBuffer; mimeType: string; name: string } | undefined;
        }
      | undefined;
  };
  setInputFiles(
    handle: string,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[],
    options: { force?: boolean; directoryUpload?: boolean }
  ): {
    success: boolean;
    error?: string;
    filesSet: number;
  };
  registerElementFunction<TArgs, TResult>(
    name: string,
    fn: (element: Element, args?: TArgs) => TResult | Promise<TResult>,
    description?: string
  ): void;
  hasElementFunction(name: string): boolean;
  getRegisteredElementFunctions(): string[];
}

export class FrameExecutionContext extends Disposable {
  public readonly frame: Frame;
  public readonly session: Session;
  private _contextDestroyedScope = new LongStandingScope();

  public constructor(frame: Frame) {
    super();
    this.frame = frame;
    this.session = frame.session;
  }

  contextDestroyed(reason: string) {
    this._contextDestroyedScope.close(new Error(reason));
  }

  async _raceAgainstContextDestroyed<T>(promise: Promise<T>): Promise<T> {
    return this._contextDestroyedScope.race(promise);
  }

  async executeScript<T, Args extends unknown[]>(
    func: (...args: Args) => T,
    world: chrome.scripting.ExecutionWorld = 'MAIN',
    ...args: Args
  ): Promise<Awaited<T> | undefined> {
    // Check if frame is detached before attempting execution
    if (this.frame.isDetached()) {
      throw new Error(`Cannot execute script: frame ${this.frame.frameId} is detached`);
    }

    try {
      const results = (await chrome.scripting.executeScript({
        target: {
          tabId: this.frame.tabId,
          frameIds: [this.frame.frameId],
        },
        world,
        func,
        args,
      })) as ScriptInjectionResult<T>[];

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      const mainResult = results?.[0];

      if (mainResult?.error) {
        throw new Error(mainResult.error.message);
      }

      return mainResult?.result;
    } catch (e) {
      const method = func.name || 'executeScript';
      throw ProtocolError.from(e, method);
    }
  }

  /**
   * Like executeScript, but returns an ElementHandle for a handle string returned by the injected script.
   */
  public async evaluateHandle<Args extends unknown[], T = string>(
    func: (...args: Args) => T,
    world: chrome.scripting.ExecutionWorld,
    ...args: Args
  ): Promise<ElementHandle | null> {
    try {
      const results = (await chrome.scripting.executeScript({
        target: { tabId: this.frame.tabId, frameIds: [this.frame.frameId] },
        world,
        func,
        args,
      })) as ScriptInjectionResult<T>[];

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      const main = results[0];
      if (main?.error) {
        throw new Error(main.error.message);
      }

      const handleId = main.result as unknown as string | null;
      if (!handleId) {
        return null;
      }

      return new ElementHandle(this, handleId);
    } catch (e) {
      const method = func.name || 'evaluateHandle';

      throw ProtocolError.from(e, method);
    }
  }

  // Note: Generic evaluate() methods removed due to MV3 CSP restrictions
  // Use specific methods like elementExists(), clickSelector(), etc. instead

  public async clickSelector(
    selector: string,
    rootElementHandle?: ElementHandle,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<void> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    await this.executeScript(
      (selector: string, rootHandle: string | null) => {
        const injectedScript = window.__cordyceps_handledInjectedScript;
        const parsed = injectedScript.parseSelector(selector);
        const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
        if (!root) {
          throw new Error('Root element not found for handle');
        }
        const elHandle = injectedScript.querySelector(parsed, root, false);
        if (!elHandle) {
          throw new Error('No element found for selector');
        }
        const el = injectedScript.getElementByHandle(elHandle);
        if (!el) {
          throw new Error('Handle did not resolve to an element');
        }
        (el as HTMLElement).click();
      },
      world,
      selector,
      rootHandle
    );
  }

  public async elementExists(
    selector: string,
    rootElementHandle?: ElementHandle,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<boolean> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    const result = await this.executeScript(
      (selector: string, rootHandle: string | null) => {
        const injectedScript = window.__cordyceps_handledInjectedScript;
        const parsed = injectedScript.parseSelector(selector);
        const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
        if (!root) {
          return false;
        }
        return injectedScript.querySelector(parsed, root, false) !== undefined;
      },
      world,
      selector,
      rootHandle
    );
    return result || false;
  }

  public async querySelector(
    selector: string,
    rootElementHandle?: ElementHandle,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<ElementHandle | null> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    const handle = await this.executeScript(
      (selector: string, rootHandle: string | null) => {
        const injectedScript = window.__cordyceps_handledInjectedScript;
        const parsed = injectedScript.parseSelector(selector);
        const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
        if (!root) {
          return null;
        }
        return injectedScript.querySelector(parsed, root, false);
      },
      world,
      selector,
      rootHandle
    );

    if (!handle) {
      return null;
    }
    return new ElementHandle(this, handle as string);
  }

  public async querySelectorAll(
    selector: string,
    rootElementHandle?: ElementHandle,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<ElementHandle[]> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    const handles = await this.executeScript(
      (selector: string, rootHandle: string | null) => {
        const injectedScript = window.__cordyceps_handledInjectedScript;
        const parsed = injectedScript.parseSelector(selector);
        if (!parsed || !injectedScript.querySelectorAll) return [];
        const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
        if (!root) {
          return [];
        }
        return injectedScript.querySelectorAll(parsed, root);
      },
      world,
      selector,
      rootHandle
    );

    if (!handles) {
      return [];
    }
    return (handles as string[]).map(handle => new ElementHandle(this, handle));
  }

  public async ariaSnapshot(
    forAI: boolean,
    refPrefix: string,
    world: chrome.scripting.ExecutionWorld = 'MAIN',
    rootElementHandle?: ElementHandle
  ): Promise<string | boolean> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    const result = await this.executeScript(
      (ai: boolean, prefix: string, rootHandle: string | null): string | undefined => {
        const cordyceps = window.__cordyceps_handledInjectedScript;
        const node = rootHandle
          ? cordyceps.getElementByHandle(rootHandle)
          : cordyceps.document?.body;
        if (!node) {
          return;
        }
        return cordyceps.ariaSnapshot(node, {
          forAI: ai,
          refPrefix: prefix,
        });
      },
      world,
      forAI,
      refPrefix,
      rootHandle
    );
    return result ?? true;
  }

  public async evaluate<T, Args extends unknown[]>(
    func: (...args: Args) => T,
    world?: chrome.scripting.ExecutionWorld,
    ...args: Args
  ): Promise<Awaited<T> | undefined> {
    return this.executeScript(func, world, ...args);
  }

  /**
   * Evaluate waitForSelector logic using the content script method.
   * This replaces the inline script execution with a call to the content script.
   */
  public async waitForSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<
    | {
        log: string;
        elementHandle: string | null;
        visible: boolean;
        attached: boolean;
        error?: string;
      }
    | undefined
  > {
    const result = this.executeScript(
      (
        parsedSelector: unknown,
        strict: boolean,
        scopeHandle: string | null,
        selectorString: string
      ) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.waitForSelectorEvaluation(
          parsedSelector,
          strict,
          scopeHandle,
          selectorString
        );
      },
      world,
      parsedSelector,
      strict,
      scopeHandle,
      selectorString
    );

    return result;
  }

  /**
   * Evaluate frame selector logic using the content script method.
   * This replaces the inline script execution with a call to the content script.
   */
  public async frameSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<string | null | undefined> {
    return this.executeScript(
      (
        parsedSelector: unknown,
        strict: boolean,
        scopeHandle: string | null,
        selectorString: string
      ) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.frameSelectorEvaluation(
          parsedSelector,
          strict,
          scopeHandle,
          selectorString
        );
      },
      world,
      parsedSelector,
      strict,
      scopeHandle,
      selectorString
    );
  }

  /**
   * Get bounding box for an element using the content script method.
   * This replaces direct DOM access with a call to the content script.
   */
  public async getBoundingBox(
    handle: string,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<{ x: number; y: number; width: number; height: number } | null | undefined> {
    return this.executeScript(
      (handle: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.getBoundingBox(handle);
      },
      world,
      handle
    );
  }

  /**
   * Check if an element is currently checked (for checkboxes and radio buttons).
   * This method uses the content script to evaluate the checked state.
   */
  public async isChecked(
    handle: string,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<boolean | undefined> {
    return this.executeScript(
      (handle: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.isChecked(handle);
      },
      world,
      handle
    );
  }

  /**
   * Set the checked state of an element following Playwright patterns.
   * This method handles the core check/uncheck logic via content script.
   */
  public async setChecked(
    handle: string,
    state: boolean,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<
    | {
        success: boolean;
        error?: string;
        needsClick: boolean;
        currentState: boolean;
      }
    | undefined
  > {
    return this.executeScript(
      (handle: string, state: boolean) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.setChecked(handle, state);
      },
      world,
      handle,
      state
    );
  }

  /**
   * Click an element using the content script method.
   * This method handles clicking via content script.
   */
  public async clickElement(
    handle: string,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<{ success: boolean; error?: string } | undefined> {
    const result = this.executeScript(
      (handle: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.clickElement(handle);
      },
      world,
      handle
    );

    return result;
  }

  /**
   * Click an element with advanced options using the content script method.
   * This method handles enhanced clicking with position and options.
   */
  public async clickElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
      button?: 'left' | 'right' | 'middle';
      clickCount?: number;
      noWaitAfter?: boolean;
      modifiers?: ('Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift')[];
      trial?: boolean;
    } = {},
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<{ success: boolean; error?: string; needsForce?: boolean } | undefined> {
    return this.executeScript(
      (
        handle: string,
        options: {
          position?: { x: number; y: number };
          force?: boolean;
          button?: 'left' | 'right' | 'middle';
          clickCount?: number;
          noWaitAfter?: boolean;
          modifiers?: ('Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift')[];
          trial?: boolean;
        }
      ) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.clickElementWithOptions(handle, options);
      },
      world,
      handle,
      options
    );
  }

  /**
   * Perform a tap on an element by its handle.
   * This method handles the core tap logic.
   */
  public async tapElement(
    handle: string,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<{ success: boolean; error?: string } | undefined> {
    return this.executeScript(
      (h: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.tapElement(h);
      },
      world,
      handle
    );
  }

  /**
   * Enhanced tap with position and options support.
   * This method handles advanced tapping with validation.
   */
  public async tapElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
    } = {},
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<{ success: boolean; error?: string; needsForce?: boolean } | undefined> {
    return this.executeScript(
      (h: string, opts: { position?: { x: number; y: number }; force?: boolean }) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.tapElementWithOptions(h, opts);
      },
      world,
      handle,
      options
    );
  }

  /**
   * Dispatch a custom event on an element using the content script method.
   * This method handles event creation and dispatching with proper browser compatibility.
   */
  public async dispatchEvent(
    handle: string,
    type: string,
    eventInit: Record<string, unknown> = {},
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<{ success: boolean; error?: string } | undefined> {
    return this.executeScript(
      (handle: string, type: string, eventInit: Record<string, unknown>) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.dispatchEvent(handle, type, eventInit);
      },
      world,
      handle,
      type,
      eventInit
    );
  }

  /**
   * Highlight elements matching the given selector.
   */
  public async highlight(
    selector: string,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<void> {
    return this.executeScript(
      (selector: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        const parsed = injected.parseSelector(selector);
        return injected.highlight(parsed);
      },
      world,
      selector
    );
  }

  /**
   * Hide any currently displayed highlights.
   */
  public async hideHighlight(world: chrome.scripting.ExecutionWorld = 'MAIN'): Promise<void> {
    return this.executeScript(() => {
      const injected = window.__cordyceps_handledInjectedScript;
      return injected.hideHighlight();
    }, world);
  }

  /**
   * Mark target elements for debugging/tracing purposes.
   * This method provides access to the underlying InjectedScript's markTargetElements functionality.
   */
  public async markTargetElements(
    elementHandles: string[],
    callId: string,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<void> {
    return this.executeScript(
      (handles: string[], callId: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        const elements = new Set<Element>();

        for (const handle of handles) {
          const element = injected.getElementByHandle(handle);
          if (element) {
            elements.add(element);
          }
        }

        if (elements.size > 0) {
          injected.markTargetElements(elements, callId);
        }
      },
      world,
      elementHandles,
      callId
    );
  }

  /**
   * Creates a new file transfer port in the content script for transferring files.
   * @param world The execution world to run the script in
   * @returns The port ID that can be used to communicate with the created port
   */
  public async createFileTransferPort(
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<string | undefined> {
    const portId = await this.executeScript(() => {
      const injected = window.__cordyceps_handledInjectedScript;
      const portId = injected.createFileTransferPort();
      return portId;
    }, world);

    return portId;
  }

  /**
   * Sets files on an input element using its handle, following Playwright patterns.
   * This method automatically chooses the appropriate file transfer mechanism:
   * - MAIN world: Direct base64 conversion and DOM manipulation
   * - ISOLATED world: Port-based buffer transfer system
   *
   * @param handle The element handle for the input element
   * @param files Array of file payloads to set
   * @param options Options for the operation
   * @param world The execution world to run the script in
   * @returns Result of the operation
   */
  public async setInputFiles(
    handle: string,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[],
    options: { force?: boolean; directoryUpload?: boolean } = {},
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<
    | {
        success: boolean;
        error?: string;
        filesSet: number;
      }
    | undefined
  > {
    // Route to appropriate implementation based on execution world
    if (world === 'MAIN') {
      return this.setInputFilesWithBase64(handle, files, options, world);
    } else {
      return this._setInputFilesWithPorts(handle, files, options, world);
    }
  }

  /**
   * Sets files on an input element using the port-based transfer system.
   * This is the original implementation that works in ISOLATED world.
   */
  private async _setInputFilesWithPorts(
    handle: string,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[],
    options: { force?: boolean; directoryUpload?: boolean } = {},
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<
    | {
        success: boolean;
        error?: string;
        filesSet: number;
      }
    | undefined
  > {
    // Enforce ISOLATED world for port-based file operations
    if (world !== 'MAIN') {
      throw new Error(
        'Port-based file operations must run in ISOLATED world for Chrome extension security'
      );
    }

    // 1) Create a file transfer port in the content script
    const portId = await this.createFileTransferPort(world);
    if (!portId) {
      throw new Error('Failed to create file transfer port');
    }

    // 2) Wait for the port connection to be established in the side panel
    let portConnection = this.frame.fileTransferPortController.getPort(portId);
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait

    while (!portConnection && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      portConnection = this.frame.fileTransferPortController.getPort(portId);
      attempts++;
    }

    if (!portConnection) {
      throw new Error('Failed to establish port connection');
    }
    // 3) Transfer each file buffer via the port
    const transferIds: string[] = [];

    for (const file of files) {
      const transferId = await portConnection.sendBuffer(file.buffer, {
        filename: file.name,
        mimeType: file.mimeType,
      });

      transferIds.push(transferId);
    }

    const result = await this.executeScript(
      (
        handle: string,
        portId: string,
        transferIds: string[],
        options: { force?: boolean; directoryUpload?: boolean }
      ) => {
        const injected = window.__cordyceps_handledInjectedScript;
        const port = injected.fileTransferPortManager.getPort(portId);
        if (!port) {
          return { success: false, error: 'Transfer port not found', filesSet: 0 };
        }

        // Build files array from incoming buffers
        const built: { name: string; mimeType: string; buffer: ArrayBuffer }[] = [];
        for (const id of transferIds) {
          const data = port.getIncomingBuffer(id);
          if (!data) {
            return { success: false, error: 'Missing transferred data', filesSet: 0 };
          }

          built.push({ name: data.name, mimeType: data.mimeType, buffer: data.buffer });
        }

        const result = injected.setInputFiles(handle, built, options);
        return result;
      },
      world,
      handle,
      portId,
      transferIds,
      options
    );

    return result;
  }

  /**
   * Sets input files using base64 conversion instead of port-based transfer.
   * This method is designed for MAIN world operations where port infrastructure
   * is not available or desired. Files are converted to base64 and passed
   * directly as script arguments.
   *
   * @param handle Element handle for the input element
   * @param files Array of file payloads to set
   * @param options Options for the operation
   * @param world Execution world (should be 'MAIN' for this method)
   * @returns Result of the operation
   */
  public async setInputFilesWithBase64(
    handle: string,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[],
    options: { force?: boolean; directoryUpload?: boolean } = {},
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<{ success: boolean; error?: string; filesSet: number }> {
    try {
      // 1) Convert files to base64 format
      const base64Files: Base64FileData[] = [];
      for (const file of files) {
        const base64 = arrayBufferToBase64(file.buffer);
        base64Files.push({
          name: file.name,
          mimeType: file.mimeType,
          size: file.buffer.byteLength,
          base64,
        });
      }

      // 2) Execute script directly with base64 data
      const result = await this.executeScript(
        (
          handle: string,
          base64Files: Base64FileData[],
          options: { force?: boolean; directoryUpload?: boolean }
        ) => {
          // Check if MAIN world injected script is available
          const injected = window.__cordyceps_handledInjectedScript;

          if (!injected) {
            return {
              success: false,
              error: 'HandledInjectedScript not available in MAIN world',
              filesSet: 0,
            };
          }

          // Convert base64 files back to ArrayBuffer format expected by setInputFiles
          const reconstructedFiles: { name: string; mimeType: string; buffer: ArrayBuffer }[] = [];
          for (const base64File of base64Files) {
            try {
              // Convert base64 back to ArrayBuffer
              const binaryString = atob(base64File.base64);
              const length = binaryString.length;
              const bytes = new Uint8Array(length);

              for (let i = 0; i < length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }

              reconstructedFiles.push({
                name: base64File.name,
                mimeType: base64File.mimeType,
                buffer: bytes.buffer,
              });
            } catch (error) {
              return {
                success: false,
                error: `Failed to reconstruct file: ${base64File.name}`,
                filesSet: 0,
              };
            }
          }

          // Call the MAIN world setInputFiles method
          const result = injected.setInputFiles(handle, reconstructedFiles, options);

          return result;
        },
        world,
        handle,
        base64Files,
        options
      );

      return (
        result || {
          success: false,
          error: 'Script execution returned undefined result',
          filesSet: 0,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: `Base64 file transfer failed: ${errorMessage}`,
        filesSet: 0,
      };
    }
  }

  /**
   * Execute a registered element function with strong typing.
   * This provides a generic way to call domain-specific functions on elements.
   *
   * @param handle Element handle from HandledInjectedScript
   * @param request Function name and arguments
   * @param world Execution world
   * @returns Result of the function execution
   */
  public async executeElementFunction<TArgs, TResult>(
    handle: string,
    request: ElementOperationRequest<TArgs>,
    world: chrome.scripting.ExecutionWorld = 'MAIN'
  ): Promise<ElementOperationResult<TResult> | undefined> {
    try {
      const result = await this.executeScript(
        executeGenericElementFunction<TArgs, TResult>,
        world,
        handle,
        request
      );
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
      };
    }
  }

  public toString(): string {
    return `FrameExecutionContext@${this.frame.frameId}`;
  }
}
