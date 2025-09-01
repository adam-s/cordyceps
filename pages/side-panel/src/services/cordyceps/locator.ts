import { isString } from '@injected/isomorphic/stringUtils';
import {
  getByTestIdSelector,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByTextSelector,
  getByTitleSelector,
  ByRoleOptions,
  getByRoleSelector,
} from '@injected/isomorphic/locatorUtils';
import { asLocator } from '@injected/isomorphic/locatorGenerators';
import { Frame, FrameLocator } from './frame';
import { testIdAttributeName } from './utilities/frameUtils';
import {
  Rect,
  TimeoutOptions,
  ClickOptions,
  SelectOption,
  SelectOptionOptions,
  CommonActionOptions,
  WaitForElementOptions,
  FrameDragAndDropOptions,
} from './utilities/types';
import { ElementHandle } from './elementHandle';
import { executeWithProgress } from './core/progress';
import type { FilePayload } from '@shared/utils/fileInputTypes';
import {
  executeProgressElementOperation,
  buildSelectorWithOptions,
  createAndSelector,
  createOrSelector,
  validateSameFrame,
  createFirstSelector,
  createLastSelector,
  createNthSelector,
  createDragAndDropFrameError,
  createChainedSelector,
  createInternalChainSelector,
  createFrameLocatorSelector,
  DEFAULT_LOCATOR_TIMEOUT,
  resolveTimeout,
  createLocatorElementNotFoundError,
  executeElementMethodWithProgress,
  executeWithElementHandle,
} from './utilities/locatorUtils';

export type LocatorOptions = {
  hasText?: string | RegExp;
  hasNotText?: string | RegExp;
  has?: Locator;
  hasNot?: Locator;
  visible?: boolean;
};

export class Locator {
  _frame: Frame;
  _selector: string;
  private _description?: string;

  constructor(frame: Frame, selector: string, options?: LocatorOptions) {
    this._frame = frame;
    this._selector = options ? buildSelectorWithOptions(selector, options, frame) : selector;
  }

  _equals(locator: Locator) {
    return this._frame === locator._frame && this._selector === locator._selector;
  }

  page() {
    return this._frame.frameManager.page;
  }

  private async _withElement<R>(
    task: (handle: ElementHandle) => Promise<R>,
    options: { title: string; internal?: boolean; timeout?: number }
  ): Promise<R> {
    return executeWithElementHandle(this._frame, this._selector, task, {
      title: options.title,
      timeout: options.timeout,
      state: 'attached',
    });
  }

  /**
   * Execute an element method with clean error handling and progress tracking
   */
  private async _executeElementMethod<T>(
    methodName: keyof ElementHandle,
    ...args: unknown[]
  ): Promise<T> {
    return executeElementMethodWithProgress<T>(
      this._frame,
      this._selector,
      methodName as string,
      args,
      DEFAULT_LOCATOR_TIMEOUT
    );
  }

  async boundingBox(options?: TimeoutOptions): Promise<Rect | null> {
    return await this._withElement(h => h.boundingBox(), {
      title: 'Bounding box',
      timeout: options?.timeout,
    });
  }

  async check(options?: {
    force?: boolean;
    position?: { x: number; y: number };
    timeout?: number;
  }): Promise<void> {
    return this._executeElementMethod<void>('check', options);
  }

  async uncheck(options?: {
    force?: boolean;
    position?: { x: number; y: number };
    timeout?: number;
  }): Promise<void> {
    return this._executeElementMethod<void>('uncheck', options);
  }

  async fill(value: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    return await this._withElement(h => h.fill(value, options), {
      title: 'Fill',
      timeout: resolveTimeout(options?.timeout),
    });
  }

  async clear(options?: { timeout?: number; force?: boolean }): Promise<void> {
    return await this._withElement(h => h.clear(options), {
      title: 'Clear',
      timeout: resolveTimeout(options?.timeout),
    });
  }

