import { Disposable } from 'vs/base/common/lifecycle';
import type { FrameExecutionContext } from './core/frameExecutionContext';
import {
  Rect,
  WaitForElementOptions,
  ClickOptions,
  TimeoutOptions,
  SelectOption,
  SelectOptionOptions,
  CommonActionOptions,
  ScreenshotOptions,
} from './utilities/types';
import { Progress, executeWithProgress } from './core/progress';
import { Frame } from './frame';
import { convertToNodeBuffer } from './utilities/bufferUtils';
import {
  throwRetargetableDOMError,
  throwElementIsNotAttached,
  OperationResult,
  STANDARD_TIMEOUT,
} from './utilities/utils';
import { ElementAction, executeElementOp } from './operations/elementOperations';
import { ElementOperationRequest } from './operations/genericElementOperations';
import {
  executeElementOperation,
  createFillElementScript,
  createSelectOptionScript,
  createSelectTextScript,
  createKeyboardEventScript,
  isPrintableKey,
  normalizeSelectOptions,
  isElementDisconnected,
  extractErrorMessage,
  createScrollIntoViewScript,
  createOperationFailedError,
  createInteractionError,
  isOperationSuccessful,
  isResultDisconnected,
  createDelayPromise,
  requiresEnhancedInteraction,
  createCheckboxStateError,
} from './utilities/elementHandleUtils';

// This needs to know it's world, tab id, frame id, and element id that
// exists in the dom
export class JSHandle extends Disposable {
  public readonly remoteObject: string;
  protected readonly _context: FrameExecutionContext;

  constructor(context: FrameExecutionContext, remoteObject: string) {
    super();
    this._context = context;
    this.remoteObject = remoteObject;
  }

  public get context(): FrameExecutionContext {
    return this._context;
  }

  public toString(): string {
    return this.remoteObject;
  }
}

export class ElementHandle extends JSHandle {
  public readonly frame;

  constructor(context: FrameExecutionContext, remoteObject: string) {
    super(context, remoteObject);
    this.frame = context.frame;
  }

  async waitForSelector(
    progress: Progress,
    selector: string,
    options: WaitForElementOptions
  ): Promise<ElementHandle | null> {
    return await this.frame.waitForSelector(progress, selector, true, options, this);
  }

  async boundingBox(): Promise<Rect | null> {
    try {
      const result = await this._context.getBoundingBox(this.remoteObject);
      return result || null;
    } catch (e) {
      // Handle disconnected elements or other errors
      return null;
    }
  }

  async check(options?: {
    force?: boolean;
    position?: { x: number; y: number };
    timeout?: number;
  }): Promise<void> {
    return executeElementOperation(
      async progress => await this._setChecked(progress, true),
      'Check',
      options?.timeout
    );
  }

  async uncheck(options?: {
    force?: boolean;
    position?: { x: number; y: number };
    timeout?: number;
  }): Promise<void> {
    return executeElementOperation(
      async progress => await this._setChecked(progress, false),
      'Uncheck',
      options?.timeout
    );
  }

  async click(options?: ClickOptions): Promise<void> {
    return executeElementOperation(
      async progress => await this._click(progress, options),
      'Click',
      options?.timeout
    );
  }

  async clickWithProgress(progress: Progress, options?: ClickOptions): Promise<void> {
    const result = await this._click(progress, options);
    if (result !== 'done') {
      throw new Error(createOperationFailedError('Click', result));
    }
  }

  async clickSimple(): Promise<void> {
    return executeWithProgress(
      async progress => {
        const result = await this._click(progress);
        if (result !== 'done') {
          throw new Error(createOperationFailedError('Click', result));
        }
      },
      { timeout: 30000 }
    );
  }

  async _click(progress: Progress, options?: ClickOptions): Promise<'error:notconnected' | 'done'> {
    // Use enhanced click if options are provided
    if (requiresEnhancedInteraction(options)) {
      const clickResult = await progress.race(
        this._context.clickElementWithOptions(this.remoteObject, {
          position: options?.position,
          force: options?.force,
          button: options?.button,
          clickCount: options?.clickCount,
        })
      );

      if (isResultDisconnected(clickResult)) {
        return 'error:notconnected';
      }

      if (!isOperationSuccessful(clickResult)) {
        throw new Error(createInteractionError('click', clickResult?.error));
      }

      // Handle delay if specified
      if (options?.delay) {
        await progress.race(createDelayPromise(options.delay));
      }

      return 'done';
    }

    // Use simple click for basic cases
    const clickResult = await progress.race(this._context.clickElement(this.remoteObject));
    if (isResultDisconnected(clickResult)) {
      return 'error:notconnected';
    }

    if (!isOperationSuccessful(clickResult)) {
      throw new Error(createInteractionError('click', clickResult?.error));
    }

    return 'done';
  }

