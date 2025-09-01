/**
 * TypeScript implementation of browser-use controller service
 */
import { ActionResult } from './types';
import { BrowserContext } from '../browser/context';
import { Registry } from './registry/service';
import TurndownService from 'turndown';
import {
  ClickElementAction,
  DoneAction,
  GoToUrlAction,
  InputTextAction,
  NoParamsAction,
  OpenTabAction,
  ScrollAction,
  SearchGoogleAction,
  SendKeysAction,
  SwitchTabAction,
  ExtractPageContentAction,
  SelectDropdownOptionAction,
  WaitAction,
  ScrollToTextAction,
  GetDropdownOptionsAction,
} from './views';
import { RegisteredAction, ActionModel } from './registry/views';

// Minimal interface for the LLM used to extract page content
interface PageExtractionLLM {
  invoke(messages: Array<{ type: string; content: string }>): Promise<{ content: string }>;
}

// Interface for actions that have a modelDump method (like Pydantic models)
interface ModelDumpAction {
  modelDump(options: { excludeUnset: boolean }): Record<string, unknown>;
}

/**
 * Controller class for managing browser actions
 */
export class Controller<Context = unknown> {
  registry: Registry<Context>;

  /**
   * Execute an action with the given parameters
   */
  async execute(
    action: unknown,
    browserContext: BrowserContext,
    pageExtractionLlm?: PageExtractionLLM,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context
  ): Promise<ActionResult> {
    /**
     * Execute an action
     */
    console.log(`[Controller.execute ######]`, {
      action,
      hasContext: !!context,
      hasSensitiveData: !!sensitiveData,
      availableFilePaths: availableFilePaths?.length || 0,
    });
    // Extract the action name and parameters just like Python's model_dump
    const actionData =
      action && typeof action === 'object' ? (action as Record<string, unknown>) : {};
    console.log(`[Controller.execute.actionData ######]`, { actionData });

    for (const actionName of Object.keys(actionData)) {
      const params = actionData[actionName] as Record<string, unknown>;
      console.log(`[Controller.execute.loop ######]`, { actionName, params });

      if (params !== null && params !== undefined) {
        console.log(`[Controller.execute.params_valid ######]`, { actionName });
        // Execute the action
        const result = await this.executeAction(
          actionName,
          params,
          browserContext,
          pageExtractionLlm,
          sensitiveData,
          availableFilePaths,
          context
        );

        // Match Python's type checking and return logic
        console.log(`[Controller.execute.result_type ######]`, {
          resultType: typeof result,
          isActionResult: result instanceof ActionResult,
        });
        if (typeof result === 'string') {
          console.log(`[Controller.execute.string_result ######]`, { result });
          return new ActionResult({
            isDone: false,
            success: true,
            extractedContent: result,
            includeInMemory: false,
            error: '',
          });
        } else if (result instanceof ActionResult) {
          console.log(`[Controller.execute.action_result ######]`, {
            isDone: result.isDone,
            success: result.success,
          });
          return result;
        } else if (result === null || result === undefined) {
          console.log(`[Controller.execute.null_result ######]`);
          return new ActionResult({
            isDone: false,
            success: true,
            extractedContent: '',
            includeInMemory: false,
            error: '',
          });
        } else {
          console.log(`[Controller.execute.invalid_result ######]`, { result });
          throw new Error(`Invalid action result type: ${typeof result} of ${result}`);
        }
      }
    }
    return new ActionResult({
      isDone: false,
      success: true,
      extractedContent: '',
      includeInMemory: false,
      error: '',
    });
  }

  /**
   * Execute an action by name with the given parameters
   */
  async executeAction(
    actionName: string,
    params: Record<string, unknown>,
    browser?: BrowserContext,
    pageExtractionLlm?: PageExtractionLLM,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context
  ): Promise<ActionResult> {
    console.log(`[Controller.executeAction ######]`, {
      actionName,
      params,
      hasBrowser: !!browser,
      hasLlm: !!pageExtractionLlm,
    });
    if (!actionName) {
      return new ActionResult({
        isDone: false,
        success: false,
        extractedContent: 'Action name is required',
        includeInMemory: false,
        error: 'Action name is required',
      });
    }

    if (
      !this.registry ||
      !this.registry.registry ||
      !this.registry.registry.actions ||
      !(actionName in this.registry.registry.actions)
    ) {
      console.log(`[Controller.executeAction.not_found ######]`, {
        hasRegistry: !!this.registry,
        hasRegistryRegistry: !!this.registry?.registry,
        hasActions: !!this.registry?.registry?.actions,
        actionInRegistry: this.registry?.registry?.actions
          ? actionName in this.registry.registry.actions
          : false,
      });
      return new ActionResult({
        isDone: false,
        success: false,
        extractedContent: `Action ${actionName} not found in registry`,
        includeInMemory: false,
        error: `Action ${actionName} not found in registry`,
      });
    }
    try {
      // Get the action function directly from the registry
      const registeredAction = this.registry.registry.actions[actionName] as RegisteredAction<
        Record<string, unknown>
      >;
      console.log(`[Controller.executeAction.registered_action ######]`, {
        hasRegisteredAction: !!registeredAction,
        hasFunction: !!registeredAction?.function,
        functionType: typeof registeredAction?.function,
      });

      if (registeredAction && typeof registeredAction.function === 'function') {
        console.log(`[Controller.executeAction.calling_function ######]`, { actionName });
        // Call the function with the context of 'this'
        return (await registeredAction.function.call(this, params, {
          browser,
          pageExtractionLlm,
          sensitiveData,
          availableFilePaths,
          context,
        })) as ActionResult;
      } else {
        console.log(`[Controller.executeAction.invalid_function ######]`, { actionName });
        throw new Error(`Action ${actionName} does not have a valid function implementation`);
      }
    } catch (e) {
      console.log(`[Controller.executeAction.error ######]`, { actionName, error: String(e) });
      console.error(`Error executing action ${actionName}:`, e);
      return new ActionResult({
        isDone: false,
        success: false,
        error: String(e),
        includeInMemory: true,
        extractedContent: `Error executing action ${actionName}: ${String(e)}`,
      });
    }
  }