  /**
   * Set files on an input element.
   * Similar to Playwright's Locator.setInputFiles method.
   *
   * @example
   * ```typescript
   * await locator.setInputFiles([file1, file2]);
   *
   * await locator.setInputFiles([
   *   { name: 'data.json', mimeType: 'application/json', buffer: jsonBuffer }
   * ]);
   *
   * // Use ISOLATED world for complex file operations
   * await locator.setInputFiles([file1], { world: 'ISOLATED' });
   * ```
   */
  async setInputFiles(
    files: FilePayload[] | File[],
    options?: {
      force?: boolean;
      directoryUpload?: boolean;
      timeout?: number;
      world?: chrome.scripting.ExecutionWorld;
    }
  ): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._setInputFiles(progress, files, options),
      'Set input files',
      options?.timeout
    );
  }

  async highlight(options?: { timeout?: number }): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const context = await this._frame.getContext(progress);
        await context.highlight(this._selector);
      },
      { timeout: resolveTimeout(options?.timeout) }
    );
  }

  async hideHighlight(): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const context = await this._frame.getContext(progress);
        await context.hideHighlight();
      },
      { timeout: DEFAULT_LOCATOR_TIMEOUT }
    );
  }

  async click(options?: ClickOptions): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._click(progress, options),
      'Click',
      options?.timeout
    );
  }

  async dblclick(options?: ClickOptions): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._dblclick(progress, options),
      'Double Click',
      options?.timeout
    );
  }

  async tap(options?: ClickOptions): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._tap(progress, options),
      'Tap',
      options?.timeout
    );
  }

  async dispatchEvent(
    type: string,
    eventInit: Record<string, unknown> = {},
    options?: { timeout?: number }
  ): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._dispatchEvent(progress, type, eventInit),
      'Dispatch Event',
      options?.timeout
    );
  }

  /**
   * Perform a drag and drop operation from this locator to the target locator.
   *
   * @param target The target locator to drop the element onto
   * @param options Optional drag and drop configuration
   * @returns Promise that resolves when drag and drop is complete
   *
   * @example
   * ```typescript
   * const source = page.locator('#draggable-item');
   * const target = page.locator('#drop-zone');
   *
   * // Basic drag and drop
   * await source.dragTo(target);
   *
   * // With custom positions and options
   * await source.dragTo(target, {
   *   sourcePosition: { x: 10, y: 10 },
   *   targetPosition: { x: 50, y: 50 },
   *   timeout: 10000
   * });
   * ```
   */
  async dragTo(
    target: Locator,
    options: FrameDragAndDropOptions & { timeout?: number } = {}
  ): Promise<void> {
    // Check if both locators are on the same frame
    if (this._frame !== target._frame) {
      throw createDragAndDropFrameError();
    }

    return await this._frame.dragAndDrop(this._selector, target._selector, {
      strict: true,
      ...options,
    });
  }

  locator(selectorOrLocator: string | Locator, options?: Omit<LocatorOptions, 'visible'>): Locator {
    if (isString(selectorOrLocator))
      return new Locator(
        this._frame,
        createChainedSelector(this._selector, selectorOrLocator),
        options
      );

    validateSameFrame(this._frame, selectorOrLocator._frame, 'locator');

    return new Locator(
      this._frame,
      createInternalChainSelector(this._selector, selectorOrLocator._selector),
      options
    );
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(testIdAttributeName(), testId));
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTitleSelector(text, options));
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.locator(getByRoleSelector(role, options));
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(this._frame, createFrameLocatorSelector(this._selector, selector));
  }

  filter(options?: LocatorOptions): Locator {
    return new Locator(this._frame, this._selector, options);
  }

  async elementHandle(options?: TimeoutOptions): Promise<ElementHandle> {
    return await executeWithProgress(
      async progress => {
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
          state: 'attached',
          ...options,
        });
        if (!handle) {
          throw new Error(createLocatorElementNotFoundError(this._selector));
        }
        return handle;
      },
      { timeout: resolveTimeout(options?.timeout) }
    );
  }

  async elementHandles(): Promise<ElementHandle[]> {
    return await executeWithProgress(
      async () => {
        // Use the frame's context to get all elements matching the selector
        const context = await this._frame.getContext();
        const handles = await context.querySelectorAll(
          this._selector,
          undefined, // no root element handle
          'MAIN'
        );
        return handles || [];
      },
      { timeout: DEFAULT_LOCATOR_TIMEOUT }
    );
  }

  async count(): Promise<number> {
    return await this._frame.selectors.queryCount(this._selector);
  }

  async all(): Promise<Locator[]> {
    const count = await this.count();
    return new Array(count).fill(0).map((_, i) => this.nth(i));
  }

  async allInnerTexts(): Promise<string[]> {
    return await executeWithProgress(
      async () => {
        const handles = await this.elementHandles();
        const texts: string[] = [];

        for (const handle of handles) {
          try {
            const text = await handle.getInnerText();
            texts.push(text || '');
          } finally {
            handle.dispose();
          }
        }

        return texts;
      },
      { timeout: DEFAULT_LOCATOR_TIMEOUT }
    );
  }

  async allTextContents(): Promise<string[]> {
    return await executeWithProgress(
      async () => {
        const handles = await this.elementHandles();
        const texts: string[] = [];

        for (const handle of handles) {
          try {
            const text = await handle.getTextContent();
            texts.push(text || '');
          } finally {
            handle.dispose();
          }
        }

        return texts;
      },
      { timeout: DEFAULT_LOCATOR_TIMEOUT }
    );
  }

  contentFrame(): FrameLocator {
    return new FrameLocator(this._frame, this._selector);
  }

  describe(description: string): Locator {
    // Metadata-only: do not alter selector string to avoid changing world resolution.
    const locator = new Locator(this._frame, this._selector);
    locator._description = description;
    return locator;
  }

  first(): Locator {
    return new Locator(this._frame, createFirstSelector(this._selector));
  }

  last(): Locator {
    return new Locator(this._frame, createLastSelector(this._selector));
  }

  nth(index: number): Locator {
    return new Locator(this._frame, createNthSelector(this._selector, index));
  }

  get description(): string | undefined {
    return this._description;
  }

  and(locator: Locator): Locator {
    validateSameFrame(this._frame, locator._frame, 'and');
    const newSelector = createAndSelector(this._selector, locator._selector);
    return new Locator(this._frame, newSelector);
  }

  or(locator: Locator): Locator {
    validateSameFrame(this._frame, locator._frame, 'or');
    const newSelector = createOrSelector(this._selector, locator._selector);
    return new Locator(this._frame, newSelector);
  }

  // #region Simple Element Operations for Locator

  // Text content getters
  async getTextContent(): Promise<string> {
    const result = await this._executeElementMethod<string>('getTextContent');
    return result;
  }
  async getInnerText(): Promise<string> {
    return this._executeElementMethod<string>('getInnerText');
  }
  async innerHTML(): Promise<string> {
    return this._executeElementMethod<string>('innerHTML');
  }
  async innerText(): Promise<string> {
    return this._executeElementMethod<string>('innerText');
  }
  async textContent(): Promise<string> {
    return this._executeElementMethod<string>('textContent');
  }
  async inputValue(): Promise<string> {
    return this._executeElementMethod<string>('inputValue');
  }

  // Form element getters/setters
  async getValue(): Promise<string> {
    return this._executeElementMethod<string>('getValue');
  }
  async setValue(value: string): Promise<void> {
    return this._executeElementMethod<void>('setValue', value);
  }
  async isChecked(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isChecked');
  }

  // Element properties
  async getTagName(): Promise<string> {
    return this._executeElementMethod<string>('getTagName');
  }

  /**
   * Select option(s) in the first matching select element
   *
   * @example
   * // Select by value
   * await locator.selectOption('option-value');
   * await locator.selectOption(['value1', 'value2']); // Multiple selection
   *
   * // Select by label text
   * await locator.selectOption({ label: 'Option Label' });
   *
   * // Select by index
   * await locator.selectOption({ index: 0 });
   */
  async selectOption(
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions
  ): Promise<string[]> {
    return this._executeElementMethod<string[]>('selectOption', values, options);
  }

  /**
   * Selects all text content within the first matching element.
   * For input/textarea elements, this will select all text in the field.
   * For other elements, this will select all text content within the element.
   *
   * @param options Action options including timeout and force
   * @returns Promise that resolves when text selection is complete
   */
  async selectText(options?: CommonActionOptions): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (handle, progress) => {
        await handle.selectTextWithProgress(progress, options);
        return 'done';
      },
      'SelectText',
      options?.timeout
    );
  }

  async setTextContent(text: string): Promise<void> {
    return this._executeElementMethod<void>('setTextContent', text);
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

  // Attribute methods
  async getAttribute(name: string): Promise<string | null> {
    return this._executeElementMethod<string | null>('getAttribute', name);
  }
  async setAttribute(name: string, value: string): Promise<void> {
    return this._executeElementMethod<void>('setAttribute', name, value);
  }
  async hasAttribute(name: string): Promise<boolean> {
    return this._executeElementMethod<boolean>('hasAttribute', name);
  }
  async hasClass(className: string): Promise<boolean> {
    return this._executeElementMethod<boolean>('hasClass', className);
  }

  // Element state checks
  async isVisible(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isVisible');
  }
  async isHidden(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isHidden');
  }
  async isEnabled(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isEnabled');
  }
  async isDisabled(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isDisabled');
  }
  async isEditable(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isEditable');
  }

  // Interaction methods
  async focus(): Promise<void> {
    return this._executeElementMethod<void>('focus');
  }
  async hover(): Promise<void> {
    return this._executeElementMethod<void>('hover');
  }
  async press(key: string, options: { delay?: number; timeout?: number } = {}): Promise<void> {
    return this._executeElementMethod<void>('press', key, options);
  }
  async type(text: string, options: { delay?: number; timeout?: number } = {}): Promise<void> {
    return this._executeElementMethod<void>('type', text, options);
  }

  /**
   * Generate an ARIA snapshot for the first matching element.
   *
   * @param options Configuration options for the ARIA snapshot
   * @param options.forAI Whether to optimize the snapshot for AI consumption (default: true)
   * @param options.refPrefix Prefix to use for element references in the snapshot (default: '')
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: DEFAULT_LOCATOR_TIMEOUT)
   * @returns A string representation of the ARIA accessibility tree for the element
   *
   * @example
   * ```typescript
   * // Get ARIA snapshot of a form element
   * const formLocator = page.locator('#registration-form');
   * const snapshot = await formLocator.ariaSnapshot({
   *   forAI: true,
   *   refPrefix: 'form'
   * });
   * ```
   */
  async ariaSnapshot(options?: {
    forAI?: boolean;
    refPrefix?: string;
    timeout?: number;
  }): Promise<string> {
    const forAI = options?.forAI ?? true;
    const refPrefix = options?.refPrefix ?? '';
    const timeout = resolveTimeout(options?.timeout);

    return executeWithProgress(
      async progress => {
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
        });

        if (!handle) {
          throw new Error(createLocatorElementNotFoundError(this._selector));
        }

        try {
          return await handle.ariaSnapshot({ forAI, refPrefix, timeout });
        } finally {
          handle.dispose();
        }
      },
      { timeout }
    );
  }

  /**
   * Scroll the first matching element into view if needed.
   * This method scrolls the page to ensure the element is visible in the viewport.
   *
   * @param options Configuration options for the scroll operation
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: DEFAULT_LOCATOR_TIMEOUT)
   *
   * @example
   * ```typescript
   * const element = page.locator('#submit-button');
   * await element.scrollIntoViewIfNeeded();
   * ```
   */
  async scrollIntoViewIfNeeded(options: TimeoutOptions = {}): Promise<void> {
    const timeout = resolveTimeout(options?.timeout);

    return executeWithProgress(
      async progress => {
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
        });

        if (!handle) {
          throw new Error(createLocatorElementNotFoundError(this._selector));
        }

        try {
          await handle.scrollIntoViewIfNeeded({ timeout });
        } finally {
          handle.dispose();
        }
      },
      { timeout }
    );
  }

  /**
   * Wait for the locator to match an element in the given state.
   * This method waits for the element to be attached, visible, hidden, or detached based on the state option.
   *
   * @param options Configuration options for the wait operation
   * @param options.state The state to wait for: 'attached', 'detached', 'visible', or 'hidden' (default: 'visible')
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: DEFAULT_LOCATOR_TIMEOUT)
   *
   * @example
   * ```typescript
   * const element = page.locator('#submit-button');
   *
   * // Wait for element to be visible (default)
   * await element.waitFor();
   *
   * // Wait for element to be attached but possibly hidden
   * await element.waitFor({ state: 'attached' });
   *
   * // Wait for element to be hidden
   * await element.waitFor({ state: 'hidden' });
   *
   * // Wait for element to be detached (removed from DOM)
   * await element.waitFor({ state: 'detached' });
   * ```
   */
  waitFor(
    options: WaitForElementOptions & TimeoutOptions & { state: 'attached' | 'visible' }
  ): Promise<void>;
  waitFor(options?: WaitForElementOptions & TimeoutOptions): Promise<void>;
  async waitFor(options?: WaitForElementOptions & TimeoutOptions): Promise<void> {
    const state = options?.state ?? 'visible';
    const timeout = resolveTimeout(options?.timeout);

    return executeWithProgress(
      async progress => {
        await this._frame.waitForSelector(progress, this._selector, true, {
          strict: true,
          omitReturnValue: true,
          state,
          ...options,
        });
      },
      { timeout }
    );
  }

  /**
   * Private inspection method for debugging and development tools.
   * Returns the string representation of this locator.
   */
  private _inspect(): string {
    return this.toString();
  }

  /**
   * Returns a string representation of the locator in JavaScript format.
   * This can be useful for debugging, logging, or generating test code.
   *
   * @returns A string representation of the locator
   *
   * @example
   * ```typescript
   * const locator = page.locator('#submit-button');
   * console.log(locator.toString()); // "page.locator('#submit-button')"
   * ```
   */
  toString(): string {
    return asLocator('javascript', this._selector);
  }

  /**
   * Execute a registered element function on the first matching element.
   * This allows calling domain-specific functions through the locator interface.
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
    return await this._withElement(
      handle => handle.executeFunction<TArgs, TResult>(functionName, args, options),
      {
        title: `Execute function '${functionName}'`,
        timeout: options?.timeout,
      }
    );
  }

  // #endregion Simple Element Operations for Locator
}