  async dblclick(options?: ClickOptions): Promise<void> {
    return executeElementOperation(
      async progress => await this._dblclick(progress, options),
      'Double click',
      options?.timeout
    );
  }

  async dblclickWithProgress(progress: Progress, options?: ClickOptions): Promise<void> {
    const result = await this._dblclick(progress, options);
    if (result !== 'done') {
      throw new Error(createOperationFailedError('Double click', result));
    }
  }

  async _dblclick(
    progress: Progress,
    options?: ClickOptions
  ): Promise<'error:notconnected' | 'done'> {
    // Merge options with clickCount: 2 for double click
    const dblclickOptions: ClickOptions = {
      ...options,
      clickCount: 2,
    };

    // Use the existing _click method with modified options
    return await this._click(progress, dblclickOptions);
  }

  async tap(options?: ClickOptions): Promise<void> {
    return executeElementOperation(
      async progress => await this._tap(progress, options),
      'Tap',
      options?.timeout
    );
  }

  async tapWithProgress(progress: Progress, options?: ClickOptions): Promise<void> {
    await this._markAsTargetElement(progress);
    const result = await this._tap(progress, options);
    if (result !== 'done') {
      throw new Error(createOperationFailedError('Tap', result));
    }
  }

  async _tap(progress: Progress, options?: ClickOptions): Promise<'error:notconnected' | 'done'> {
    progress.log('  tap()');

    // Use enhanced tap if options are provided
    if (requiresEnhancedInteraction(options)) {
      const tapResult = await progress.race(
        this._context.tapElementWithOptions(this.remoteObject, {
          position: options?.position,
          force: options?.force,
          // Note: button and clickCount may not apply to touch interactions
          // but we keep them for consistency with click options
        })
      );

      if (isResultDisconnected(tapResult)) {
        return 'error:notconnected';
      }

      if (!isOperationSuccessful(tapResult)) {
        throw new Error(createInteractionError('tap', tapResult?.error));
      }

      // Handle delay if specified
      if (options?.delay) {
        await progress.race(createDelayPromise(options.delay));
      }

      return 'done';
    }

    // Use simple tap for basic cases
    const tapResult = await progress.race(this._context.tapElement(this.remoteObject));
    if (isResultDisconnected(tapResult)) {
      return 'error:notconnected';
    }

    if (!isOperationSuccessful(tapResult)) {
      throw new Error(createInteractionError('tap', tapResult?.error));
    }

    return 'done';
  }

  async checkWithProgress(progress: Progress): Promise<void> {
    const result = await this._setChecked(progress, true);
    if (result !== 'done') {
      throw new Error(createOperationFailedError('Check', result));
    }
  }

  async uncheckWithProgress(progress: Progress): Promise<void> {
    const result = await this._setChecked(progress, false);
    if (result !== 'done') {
      throw new Error(createOperationFailedError('Uncheck', result));
    }
  }

  async _setChecked(progress: Progress, state: boolean): Promise<'error:notconnected' | 'done'> {
    // Helper function to check current state
    const isChecked = async (): Promise<boolean> => {
      const result = await progress.race(this._context.isChecked(this.remoteObject));
      if (result === undefined) {
        throwElementIsNotAttached();
      }
      return result;
    };

    // Check if element is already in the desired state
    const currentState = await isChecked();
    if (currentState === state) {
      return 'done';
    }

    // Attempt to set the checked state
    const setResult = await progress.race(this._context.setChecked(this.remoteObject, state));
    if (!setResult) {
      return 'error:notconnected';
    }

    if (!isOperationSuccessful(setResult)) {
      throw new Error(createInteractionError('set checked state', setResult?.error));
    }

    // If a click is needed to change the state, perform the click
    if (setResult.needsClick) {
      const clickResult = await progress.race(this._context.clickElement(this.remoteObject));
      if (!clickResult) {
        return 'error:notconnected';
      }

      if (!isOperationSuccessful(clickResult)) {
        throw new Error(createInteractionError('click element', clickResult?.error));
      }

      // Verify the state changed after clicking
      const newState = await isChecked();
      if (newState !== state) {
        throw new Error(createCheckboxStateError());
      }
    }

    return 'done';
  }