  /**
   * Python original implementation of act
   */
  async act(
    action: unknown,
    browserContext: BrowserContext,
    pageExtractionLlm?: PageExtractionLLM,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context
  ): Promise<ActionResult> {
    /**
     * Execute an action
     */
    console.log(`[Controller.act ######]`, {
      action,
      hasContext: !!context,
      hasSensitiveData: !!sensitiveData,
    });
    // Match Python's model_dump method
    if (!action) {
      return new ActionResult({
        isDone: false,
        success: true,
        extractedContent: '',
        includeInMemory: false,
        error: '',
      });
    }

    const actionData =
      typeof (action as ModelDumpAction).modelDump === 'function'
        ? (action as ModelDumpAction).modelDump({ excludeUnset: true })
        : action && typeof action === 'object'
          ? (action as Record<string, unknown>)
          : ({} as Record<string, unknown>);

    for (const actionName of Object.keys(actionData)) {
      const params = actionData[actionName];
      console.log(`[Controller.act.loop ######]`, { actionName, params });

      if (params !== null && params !== undefined) {
        console.log(`[Controller.act.executing ######]`, { actionName });
        // Execute the action
        const result = await this.registry.executeAction(
          actionName,
          params as Record<string, unknown>,
          browserContext,
          pageExtractionLlm,
          sensitiveData,
          availableFilePaths,
          context
        );
        console.log(`[Controller.act.result ######]`, {
          actionName,
          resultType: typeof result,
          isActionResult: result instanceof ActionResult,
        });

        // Match Python's type checking and return logic
        if (typeof result === 'string') {
          console.log(`[Controller.act.string_result ######]`, { result });
          return new ActionResult({
            extractedContent: result,
            isDone: false,
            success: true,
            includeInMemory: false,
            error: '',
          });
        } else if (result instanceof ActionResult) {
          console.log(`[Controller.act.action_result ######]`, {
            isDone: result.isDone,
            success: result.success,
          });
          return result;
        } else if (result === null || result === undefined) {
          console.log(`[Controller.act.null_result ######]`);
          return new ActionResult({
            isDone: false,
            success: true,
            extractedContent: '',
            includeInMemory: false,
            error: '',
          });
        } else {
          console.log(`[Controller.act.invalid_result ######]`, { result });
          throw new Error(`Invalid action result type: ${typeof result} of ${result}`);
        }
      }
    }

    return new ActionResult({
      isDone: false,
      success: true,
      extractedContent: '',
      includeInMemory: false,
      error: '',
    });
  }

  /**
   * Initialize the controller with optional excluded actions and output model
   */
  constructor(excludeActions: string[] = [], outputModel?: unknown) {
    console.log(`[Controller.constructor ######]`, {
      excludeActions,
      hasOutputModel: !!outputModel,
    });
    this.registry = new Registry<Context>(excludeActions);

    /**
     * Register all default browser actions
     */
    if (outputModel) {
      console.log(`[Controller.constructor.with_output_model ######]`);
      // Create a wrapper for the output model
      class ExtendedOutputModel extends ActionModel {
        success: boolean = true;
        data: unknown;

        getIndex(): number | null {
          return null;
        }

        setIndex(_index: number): void {
          // No-op for this model
        }

        toJSON(): Record<string, unknown> {
          return { success: this.success, data: this.data };
        }
      }

      // Register the done action with output model
      this.registerDoneActionWithModel(ExtendedOutputModel as new () => ActionModel);
    } else {
      console.log(`[Controller.constructor.standard_done ######]`);
      // Register the standard done action
      this.registerDoneAction();
    }

    // Register all the standard browser actions
    this.registerBasicActions();
  }