  async boundingBoxWithProgress(progress: Progress): Promise<Rect | null> {
    const value = await progress.race(this.boundingBox());
    return value || null;
  }

  async isIframeElement(): Promise<boolean | 'error:notconnected'> {
    try {
      const resultHandle = await this._context.evaluateHandle(
        (handle: string): string | null => {
          const injectedScript = window.__cordyceps_handledInjectedScript;
          const el = injectedScript.getElementByHandle(handle);
          if (el && (el.nodeName === 'IFRAME' || el.nodeName === 'FRAME')) {
            return handle;
          }
          return null;
        },
        'MAIN',
        this.remoteObject
      );
      return !!resultHandle;
    } catch (e) {
      return 'error:notconnected';
    }
  }

  async _dispatchEvent(
    progress: Progress,
    type: string,
    eventInit: Record<string, unknown> = {}
  ): Promise<'error:notconnected' | 'done'> {
    const result = await progress.race(
      this._context.dispatchEvent(this.remoteObject, type, eventInit)
    );

    if (!result) {
      return 'error:notconnected';
    }

    if (!isOperationSuccessful(result)) {
      throw new Error(createInteractionError('dispatch event', result?.error));
    }

    return 'done';
  }

  async dispatchEvent(type: string, eventInit: Record<string, unknown> = {}): Promise<void> {
    return executeElementOperation(
      async progress => await this._dispatchEvent(progress, type, eventInit),
      'Dispatch event'
    );
  }

  async dispatchEventWithProgress(
    progress: Progress,
    type: string,
    eventInit: Record<string, unknown> = {}
  ): Promise<void> {
    const result = await this._dispatchEvent(progress, type, eventInit);
    if (result !== 'done') {
      throw new Error(createOperationFailedError('Dispatch event', result));
    }
  }

  async contentFrame(): Promise<Frame | null> {
    const isFrameElement = throwRetargetableDOMError(await this.isIframeElement());
    if (!isFrameElement) return null;
    return this.frame.frameManager.page.getContentFrame(this);
  }

  async fill(value: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    return executeElementOperation(
      async progress => await this._fill(progress, value, options),
      'Fill',
      options?.timeout
    );
  }

  async fillWithProgress(
    progress: Progress,
    value: string,
    options?: { force?: boolean }
  ): Promise<void> {
    const result = await this._fill(progress, value, options);
    if (result !== 'done') {
      throw new Error(createOperationFailedError('Fill', result));
    }
  }

  async _fill(
    progress: Progress,
    value: string,
    options?: { force?: boolean }
  ): Promise<'error:notconnected' | 'done'> {
    progress.log(`  fill("${value}")`);

    // Use the extracted fill element script
    const fillElement = createFillElementScript();

    try {
      const result = await progress.race(
        this._context.executeScript(
          fillElement,
          'MAIN',
          this.remoteObject,
          value,
          options?.force || false
        )
      );
      return result === 'done' ? 'done' : 'error:notconnected';
    } catch (error) {
      console.error('Fill operation failed:', error);
      return 'error:notconnected';
    }
  }

  async clear(options?: { timeout?: number; force?: boolean }): Promise<void> {
    return this.fill('', { ...options });
  }

  async clearWithProgress(progress: Progress, options?: { force?: boolean }): Promise<void> {
    return this.fillWithProgress(progress, '', options);
  }

  private async _executeElementOp<T>(action: ElementAction): Promise<T> {
    return await executeWithProgress(
      async () => {
        const result = await this._context.executeScript(
          executeElementOp,
          'MAIN',
          this.remoteObject,
          action
        );
        return result as T;
      },
      { timeout: STANDARD_TIMEOUT }
    );
  }

  async setChecked(
    checked: boolean,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number }
  ): Promise<void> {
    if (checked) {
      await this.check(options);
    } else {
      await this.uncheck(options);
    }
  }
  async selectOption(
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions
  ): Promise<string[]> {
    return executeWithProgress(
      async progress => {
        const result = await this._selectOption(progress, values, options);
        return throwRetargetableDOMError(result);
      },
      { timeout: options?.timeout || STANDARD_TIMEOUT }
    );
  }

  async selectOptionWithProgress(
    progress: Progress,
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions
  ): Promise<string[]> {
    const result = await this._selectOption(progress, values, options);
    return throwRetargetableDOMError(result);
  }

  async _selectOption(
    progress: Progress,
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions
  ): Promise<string[] | 'error:notconnected'> {
    const valuesArray = normalizeSelectOptions(values);
    progress.log(`  selectOption(${JSON.stringify(valuesArray)})`);

    // Use the extracted select option script
    const selectOptionScript = createSelectOptionScript();

    try {
      const result = await progress.race(
        this._context.evaluate(
          selectOptionScript,
          'MAIN',
          this.remoteObject,
          valuesArray,
          options?.force || false
        )
      );

      if (isElementDisconnected(result)) {
        return 'error:notconnected';
      }

      // If the page-side script returned a structured error, rethrow here so callers can catch
      const errorMessage = extractErrorMessage(result);
      if (errorMessage) {
        throw new Error(errorMessage);
      }

      return result as string[];
    } catch (error) {
      if (error instanceof Error && error.message.includes('Element not found')) {
        return 'error:notconnected';
      }
      throw error;
    }
  }

  async selectText(options?: CommonActionOptions): Promise<void> {
    return executeElementOperation(
      async progress => await this._selectText(progress, options),
      'SelectText',
      options?.timeout
    );
  }

  async selectTextWithProgress(progress: Progress, options?: CommonActionOptions): Promise<void> {
    const result = await this._selectText(progress, options);
    if (result !== 'done') {
      throw new Error(createOperationFailedError('SelectText', result));
    }
  }

  async _selectText(
    progress: Progress,
    options?: CommonActionOptions
  ): Promise<'error:notconnected' | 'done'> {
    progress.log('  selectText()');

    // Use the extracted select text script
    const selectTextScript = createSelectTextScript();

    try {
      const result = await progress.race(
        this._context.evaluate(selectTextScript, 'MAIN', this.remoteObject, options?.force || false)
      );

      if (isElementDisconnected(result)) {
        return 'error:notconnected';
      }

      return 'done';
    } catch (error) {
      if (error instanceof Error && error.message.includes('Element not found')) {
        return 'error:notconnected';
      }
      throw error;
    }
  }
  async getTextContent(): Promise<string> {
    const result = await this._executeElementOp<string>({ op: 'get', prop: 'textContent' });
    return result;
  }

  async getInnerText(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'innerText' });
  }

  async getValue(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'value' });
  }

  async isChecked(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'checked' });
  }

  async getTagName(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'tagName' });
  }

  async getInnerHTML(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'innerHTML' });
  }

  async getOuterHTML(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'outerHTML' });
  }

  async getClassName(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'className' });
  }

  async getId(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'id' });
  }

  async setValue(value: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'set', prop: 'value', value });
  }

  /**
   * Set text content - simple and clean
   * Replaces: await handle.evaluate((el, text) => { el.textContent = text; }, newText)
   * With: await handle.setTextContent(newText)
   */
  async setTextContent(text: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'set', prop: 'textContent', value: text });
  }

  async getAttribute(name: string): Promise<string | null> {
    return this._executeElementOp<string | null>({ op: 'attr', name });
  }

  async setAttribute(name: string, value: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'attr', name, value });
  }

  async removeAttribute(name: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'attr', name, value: null });
  }

  async hasAttribute(name: string): Promise<boolean> {
    return await executeWithProgress(
      async () => {
        const result = await this.getAttribute(name);
        return result !== null;
      },
      { timeout: STANDARD_TIMEOUT }
    );
  }

  async hasClass(className: string): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'class', name: className, action: 'has' });
  }

  async addClass(className: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'class', name: className, action: 'add' });
  }

  async removeClass(className: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'class', name: className, action: 'remove' });
  }

  async toggleClass(className: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'class', name: className, action: 'toggle' });
  }

  async getBoundingRect(): Promise<DOMRect> {
    return this._executeElementOp<DOMRect>({ op: 'rect' });
  }

  async isVisible(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isVisible' });
  }

  private async _markAsTargetElement(progress: Progress): Promise<void> {
    // Only mark if we have a valid progress metadata id
    // Note: Progress interface may not expose metadata directly, so we check if it exists
    const progressWithMetadata = progress as Progress & { metadata?: { id?: string } };
    if (!progressWithMetadata.metadata?.id) {
      return;
    }

    try {
      await progress.race(
        this._context.markTargetElements([this.remoteObject], progressWithMetadata.metadata.id)
      );
    } catch (error) {
      // Silently ignore marking errors to not interfere with the main operation
      progress.log(
        `Warning: Failed to mark target element: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async isEnabled(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isEnabled' });
  }

  async isFocused(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isFocused' });
  }

  async focus(): Promise<void> {
    await this._executeElementOp<void>({ op: 'action', name: 'focus' });
  }

  async blur(): Promise<void> {
    await this._executeElementOp<void>({ op: 'action', name: 'blur' });
  }

  async clickElement(): Promise<void> {
    await this._executeElementOp<void>({ op: 'action', name: 'click' });
  }

  async hover(): Promise<void> {
    await this._executeElementOp<void>({ op: 'action', name: 'hover' });
  }

  async inputValue(): Promise<string> {
    return this.getValue();
  }
  async attribute(name: string): Promise<string | null> {
    return this.getAttribute(name);
  }

  async isDisabled(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'disabled' });
  }

  async isHidden(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isHidden' });
  }

  async isEditable(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isEditable' });
  }

  async press(key: string, options: { delay?: number } = {}): Promise<void> {
    await executeWithProgress(
      async progress => {
        // Ensure focus
        await this.focus();
        const isPrintableChar = isPrintableKey(key);
        const keyboardEventScript = createKeyboardEventScript();

        const dispatch = async (type: string) => {
          const result = await this._context.executeScript(
            keyboardEventScript,
            'MAIN',
            this.remoteObject,
            type,
            key,
            isPrintableChar
          );
          return result;
        };

        await dispatch('keydown');
        if (isPrintableChar) await dispatch('keypress');
        if (options.delay) await progress.race(new Promise(r => setTimeout(r, options.delay)));
        await dispatch('keyup');
      },
      { timeout: STANDARD_TIMEOUT }
    );
  }

  async type(text: string, options: { delay?: number } = {}): Promise<void> {
    await executeWithProgress(
      async progress => {
        progress.log(`elementHandle.type("${text}")`);

        // Ensure focus first (similar to Playwright's _focus call)
        await this.focus();

        // Type each character with delay
        for (const char of text) {
          await this.press(char, { delay: 0 }); // Individual character press without delay

          // Apply delay between characters if specified
          if (options.delay && options.delay > 0) {
            await progress.race(new Promise(resolve => setTimeout(resolve, options.delay)));
          }
        }
      },
      { timeout: STANDARD_TIMEOUT }
    );
  }

  /** Convenience alias for getInnerHTML */
  async innerHTML(): Promise<string> {
    return this.getInnerHTML();
  }
  /** Convenience alias for getInnerText */
  async innerText(): Promise<string> {
    return this.getInnerText();
  }
  /** Convenience alias for getTextContent */
  async textContent(): Promise<string> {
    const result = await this.getTextContent();
    return result;
  }

  // #endregion Simple Element Operations

  async scrollIntoViewIfNeeded(options: TimeoutOptions = {}): Promise<void> {
    return executeElementOperation(
      async progress => await this._scrollIntoViewIfNeeded(progress),
      'ScrollIntoViewIfNeeded',
      options?.timeout
    );
  }

  private async _scrollIntoViewIfNeeded(progress: Progress): Promise<OperationResult> {
    try {
      const scrollIntoViewScript = createScrollIntoViewScript();
      const result = await progress.race(
        this._context.executeScript(scrollIntoViewScript, 'MAIN', this.remoteObject)
      );

      if (!result) {
        return 'error:notconnected';
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to scroll element into view');
      }

      return 'done';
    } catch (error) {
      if (error instanceof Error && error.message.includes('not attached')) {
        return 'error:notconnected';
      }
      throw error;
    }
  }

  /**
   * Generates an ARIA snapshot for this element.
   *
   * @param options Configuration options for the ARIA snapshot
   * @returns A string representation of the ARIA accessibility tree
   */
  async ariaSnapshot(options?: {
    forAI?: boolean;
    refPrefix?: string;
    timeout?: number;
  }): Promise<string> {
    const forAI = options?.forAI ?? true;
    const refPrefix = options?.refPrefix ?? '';
    const timeout = options?.timeout ?? 30000;

    return executeWithProgress(
      async () => {
        const result = await this._context.ariaSnapshot(forAI, refPrefix, 'MAIN', this);
        return typeof result === 'string' ? result : '';
      },
      { timeout }
    );
  }

  /**
   * Sets files on this input element, following Playwright patterns.
   * This method provides a high-level interface for setting files with proper validation and progress tracking.
   *
   * @param files Array of file payloads or File objects to set
   * @param options Options for the operation, including execution world
   * @returns Promise that resolves when files are set
   */
  async setInputFiles(
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[] | File[],
    options?: {
      force?: boolean;
      directoryUpload?: boolean;
      timeout?: number;
      world?: chrome.scripting.ExecutionWorld;
    }
  ): Promise<void> {
    const timeout = options?.timeout ?? 30000;

    return executeWithProgress(
      async progress => {
        return this.setInputFilesWithProgress(progress, files, options);
      },
      { timeout }
    );
  }

  /**
   * Set files on this input element - version that returns OperationResult for Locator use.
   * @internal
   */
  async _setInputFiles(
    progress: Progress,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[] | File[],
    options?: {
      force?: boolean;
      directoryUpload?: boolean;
      world?: chrome.scripting.ExecutionWorld;
    }
  ): Promise<OperationResult> {
    try {
      await this.setInputFilesWithProgress(progress, files, options);
      return 'done';
    } catch (error) {
      if (error instanceof Error && error.message.includes('not attached')) {
        return 'error:notconnected';
      }
      throw error;
    }
  }

  /**
   * Sets files on this input element with progress tracking.
   * This is the core implementation that handles validation and file setting.
   *
   * @param progress Progress tracker for the operation
   * @param files Array of file payloads or File objects to set
   * @param options Options for the operation
   * @returns Promise that resolves when files are set
   */
  async setInputFilesWithProgress(
    progress: Progress,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[] | File[],
    options?: {
      force?: boolean;
      directoryUpload?: boolean;
      world?: chrome.scripting.ExecutionWorld;
    }
  ): Promise<void> {
    progress.log(`setInputFiles(${files.length} files)`);

    // Convert File objects to our payload format if needed
    const filePayloads = await this._convertToFilePayloads(files);

    // Determine execution world - use MAIN by default for better performance
    const world = options?.world ?? 'MAIN';

    // Set the files on the input element
    const result = await progress.race(
      this._context.setInputFiles(
        this.remoteObject,
        filePayloads,
        {
          force: options?.force,
          directoryUpload: options?.directoryUpload,
        },
        world
      )
    );

    if (!result?.success) {
      throw new Error(`Failed to set input files: ${result?.error || 'Unknown error'}`);
    }

    progress.log(`✓ Set ${result.filesSet} files on input element`);
  }

  /**
   * Converts File objects or file payloads to a consistent format.
   * This handles both File objects (from file inputs) and our custom payload format.
   */
  private async _convertToFilePayloads(
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[] | File[]
  ): Promise<{ name: string; mimeType: string; buffer: ArrayBuffer }[]> {
    const payloads: { name: string; mimeType: string; buffer: ArrayBuffer }[] = [];

    for (const file of files) {
      if (file instanceof File) {
        // Convert File object to our payload format
        const buffer = await file.arrayBuffer();
        payloads.push({
          name: file.name,
          mimeType: file.type,
          buffer,
        });
      } else {
        // Already in our payload format
        payloads.push(file);
      }
    }

    return payloads;
  }

  async screenshot(progress: Progress, options: ScreenshotOptions): Promise<Buffer> {
    // Delegate to the page-level screenshotter for element screenshots
    const page = this.frame.frameManager.page;
    const bufferLike = await page.screenshotter.screenshotElement(progress, this, options);
    // Convert BrowserBuffer to Node.js Buffer for compatibility
    return convertToNodeBuffer(bufferLike);
  }

  /**
   * Execute a registered element function with strong typing.
   * This allows calling domain-specific functions on this element.
   *
   * @param functionName Name of the registered function to call
   * @param args Arguments to pass to the function
   * @param options Execution options including timeout
   * @returns Result of the function execution
   */
  async executeFunction<TArgs, TResult>(
    functionName: string,
    args?: TArgs,
    options?: { timeout?: number; world?: chrome.scripting.ExecutionWorld }
  ): Promise<TResult> {
    return executeWithProgress(
      async (_progress: Progress) => {
        const request: ElementOperationRequest<TArgs> = {
          functionName,
          args,
          timeout: options?.timeout,
        };

        const result = await this._context.executeElementFunction<TArgs, TResult>(
          this.remoteObject,
          request,
          options?.world
        );

        if (!result) {
          throw new Error('Function execution failed - no result returned');
        }

        if (!result.success) {
          throw new Error(result.error || 'Function execution failed');
        }

        return result.result;
      },
      { timeout: options?.timeout || STANDARD_TIMEOUT }
    );
  }
}