  /**
   * Register the done action with a custom output model
   */
  private registerDoneActionWithModel(ExtendedOutputModel: new () => ActionModel): void {
    console.log(`[Controller.registerDoneActionWithModel ######]`, {
      modelName: ExtendedOutputModel.name,
    });
    this.registry.action(
      // eslint-disable-next-line max-len
      'Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached',
      ExtendedOutputModel
    )(this, 'done', {
      value: async function (params: { success: boolean; data: unknown }): Promise<ActionResult> {
        // Convert the output model to a plain object
        const outputDict = params.data as Record<string, unknown>;

        // Handle enums by converting them to string values
        for (const [key, value] of Object.entries(outputDict)) {
          if (value && typeof value === 'object' && 'value' in value) {
            outputDict[key] = (value as { value: unknown }).value;
          }
        }

        return new ActionResult({
          isDone: true,
          success: params.success,
          extractedContent: JSON.stringify(outputDict),
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  // #region bookmark

  /**
   * Register the standard done action
   */
  private registerDoneAction(): void {
    console.log(`[Controller.registerDoneAction ######]`);
    this.registry.action(
      // eslint-disable-next-line max-len
      'Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached',
      DoneAction
    )(this, 'done', {
      value: async function (
        params: DoneAction | { text: string; success: boolean }
      ): Promise<ActionResult> {
        // In Python, Pydantic would validate that required fields exist
        // If fields are missing, it would raise a ValidationError

        // Create a DoneAction instance with the validated params
        const doneAction =
          params instanceof DoneAction
            ? params
            : new DoneAction({
                text: params.text,
                success: params.success,
              });

        // Create our result, matching the Python implementation
        // In Python: return ActionResult(is_done=True, success=params.success, extracted_content=params.text)
        return new ActionResult({
          isDone: true,
          success: doneAction.success,
          extractedContent: doneAction.text,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  private registerBasicActions(): void {
    console.log(`[Controller.registerBasicActions ######]`);
    // Search Google action
    this.registry.action(
      // eslint-disable-next-line max-len
      'Search the query in Google in the current tab, the query should be a search query like humans search in Google, concrete and not vague or super long. More the single most important items.',
      SearchGoogleAction
    )(this, 'search_google', {
      value: async function (
        params: SearchGoogleAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.search_google ######]`, {
          query: params.query,
        });
        const page = await browser.getCurrentPage();
        await page.goto(`https://www.google.com/search?q=${params.query}&udm=14`);
        await page.waitForLoadState();
        const msg = `🔍 Searched for "${params.query}" in Google`;
        console.info(msg);
        return new ActionResult({
          isDone: false,
          success: true,
          extractedContent: msg,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Go to URL action
    this.registry.action('Navigate to URL in the current tab', GoToUrlAction)(this, 'go_to_url', {
      value: async function (
        params: GoToUrlAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.go_to_url ######]`, {
          url: params.url,
        });
        const page = await browser.getCurrentPage();

        console.info(`Navigating to ${params.url}...`);
        try {
          // Use more robust navigation options
          await page.goto(params.url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000, // Increase timeout to 60 seconds
          });

          // Wait for multiple load states to ensure page is fully loaded
          await page.waitForLoadState('domcontentloaded');
          await page.waitForLoadState('load');

          // Additional wait to ensure the page is stable
          await page.waitForTimeout(2000);

          const msg = `🔗 Successfully navigated to ${params.url}`;
          console.info(msg);

          return new ActionResult({
            isDone: false,
            success: true,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (error) {
          console.error(`Navigation error: ${error}`);

          // Even if there's an error, the page might still have loaded partially
          // So we'll return a failure with an informative message
          const errorMsg = `Navigation to ${params.url} may have encountered issues: ${error}`;
          return new ActionResult({
            isDone: false,
            success: false,
            error: String(error),
            extractedContent: errorMsg,
            includeInMemory: true,
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Go back action
    this.registry.action('Go back', NoParamsAction)(this, 'go_back', {
      value: async function (
        _: NoParamsAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.go_back ######]`);
        await browser.goBack();
        const msg = '🔙 Navigated back';
        console.info(msg);
        return new ActionResult({
          isDone: false,
          success: true,
          extractedContent: msg,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Wait action
    this.registry.action('Wait for x seconds default 3', WaitAction)(this, 'wait', {
      value: async function (params: WaitAction): Promise<ActionResult> {
        console.log(`[Controller.wait ######]`, {
          seconds: params.seconds,
        });
        // Get seconds from params, default to 3 if not specified
        const seconds = params.seconds || 3;

        const msg = `🕒 Waiting for ${seconds} seconds`;
        console.info(msg);
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        return new ActionResult({
          isDone: false,
          success: true,
          extractedContent: msg,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Scroll to text action
    this.registry.action(
      'If you dont find something which you want to interact with, scroll to it',
      ScrollToTextAction
    )(this, 'scroll_to_text', {
      value: async function (
        params: ScrollToTextAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.scroll_to_text ######]`, {
          text: params.text,
        });
        try {
          // Get text directly from params
          const textToFind = params.text;
          console.log(`[Controller.scroll_to_text.text_to_find ######]`, {
            textToFind,
          });

          // Match Python implementation exactly
          const page = await browser.getCurrentPage();
          // Try different locator strategies, just like Python implementation
          const locators = [
            page.getByText(textToFind, { exact: false }),
            page.locator(`text=${textToFind}`),
            page.locator(`//*[contains(text(), '${textToFind}')]`),
          ];
          console.log(`[Controller.scroll_to_text.locators_created ######]`, {
            locatorCount: locators.length,
          });

          for (const [index, locator] of locators.entries()) {
            try {
              console.log(`[Controller.scroll_to_text.trying_locator ######]`, {
                index,
                strategy: index === 0 ? 'getByText' : index === 1 ? 'text=' : 'xpath',
              });
              // First check if element exists and is visible
              const count = await locator.count();
              const isVisible = count > 0 ? await locator.first().isVisible() : false;
              console.log(`[Controller.scroll_to_text.locator_check ######]`, {
                index,
                count,
                isVisible,
              });
              if (count > 0 && isVisible) {
                console.log(`[Controller.scroll_to_text.scrolling ######]`, { index });
                await locator.first().scrollIntoViewIfNeeded();
                await page.waitForTimeout(500); // Wait for scroll to complete
                const msg = `🔍 Scrolled to text: ${textToFind}`;
                console.log(`[Controller.scroll_to_text.success ######]`, { msg });
                console.info(msg);
                return new ActionResult({
                  isDone: false,
                  success: true,
                  extractedContent: msg,
                  includeInMemory: true,
                  error: '',
                });
              }
            } catch (e) {
              console.log(`[Controller.scroll_to_text.locator_error ######]`, {
                index,
                error: String(e),
              });
              continue;
            }
          }

          const msg = `Text '${textToFind}' not found or not visible on page`;
          console.log(`[Controller.scroll_to_text.not_found ######]`, { msg });
          console.info(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (e) {
          const msg = `Failed to scroll to text '${params.text}': ${e}`;
          console.log(`[Controller.scroll_to_text.catch_error ######]`, {
            error: String(e),
            text: params.text,
          });
          console.error(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            error: msg,
            extractedContent: '', // Add empty string for required property
            includeInMemory: false,
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Click element action
    this.registry.action('Click element', ClickElementAction)(this, 'click_element', {
      value: async function (
        params: ClickElementAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.click_element ######]`, {
          index: params.index,
        });
        // Check if the index is defined
        if (params.index === undefined) {
          console.log(`[Controller.click_element.undefined_index ######]`);
          throw new Error('Failed to click element with index undefined');
        }
        console.log(`[Controller.click_element.index_valid ######]`, { index: params.index });

        const session = await browser.getSession();
        console.log(`[Controller.click_element.session ######]`, {
          hasSession: !!session,
          hasCachedState: !!session?.cachedState,
        });

        if (session.cachedState) {
          if (session.cachedState.selectorMap) {
            console.log(`[Controller.click_element.has_selector_map ######]`);
            9;
          }
        }

        const selectorMap = await browser.getSelectorMap();
        console.log(`[Controller.click_element.selector_map ######]`, {
          selectorMapKeys: Object.keys(selectorMap).length,
        });

        // Convert the index to string to match how it's stored in the selector map
        const indexKey = params.index.toString();
        console.log(`[Controller.click_element.index_key ######]`, { indexKey });

        if (!(indexKey in selectorMap)) {
          console.log(`[Controller.click_element.index_not_found ######]`, {
            indexKey,
            availableKeys: Object.keys(selectorMap),
          });
          throw new Error(
            `Element with index ${params.index} does not exist - retry or use alternative actions`
          );
        }
        console.log(`[Controller.click_element.index_found ######]`, { indexKey });

        // Get element descriptor directly from selector map using getDomElementByIndex
        // This matches Python implementation's approach exactly
        const elementNode = await browser.getDomElementByIndex(params.index);
        console.log(`[Controller.click_element.element_node ######]`, {
          hasElementNode: !!elementNode,
          tagName: elementNode?.tagName,
          xpath: elementNode?.xpath,
        });
        if (!elementNode) {
          console.log(`[Controller.click_element.element_node_not_found ######]`, {
            index: params.index,
          });
          throw new Error(`Element with index ${params.index} not found`);
        }

        // Get the initial page count safely
        // In the Python implementation, this is used to detect new tabs/windows after clicking
        let initialPages = 0;
        try {
          // Get the current page count from the browser window
          initialPages = browser.browserWindow.pages().length;
          console.log(`[Controller.click_element.initial_pages ######]`, {
            initialPages,
          });
        } catch (e) {
          console.log(`[Controller.click_element.page_count_error ######]`, {
            error: String(e),
          });
          console.warn('Could not get initial page count:', e);
        }

        // Check if element is a file uploader
        const isFileUploader = await browser.isFileUploader(elementNode);
        console.log(`[Controller.click_element.file_uploader_check ######]`, {
          isFileUploader,
        });
        if (isFileUploader) {
          // eslint-disable-next-line max-len
          const msg = `Index ${params.index} - has an element which opens file upload dialog. To upload files please use a specific function to upload files`;
          console.log(`[Controller.click_element.file_uploader_detected ######]`, { msg });
          console.info(msg);
          return new ActionResult({
            isDone: true,
            success: true,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        }

        let msg: string;

        try {
          console.log(`[Controller.click_element.attempting_click ######]`);
          const downloadPath = await browser._clickElementNode(elementNode);
          console.log(`[Controller.click_element.click_result ######]`, {
            hasDownloadPath: !!downloadPath,
            downloadPath,
          });
          if (downloadPath) {
            msg = `💾 Downloaded file to ${downloadPath}`;
            console.log(`[Controller.click_element.download_detected ######]`, {
              downloadPath,
            });
          } else {
            msg = `🖱️ Clicked button with index ${params.index}: ${elementNode.getAllTextTillNextClickableElement(2)}`;
            console.log(`[Controller.click_element.normal_click ######]`, { msg });
          }

          console.info(msg);

          // Check for new tabs safely, following Python implementation approach
          let currentPageCount = 0;
          try {
            // Get the current page count from the browser window
            currentPageCount = browser.browserWindow.pages().length;
            console.log(`[Controller.click_element.current_pages ######]`, {
              currentPageCount,
              initialPages,
            });
          } catch (e) {
            console.log(`[Controller.click_element.page_count_error2 ######]`, {
              error: String(e),
            });
            console.warn('Could not get current page count:', e);
          }

          if (currentPageCount > initialPages) {
            const newTabMsg = 'New tab opened - switching to it';
            console.log(`[Controller.click_element.new_tab_detected ######]`, {
              currentPageCount,
              initialPages,
            });
            msg += ` - ${newTabMsg}`;
            console.info(newTabMsg);
            await browser.switchToTab(-1);
          }

          // Only mark downloads as done; regular clicks should allow the agent to continue
          // This matches the Python implementation's behavior
          return new ActionResult({
            isDone: downloadPath ? true : false,
            success: true,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (e) {
          console.log(`[Controller.click_element.click_error ######]`, {
            error: String(e),
            index: params.index,
          });
          console.warn(
            `Element not clickable with index ${params.index} - most likely the page changed`
          );
          return new ActionResult({
            isDone: false,
            success: false,
            error: String(e),
            extractedContent: `Element not clickable: ${String(e)}`,
            includeInMemory: false,
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Input text action
    this.registry.action('Input text into a input interactive element', InputTextAction)(
      this,
      'input_text',
      {
        value: async function (
          params: InputTextAction,
          {
            browser,
            hasSensitiveData = false,
          }: { browser: BrowserContext; hasSensitiveData?: boolean }
        ): Promise<ActionResult> {
          console.log(`[Controller.input_text ######]`, {
            index: params.index,
            textLength: params.text?.length || 0,
            hasSensitiveData,
          });
          // Check if the index is defined
          if (params.index === undefined) {
            throw new Error('Failed to input text into index undefined');
          }

          // Get element descriptor directly from selector map using getDomElementByIndex
          // This matches Python implementation's approach exactly
          const elementNode = await browser.getDomElementByIndex(params.index);
          if (!elementNode) {
            throw new Error(`Element with index ${params.index} not found`);
          }
          await browser._inputTextElementNode(elementNode, params.text);

          let msg: string;
          if (!hasSensitiveData) {
            msg = `⌨️ Input ${params.text} into index ${params.index}`;
          } else {
            msg = `⌨️ Input sensitive data into index ${params.index}`;
          }

          console.info(msg);

          return new ActionResult({
            isDone: false,
            success: true,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        },
        writable: true,
        enumerable: true,
        configurable: true,
      }
    );

    // Switch tab action
    this.registry.action('Switch tab', SwitchTabAction)(this, 'switch_tab', {
      value: async function (
        params: SwitchTabAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.switch_tab ######]`, {
          pageId: params.pageId,
        });
        await browser.switchToTab(params.pageId);
        // Wait for tab to be ready
        const page = await browser.getCurrentPage();
        await page.waitForLoadState();
        const msg = `🔄 Switched to tab ${params.pageId}`;
        console.info(msg);
        return new ActionResult({
          isDone: false,
          success: true,
          extractedContent: msg,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Open tab action
    this.registry.action('Open url in new tab', OpenTabAction)(this, 'open_tab', {
      value: async function (
        params: OpenTabAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.open_tab ######]`, {
          url: params.url,
        });
        await browser.createNewTab(params.url);
        const msg = `🔗 Opened new tab with ${params.url}`;
        console.info(msg);
        return new ActionResult({
          isDone: false,
          success: true,
          extractedContent: msg,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Scroll down action
    this.registry.action(
      'Scroll down the page by pixel amount - if no amount is specified, scroll down one page',
      ScrollAction
    )(this, 'scroll_down', {
      value: async function (
        params: ScrollAction | { amount?: number },
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.scroll_down ######]`, {
          params,
          paramsType: typeof params,
        });
        const page = await browser.getCurrentPage();
        let amount: number | undefined;

        // Handle both direct ScrollAction and object with empty properties
        if (params && typeof params === 'object') {
          console.log(`[Controller.scroll_down.params_check ######]`, {
            hasAmount: 'amount' in params,
            amountType: typeof (params as { amount?: number }).amount,
          });
          if ('amount' in params && typeof params.amount === 'number') {
            amount = params.amount;
            console.log(`[Controller.scroll_down.amount_set ######]`, { amount });
          }
        }

        if (amount !== undefined) {
          console.log(`[Controller.scroll_down.with_amount ######]`, { amount });
          await page.evaluate((amount: number) => {
            window.scrollBy(0, amount);
          }, amount);
        } else {
          console.log(`[Controller.scroll_down.default_scroll ######]`);
          await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
          });
        }

        const amountText = amount !== undefined ? `${amount} pixels` : 'one page';
        const msg = `🔍 Scrolled down the page by ${amountText}`;
        console.info(msg);

        return new ActionResult({
          isDone: false,
          success: true,
          extractedContent: msg,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Scroll up action
    this.registry.action(
      'Scroll up the page by pixel amount - if no amount is specified, scroll up one page',
      ScrollAction
    )(this, 'scroll_up', {
      value: async function (
        params: ScrollAction | { amount?: number },
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.scroll_up ######]`, {
          params,
          paramsType: typeof params,
        });
        const page = await browser.getCurrentPage();
        let amount: number | undefined;

        // Handle both direct ScrollAction and object with empty properties
        if (params && typeof params === 'object') {
          console.log(`[Controller.scroll_up.params_check ######]`, {
            hasAmount: 'amount' in params,
            amountType: typeof (params as { amount?: number }).amount,
          });
          if ('amount' in params && typeof params.amount === 'number') {
            amount = params.amount;
            console.log(`[Controller.scroll_up.amount_set ######]`, { amount });
          }
        }

        if (amount !== undefined) {
          console.log(`[Controller.scroll_up.with_amount ######]`, { amount });
          await page.evaluate((amount: number) => {
            window.scrollBy(0, -amount);
          }, amount);
        } else {
          console.log(`[Controller.scroll_up.default_scroll ######]`);
          await page.evaluate(() => {
            window.scrollBy(0, -window.innerHeight);
          });
        }

        const amountText = amount !== undefined ? `${amount} pixels` : 'one page';
        const msg = `🔍 Scrolled up the page by ${amountText}`;
        console.info(msg);

        return new ActionResult({
          isDone: false,
          success: true,
          extractedContent: msg,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Send keys action
    this.registry.action(
      // eslint-disable-next-line max-len
      'Send strings of special keys like Escape,Backspace, Insert, PageDown, Delete, Enter, Shortcuts such as `Control+o`, `Control+Shift+T` are supported as well. This gets used in keyboard.press.',
      SendKeysAction
    )(this, 'send_keys', {
      value: async function (
        params: SendKeysAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        console.log(`[Controller.send_keys ######]`, {
          keys: params.keys,
        });
        const page = await browser.getCurrentPage();

        try {
          // Prefer a native keyboard API if the Page exposes one (Playwright-like).
          const pageWithKeyboard = page as unknown as {
            press?: (selector: string, key: string) => Promise<void>;
          };
          const keys = params.keys as string | string[];
          console.log(`[Controller.send_keys.keys_prep ######]`, {
            keys,
            keysType: typeof keys,
            isArray: Array.isArray(keys),
            hasPress: typeof pageWithKeyboard.press === 'function',
          });

          if (typeof pageWithKeyboard.press === 'function') {
            console.log(`[Controller.send_keys.using_native_press ######]`);
            // keyboard.press expects a single key string (e.g. 'Escape' or 'Control+o')
            if (Array.isArray(keys)) {
              console.log(`[Controller.send_keys.array_keys ######]`, {
                keyCount: keys.length,
              });
              // If given an array of keys, send them one at a time
              for (const key of keys) {
                console.log(`[Controller.send_keys.pressing_key ######]`, { key });
                await pageWithKeyboard.press!('body', key);
              }
            } else {
              console.log(`[Controller.send_keys.single_key ######]`, { keys });
              await pageWithKeyboard.press!('body', keys);
            }
          } else {
            console.log(`[Controller.send_keys.using_keyboard_events ######]`);
            // Last resort: dispatch a KeyboardEvent in the page context
            const singleKeys: string[] = Array.isArray(keys) ? keys : [keys];
            console.log(`[Controller.send_keys.single_keys ######]`, {
              singleKeys,
              keyCount: singleKeys.length,
            });
            for (const k of singleKeys) {
              console.log(`[Controller.send_keys.dispatching_event ######]`, { key: k });
              await page.evaluate((key: string) => {
                const ev = new KeyboardEvent('keydown', { key });
                (document.activeElement || document.body).dispatchEvent(ev);
                const ev2 = new KeyboardEvent('keyup', { key });
                (document.activeElement || document.body).dispatchEvent(ev2);
              }, k);
            }
          }
        } catch (e) {
          console.log(`[Controller.send_keys.error ######]`, {
            error: String(e),
            isUnknownKey: String(e).includes('Unknown key'),
          });
          if (String(e).includes('Unknown key')) {
            console.log(`[Controller.send_keys.unknown_key_fallback ######]`);
            // If Playwright-style keyboard failed with Unknown key and keys is an array, try each individually
            const keys = params.keys as unknown;
            if (Array.isArray(keys)) {
              console.log(`[Controller.send_keys.fallback_array ######]`, {
                keyCount: keys.length,
              });
              for (const key of keys) {
                try {
                  console.log(`[Controller.send_keys.fallback_key ######]`, { key });
                  const pageWithKeyboard = page as unknown as {
                    keyboard?: { press?: (keys: string) => Promise<void> };
                    press?: (selector: string, key: string) => Promise<void>;
                  };
                  if (
                    pageWithKeyboard.keyboard &&
                    typeof pageWithKeyboard.keyboard.press === 'function'
                  ) {
                    console.log(`[Controller.send_keys.using_keyboard_press ######]`);
                    await pageWithKeyboard.keyboard.press!(key);
                  } else if (typeof pageWithKeyboard.press === 'function') {
                    console.log(`[Controller.send_keys.using_page_press ######]`);
                    await pageWithKeyboard.press('body', key);
                  } else {
                    console.log(`[Controller.send_keys.using_evaluate ######]`);
                    await page.evaluate((k: string) => {
                      const ev = new KeyboardEvent('keydown', { key: k });
                      (document.activeElement || document.body).dispatchEvent(ev);
                      const ev2 = new KeyboardEvent('keyup', { key: k });
                      (document.activeElement || document.body).dispatchEvent(ev2);
                    }, key);
                  }
                } catch (inner) {
                  console.log(`[Controller.send_keys.fallback_error ######]`, {
                    key,
                    error: String(inner),
                  });
                  console.warn(`Failed to press fallback key '${key}': ${String(inner)}`);
                }
              }
            } else {
              console.log(`[Controller.send_keys.rethrowing_non_array ######]`);
              throw e;
            }
          } else {
            console.log(`[Controller.send_keys.rethrowing_other_error ######]`);
            throw e;
          }
        }

        const msg = `⌨️ Sent keys: ${params.keys}`;
        console.info(msg);

        return new ActionResult({
          isDone: false,
          success: true,
          extractedContent: msg,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Note: The scroll_to_text action is already registered above with the proper schema class

    // Get dropdown options action
    this.registry.action('Get all options from a native dropdown', GetDropdownOptionsAction)(
      this,
      'get_dropdown_options',
      {
        value: async function (
          params: GetDropdownOptionsAction,
          { browser }: { browser: BrowserContext }
        ): Promise<ActionResult> {
          console.log(`[Controller.get_dropdown_options ######]`, {
            index: params.index,
          });
          const page = await browser.getCurrentPage();
          const selectorMap = await browser.getSelectorMap();
          console.log(`[Controller.get_dropdown_options.setup ######]`, {
            selectorMapKeys: Object.keys(selectorMap).length,
            frameCount: page.frames().length,
          });

          const domElement = selectorMap[params.index];
          console.log(`[Controller.get_dropdown_options.dom_element ######]`, {
            hasDomElement: !!domElement,
            xpath: domElement?.xpath,
            tagName: domElement?.tagName,
          });

          try {
            // Frame-aware approach
            const allOptions: string[] = [];
            let frameIndex = 0;
            console.log(`[Controller.get_dropdown_options.starting_frames ######]`);

            for (const frame of page.frames()) {
              console.log(`[Controller.get_dropdown_options.frame ######]`, {
                frameIndex,
                frameUrl: frame.url(),
              });
              try {
                // Strictly-typed page evaluation to narrow to HTMLSelectElement and return a shaped SelectInfo
                interface DropdownOption {
                  text: string;
                  value: string;
                  index: number;
                }

                interface SelectInfo {
                  options: DropdownOption[];
                  id: string;
                  name: string;
                }

                const selectInfo = await frame.evaluate<SelectInfo | null, string>(xpath => {
                  const result = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                  );

                  const node = result.singleNodeValue;
                  if (!node || !(node instanceof HTMLSelectElement)) return null;

                  const select = node as HTMLSelectElement;

                  // Do not trim text; exact match elsewhere depends on it
                  const options: DropdownOption[] = Array.from(select.options, opt => ({
                    text: opt.text,
                    value: opt.value,
                    index: opt.index,
                  }));

                  return {
                    options,
                    id: select.id,
                    name: select.name,
                  };
                }, domElement.xpath);

                if (selectInfo) {
                  console.log(`[Controller.get_dropdown_options.select_info ######]`, {
                    frameIndex,
                    optionCount: selectInfo.options.length,
                    selectId: selectInfo.id,
                    selectName: selectInfo.name,
                  });
                  const formattedOptions: string[] = [];
                  for (const opt of selectInfo.options) {
                    // Encoding ensures AI uses the exact string in select_dropdown_option
                    const encodedText = JSON.stringify(opt.text);
                    formattedOptions.push(`${opt.index}: text=${encodedText}`);
                  }
                  console.log(`[Controller.get_dropdown_options.formatted_options ######]`, {
                    formattedOptionsCount: formattedOptions.length,
                  });

                  allOptions.push(...formattedOptions);
                  break;
                }
              } catch (e) {
                console.log(`[Controller.get_dropdown_options.frame_error ######]`, {
                  frameIndex,
                  error: String(e),
                });
                console.debug(`frame ${frameIndex} evaluation error: ${String(e)}`);
              }
              frameIndex++;
            }

            console.log(`[Controller.get_dropdown_options.all_options ######]`, {
              allOptionsCount: allOptions.length,
              allOptions: allOptions.slice(0, 5), // Log first 5 for brevity
            });
            if (allOptions.length === 0) {
              console.log(`[Controller.get_dropdown_options.no_options ######]`);
              return new ActionResult({
                isDone: false,
                success: false,
                error: `No dropdown options found for element with index ${params.index}`,
                includeInMemory: false,
                extractedContent: `No dropdown options found for element with index ${params.index}`,
              });
            }

            const msg = `Dropdown options for element ${params.index}:\n${allOptions.join('\n')}`;
            console.log(`[Controller.get_dropdown_options.success ######]`, {
              optionsCount: allOptions.length,
            });
            console.info(msg);

            return new ActionResult({
              isDone: true,
              success: true,
              extractedContent: msg,
              includeInMemory: true,
              error: '',
            });
          } catch (e) {
            const msg = `Error getting dropdown options: ${String(e)}`;
            console.log(`[Controller.get_dropdown_options.catch_error ######]`, {
              error: String(e),
              index: params.index,
            });
            console.error(msg);

            return new ActionResult({
              isDone: false,
              success: false,
              error: msg,
              extractedContent: '', // Add empty string for required property
              includeInMemory: false,
            });
          }
        },
        writable: true,
        enumerable: true,
        configurable: true,
      }
    );

    // Content Actions
    this.registry.action(
      // eslint-disable-next-line max-len
      'Extract page content to retrieve specific information from the page, e.g. all company names, a specifc description, all information about, links with companies in structured format or simply links',
      ExtractPageContentAction
    )(this, 'extract_content', {
      value: async function (
        params: ExtractPageContentAction,
        {
          browser,
          pageExtractionLlm,
        }: { browser: BrowserContext; pageExtractionLlm?: PageExtractionLLM }
      ): Promise<ActionResult> {
        const goal = params.value;
        const page = await browser.getCurrentPage();
        // Get the page content first - exactly like Python does
        const pageContent = await page.content();

        // Create turndown service (equivalent to Python's markdownify)
        const turndownService = new TurndownService();

        // Remove script, style, and other non-content tags
        // This matches the behavior of Python's markdownify
        // The .remove() method ensures these tags and their contents are completely removed
        turndownService.remove(['script', 'style', 'meta', 'link', 'noscript', 'img']);

        // Remove link URLs, but keep the text
        turndownService.addRule('plainLink', {
          filter: 'a',

          replacement(content) {
            return content; // no Markdown URL, just the text
          },
        });

        // Convert HTML to markdown
        let content = turndownService.turndown(pageContent);

        // CRITICAL: Truncate content to prevent 30k token limit overflow
        const maxContentSize = 15000; // Conservative limit for extract_content
        if (content.length > maxContentSize) {
          content =
            content.substring(0, maxContentSize) +
            '\n\n[... content truncated to fit token limit ...]';
        }

        // Use the exact same prompt as Python
        const prompt =
          // eslint-disable-next-line max-len
          'Your task is to extract the content of the page. You will be given a page and a goal and you should extract all relevant information around this goal from the page. If the goal is vague, summarize the page. Respond in json format. Extraction goal: {goal}, Page: {page}';

        try {
          // In Python, this uses a PromptTemplate with input_variables=['goal', 'page']
          // Create a similar structure in TypeScript
          const templateVars = {
            goal: goal,
            page: content,
          };
          // Format the prompt with the goal and content (similar to Python's template.format())
          const formattedPrompt = prompt
            .replace('{goal}', templateVars.goal)
            .replace('{page}', templateVars.page);
          // In TypeScript, the LLM.invoke method expects an array of message objects
          const messages = [
            {
              type: 'human',
              content: formattedPrompt,
            },
          ];

          const output = await pageExtractionLlm!.invoke(messages);

          // Use exact same format for message
          const msg = `📄 Extracted from page\n: ${output.content}\n`;
          console.log(`[Controller.extract_content.success_message ######]`, {
            msgLength: msg.length,
          });
          console.info(msg);

          // Match Python implementation exactly:
          // return ActionResult(extracted_content=msg, include_in_memory=True)
          return new ActionResult({
            success: true,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (error) {
          console.log(`[Controller.extract_content.llm_error ######]`, {
            error: String(error),
          });
          // Match Python's error handling exactly
          // In Python: logger.debug(f'Error extracting content: {e}')
          console.debug(`Error extracting content: ${error}`);

          // In Python: msg = f'📄 Extracted from page\n: {content}\n'
          const msg = `📄 Extracted from page\n: ${content}\n`;
          console.log(`[Controller.extract_content.fallback_message ######]`, {
            msgLength: msg.length,
          });
          console.info(msg);

          // Match Python implementation exactly:
          // return ActionResult(extracted_content=msg)
          // Note: Python doesn't include includeInMemory parameter in the error case
          // This means it defaults to False in Python, so content isn't added to memory
          return new ActionResult({
            success: true, // Note: Python doesn't explicitly set success=false
            extractedContent: msg,
            includeInMemory: false, // This is the key difference - don't include in memory on error
            error: '',
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Select dropdown option action
    this.registry.action(
      'Select dropdown option for interactive element index by the text of the option you want to select',
      SelectDropdownOptionAction
    )(this, 'select_dropdown_option', {
      value: async function (
        params: SelectDropdownOptionAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        const { index, text } = params;
        const page = await browser.getCurrentPage();
        // Get element descriptor directly from browser using getDomElementByIndex
        const domElement = await browser.getDomElementByIndex(index);

        // Validate domElement exists and is a select element
        if (!domElement) {
          const msg = `Cannot select option: No element found for index ${index}`;
          console.error(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        }
        if (domElement.tagName.toLowerCase() !== 'select') {
          const msg = `Cannot select option: Element with index ${index} is a ${domElement.tagName}, not a select`;
          console.error(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        }

        try {
          let frameIndex = 0;
          for (const frame of page.frames()) {
            try {
              type DropdownCheckResult = {
                id?: string;
                name?: string;
                found: boolean;
                tagName?: string;
                optionCount?: number;
                currentValue?: string;
                availableOptions?: string[];
                error?: string;
              };

              const dropdownInfo = await frame.evaluate<DropdownCheckResult | null, string>(
                xpath => {
                  try {
                    const node = document.evaluate(
                      xpath,
                      document,
                      null,
                      XPathResult.FIRST_ORDERED_NODE_TYPE,
                      null
                    ).singleNodeValue;

                    if (!node) return null;
                    if (!(node instanceof HTMLSelectElement)) {
                      return {
                        found: false,
                        error: `Found element but it's a ${(node as Element).tagName}, not a SELECT`,
                      } as DropdownCheckResult;
                    }

                    const select = node as HTMLSelectElement;
                    return {
                      id: select.id,
                      name: select.name,
                      found: true,
                      tagName: select.tagName,
                      optionCount: select.options.length,
                      currentValue: select.value,
                      availableOptions: Array.from(select.options).map(o => o.text.trim()),
                    } as DropdownCheckResult;
                  } catch (e) {
                    return {
                      found: false,
                      error: String(e),
                    } as DropdownCheckResult;
                  }
                },
                domElement.xpath
              );

              if (dropdownInfo) {
                if (!dropdownInfo.found) {
                  console.error(`Frame ${frameIndex} error: ${dropdownInfo.error}`);
                  continue;
                }

                console.debug(
                  `Found dropdown in frame ${frameIndex}: ${JSON.stringify(dropdownInfo)}`
                );

                // "label" because we are selecting by text
                // nth(0) to disable error thrown by strict mode
                // timeout=1000 because we are already waiting for all network events
                const selectedOptionValues = await frame
                  .locator('//' + domElement.xpath)
                  .first()
                  .selectOption({ label: text }, { timeout: 1000 });

                const msg = `Selected option ${text} with value ${selectedOptionValues}`;
                console.info(msg + ` in frame ${frameIndex}`);

                return new ActionResult({
                  isDone: false,
                  success: true,
                  extractedContent: msg,
                  includeInMemory: true,
                  error: '',
                });
              }
            } catch (frameError) {
              console.error(`Frame ${frameIndex} attempt failed: ${String(frameError)}`);
              console.error(`Frame URL: ${frame.url()}`);
            }

            frameIndex++;
          }

          const msg = `Could not select option '${text}' in any frame`;
          console.info(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (e) {
          const msg = `Selection failed: ${String(e)}`;
          console.error(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            error: msg,
            extractedContent: msg,
            includeInMemory: true,
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}
