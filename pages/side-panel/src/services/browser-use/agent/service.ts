/**
 * Agent service for browser-use TypeScript implementation
 */
// Langchain imports
import { BaseMessage, HumanMessage, type MessageContent } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

// Project imports
import {
  ActionResult,
  AgentError,
  AgentHistory,
  AgentHistoryList,
  AgentOutput,
  AgentSettings,
  AgentState,
  AgentStepInfo,
  DoneAgentOutput,
  StepMetadata,
} from './views';
import type {
  ToolCallingMethod,
  AgentOutputClass,
  StructuredOutputSchema,
  StructuredLlmResponse,
} from './types';
// Removed Zod import as we're using TypeScript interfaces for validation
import { ActionModel } from '../controller/registry/views';
// import type { Context } from '../controller/types';
import { Controller } from '../controller/service';
import { BrowserContext } from '../browser/context';

// Local minimal PageExtractionLLM interface (matches controller.service PageExtractionLLM)
interface PageExtractionLLM {
  invoke(messages: Array<{ type: string; content: string }>): Promise<{ content: string }>;
}
import { BrowserState, BrowserStateHistory } from '../browser/views';
import { MessageManager, MessageManagerSettings } from './message_manager/service';
import { SystemPrompt, PlannerPrompt } from './prompts';
import {
  convertInputMessages,
  extractJsonFromModelOutput,
  ModelResponse,
  saveConversation,
} from './message_manager/utils';
import { hasBranchPathHash, hasModel, hasModelName } from './types';
import { DOMHistoryElement } from '../dom/views';

// Define BufferEncoding type for consistency
type BufferEncoding = 'utf-8' | 'utf8' | 'ascii' | 'binary' | 'base64' | 'hex';
// We don't need to import DOMHistoryElement from dom/views.ts anymore
// since we're using 'any' type for interactedElements to match Python's duck typing behavior
// import { HistoryTreeProcessor } from '../dom/history_tree_processor/service';

/**
 * Options for the Agent constructor.
 */
export interface AgentConstructorOptions<Context = unknown> {
  context?: Context;
  injectedAgentState?: AgentState;
  plannerInterval?: number;
  plannerLlm?: BaseChatModel;
  pageExtractionLlm?: BaseChatModel;
  toolCallingMethod?: ToolCallingMethod;
  includeAttributes?: string[];
  maxActionsPerStep?: number;
  availableFilePaths?: string[];
  generateGif?: boolean | string;
  messageContext?: string;
  validateOutput?: boolean;
  maxInputTokens?: number;
  extendSystemMessage?: string;
  overrideSystemMessage?: string;
  retryDelay?: number;
  maxFailures?: number;
  saveConversationPathEncoding?: string;
  saveConversationPath?: string;
  useVisionForPlanner?: boolean;
  useVision?: boolean;
  useSnapshotForAI?: boolean;
  registerExternalAgentStatusRaiseErrorCallback?: () => Promise<boolean>;
  registerNewStepCallback?: (
    state: BrowserState,
    modelOutput: AgentOutput,
    step: number
  ) => Promise<void>;
  registerDoneCallback?: (history: AgentHistoryList) => Promise<void>;
  initialActions?: RawAction[];
  sensitiveData?: Record<string, string>;
  controller?: Controller<Context>;
  browserContext?: BrowserContext;
}

// Stronger typing for incoming raw actions
type ActionParams = Record<string, unknown>;
type RawAction = Record<string, ActionParams>;

/**
 * Utility function to log the model's response
 */
function logResponse(response: AgentOutput): void {
  let emoji = '🤷';

  // Check if currentState and its properties exist before accessing them
  if (response.currentState) {
    // In the Python implementation, these are in AgentBrain which is used in currentState
    const evaluationPreviousGoal = response.currentState.evaluationPreviousGoal || '';
    const memory = response.currentState.memory || '';
    const nextGoal = response.currentState.nextGoal || '';

    if (evaluationPreviousGoal.includes('Success')) {
      emoji = '👍';
    } else if (evaluationPreviousGoal.includes('Failed')) {
      emoji = '⚠';
    }

    console.info(`${emoji} Eval: ${evaluationPreviousGoal}`);
    console.info(`🧠 Memory: ${memory}`);
    console.info(`🎯 Next goal: ${nextGoal}`);
  } else {
    console.info('No current state in response');
  }

  // Ensure action exists and is an array before iterating
  if (response.action && Array.isArray(response.action)) {
    for (let i = 0; i < response.action.length; i++) {
      // Log the action details, similar to Python's model_dump_json
      console.info(`🛠️ Action ${i + 1}/${response.action.length}`);
    }
  } else {
    console.info('No actions in response');
  }
}

function agentOutputToModelResponse(output: AgentOutput): ModelResponse {
  const parsed = JSON.parse(JSON.stringify(output)) as Record<string, unknown>;
  const raw = (output as unknown as { raw?: unknown }).raw;
  // Return an object that conforms to ModelResponse. Use type assertion only for the exported type.
  const response = { parsed, raw } as ModelResponse;
  return response;
}

/**
 * Agent class for browser automation
 */
export class Agent<Context = unknown> {
  task: string;
  llm: BaseChatModel;
  controller: Controller<Context>;
  sensitiveData?: Record<string, string>;
  settings: AgentSettings;
  state: AgentState;
  ActionModel!: typeof ActionModel;
  AgentOutput: AgentOutputClass = AgentOutput;
  AgentOutputSchema: StructuredOutputSchema = {
    name: 'AgentOutput',
    description: 'Output model for agent with actions to execute',
    parameters: AgentOutput.schema,
  };
  DoneActionModel!: typeof ActionModel;
  // We need a flexible class reference here when switching between AgentOutput and DoneAgentOutput
  DoneAgentOutput: AgentOutputClass = DoneAgentOutput as unknown as AgentOutputClass;
  DoneAgentOutputSchema: StructuredOutputSchema = {
    name: 'DoneAgentOutput',
    description: 'Output model for agent when the task is complete',
    parameters: DoneAgentOutput.schema,
  };
  availableActions: string;
  toolCallingMethod?: ToolCallingMethod;
  injectedBrowser: boolean = false;
  injectedBrowserContext: boolean;
  browserContext: BrowserContext;
  registerNewStepCallback?: (
    state: BrowserState,
    modelOutput: AgentOutput,
    step: number
  ) => Promise<void>;
  registerDoneCallback?: (history: AgentHistoryList) => Promise<void>;
  registerExternalAgentStatusRaiseErrorCallback?: () => Promise<boolean>;
  context?: Context;
  private _messageManager: MessageManager;
  initialActions?: ActionModel[];
  version: string = 'unknown';
  source: string = 'unknown';
  chatModelLibrary: string = 'unknown';
  modelName: string = 'Unknown';
  plannerModelName?: string = undefined;

  /**
   * Constructor for the Agent class
   */
  constructor(task: string, llm: BaseChatModel, options: AgentConstructorOptions<Context> = {}) {
    // Destructure options
    const {
      context = {} as Context,
      injectedAgentState,
      plannerInterval = 1,
      plannerLlm,
      pageExtractionLlm,
      toolCallingMethod = 'auto',
      includeAttributes = [
        'title',
        'type',
        'name',
        'role',
        'aria-label',
        'placeholder',
        'value',
        'alt',
        'aria-expanded',
        'data-date-format',
      ],
      maxActionsPerStep = 10,
      availableFilePaths,
      generateGif = false,
      messageContext,
      validateOutput = false,
      maxInputTokens = 128000,
      extendSystemMessage,
      overrideSystemMessage,
      retryDelay = 10,
      maxFailures = 3,
      saveConversationPathEncoding = 'utf-8',
      saveConversationPath,
      useVisionForPlanner = false,
      useVision = true,
      useSnapshotForAI = false,
      registerExternalAgentStatusRaiseErrorCallback = async () => false,
      registerNewStepCallback = async () => Promise.resolve(),
      registerDoneCallback = async () => Promise.resolve(),
      initialActions,
      sensitiveData,
      controller = new Controller<Context>(),
      browserContext,
    } = options;

    // Set page extraction LLM to main LLM if not provided
    const finalPageExtractionLlm = pageExtractionLlm || llm;

    // Core components
    this.task = task;
    this.llm = llm;
    this.controller = controller;
    this.sensitiveData = sensitiveData || {}; // Use sensitiveData from options

    this.settings = new AgentSettings();
    this.settings.useVision = useVision;
    this.settings.useVisionForPlanner = useVisionForPlanner;
    this.settings.saveConversationPath = saveConversationPath || '';
    this.settings.saveConversationPathEncoding = saveConversationPathEncoding;
    this.settings.maxFailures = maxFailures;
    this.settings.retryDelay = retryDelay;
    this.settings.overrideSystemMessage = overrideSystemMessage || '';
    this.settings.extendSystemMessage = extendSystemMessage || '';
    this.settings.maxInputTokens = maxInputTokens;
    this.settings.validateOutput = validateOutput;
    this.settings.messageContext = messageContext || '';
    this.settings.generateGif = generateGif;
    this.settings.availableFilePaths = availableFilePaths || [];
    this.settings.includeAttributes = includeAttributes;
    this.settings.maxActionsPerStep = maxActionsPerStep;
    this.settings.toolCallingMethod = toolCallingMethod;
    // Keep pageExtractionLlm as the BaseChatModel (no cast)
    this.settings.pageExtractionLlm = finalPageExtractionLlm;
    this.settings.plannerLlm = plannerLlm || null;
    this.settings.plannerInterval = plannerInterval;
    this.settings.useSnapshotForAI = useSnapshotForAI;

    // Initialize state
    this.state = injectedAgentState || new AgentState();

    // Action setup
    this._setupActionModels();
    this._setBrowserUseVersionAndSource();
    this.initialActions = initialActions ? this._convertInitialActions(initialActions) : [];

    // Model setup
    this._setModelNames();

    // Browser setup - this build expects a BrowserContext to be supplied.
    this.injectedBrowserContext = browserContext !== undefined;

    if (browserContext) {
      // Use provided BrowserContext (takes precedence)
      this.browserContext = browserContext;
      this.injectedBrowserContext = true;
    } else {
      // In this variant we don't create or manage a Browser instance.
      // Require callers to provide a BrowserContext explicitly.
      throw new Error(
        'Agent requires a BrowserContext provided via options.browserContext in this build'
      );
    }

    // For models without tool calling, add available actions to context
    if (typeof this.controller.registry.getPromptDescription === 'function') {
      this.availableActions = this.controller.registry.getPromptDescription();
    } else {
      this.availableActions = '';
    }

    // Determine actual tool calling method based on model/settings
    this.toolCallingMethod = this._setToolCallingMethod() || 'auto';
    // Update message context based on determined tool calling method
    this.settings.messageContext = this._setMessageContext() || '';

    // Initialize message manager with state
    this._messageManager = new MessageManager(
      task,
      new SystemPrompt(
        this.availableActions,
        this.settings.maxActionsPerStep,
        this.settings.overrideSystemMessage,
        this.settings.extendSystemMessage,
        this.settings.useSnapshotForAI
      ).getSystemMessage(),
      new MessageManagerSettings(
        this.settings.maxInputTokens,
        this.settings.includeAttributes,
        this.settings.messageContext,
        sensitiveData,
        this.settings.availableFilePaths,
        this.settings.useSnapshotForAI
      ),
      this.state.messageManagerState
    );

    // Callbacks
    this.registerNewStepCallback = registerNewStepCallback;
    this.registerDoneCallback = registerDoneCallback;
    this.registerExternalAgentStatusRaiseErrorCallback =
      registerExternalAgentStatusRaiseErrorCallback;

    // Context
    this.context = context;

    if (this.settings.saveConversationPath) {
      console.info(`Saving conversation to ${this.settings.saveConversationPath}`);
    }
  }

  /**
   * Set message context based on tool calling method
   */
  private _setMessageContext(): string | null {
    if (this.toolCallingMethod === 'raw') {
      if (this.settings.messageContext) {
        this.settings.messageContext += `\n\nAvailable actions: ${this.availableActions}`;
      } else {
        this.settings.messageContext = `Available actions: ${this.availableActions}`;
      }
    }
    return this.settings.messageContext;
  }

  /**
   * Set browser-use version and source
   */
  private _setBrowserUseVersionAndSource(): void {
    // In TypeScript implementation, we'll just set default values
    // Version tracking would be implemented differently in a TypeScript package
    this.version = '0.1.0';
    this.source = 'typescript';
  }

  /**
   * Set model names based on LLM properties
   */
  private _setModelNames(): void {
    this.chatModelLibrary =
      (this.llm && (this.llm as { constructor?: { name?: string } }).constructor?.name) ||
      'Unknown';
    this.modelName = 'Unknown';

    if (hasModelName(this.llm)) {
      this.modelName = this.llm.modelName || 'Unknown';
    } else if (hasModel(this.llm)) {
      this.modelName = this.llm.model || 'Unknown';
    } else {
      // Defensive fallback: attempt to read string-like properties safely
      const rec = this.llm as unknown as Record<string, unknown>;
      const maybeModelName = rec['modelName'] ?? rec['model'];
      if (typeof maybeModelName === 'string' && maybeModelName.length > 0) {
        this.modelName = maybeModelName;
      } else {
        this.modelName = 'Unknown';
      }
    }

    // Planner model name: use same guarded approach
    if (this.settings.plannerLlm) {
      const planner = this.settings.plannerLlm as unknown;
      if (hasModelName(planner)) {
        this.plannerModelName = planner.modelName;
      } else if (hasModel(planner)) {
        this.plannerModelName = planner.model;
      } else {
        const rec = planner as Record<string, unknown>;
        const maybePlanner = rec['modelName'] ?? rec['model'];
        this.plannerModelName = typeof maybePlanner === 'string' ? maybePlanner : 'Unknown';
      }
    } else {
      this.plannerModelName = undefined;
    }
  }

  /**
   * Setup dynamic action models from controller's registry
   */
  private _setupActionModels(): void {
    // Match Python implementation exactly
    this.ActionModel = this.controller.registry.createActionModel();
    // Create output model with the dynamic actions
    this.AgentOutput = AgentOutput.typeWithCustomActions(this.ActionModel);

    // Used to force the done action when max_steps is reached
    this.DoneActionModel = this.controller.registry.createActionModel(['done']);
    this.DoneAgentOutput = AgentOutput.typeWithCustomActions(this.DoneActionModel);
  }

  /**
   * Set tool calling method based on model type
   */
  private _setToolCallingMethod(): ToolCallingMethod | undefined {
    const toolCallingMethod = this.settings.toolCallingMethod;
    if (toolCallingMethod === 'auto') {
      if (this.modelName.includes('deepseek-reasoner') || this.modelName.includes('deepseek-r1')) {
        return 'raw';
      } else if (this.chatModelLibrary === 'ChatGoogleGenerativeAI') {
        return undefined;
      } else if (this.chatModelLibrary === 'ChatOpenAI') {
        return 'function_calling';
      } else if (this.chatModelLibrary === 'AzureChatOpenAI') {
        return 'function_calling';
      } else {
        return undefined;
      }
    } else {
      return toolCallingMethod === null ? undefined : toolCallingMethod;
    }
  }

  /**
   * Add a new task to the agent
   */
  addNewTask(newTask: string): void {
    this._messageManager.addNewTask(newTask);
  }

  /**
   * Utility function that raises an InterruptedError if the agent is stopped or paused
   */
  private async _raiseIfStoppedOrPaused(): Promise<void> {
    if (this.registerExternalAgentStatusRaiseErrorCallback) {
      if (await this.registerExternalAgentStatusRaiseErrorCallback()) {
        throw new Error('Interrupted');
      }
    }

    if (this.state.stopped || this.state.paused) {
      throw new Error('Interrupted');
    }
  }

  /**
   * Execute one step of the task
   */
  async step(stepInfo?: AgentStepInfo): Promise<void> {
    console.info(`📍 Step ${this.state.nSteps}`);
    let state: BrowserState | null = null;
    let modelOutput: AgentOutput | null = null;
    let result: ActionResult[] = [];
    const stepStartTime = Date.now() / 1000;
    let tokens = 0;

    try {
      state = await this.browserContext.getState();

      await this._raiseIfStoppedOrPaused();

      // Generate snapshot for AI if enabled
      let snapshotForAI: string | undefined;
      if (this.settings.useSnapshotForAI) {
        try {
          // Check if we're on a restricted URL that doesn't allow script execution
          const currentPage = await this.browserContext.getCurrentPage();
          const currentUrl = currentPage.url();
          const isRestrictedUrl =
            currentUrl.startsWith('chrome://') ||
            currentUrl.startsWith('chrome-extension://') ||
            currentUrl.startsWith('about:') ||
            currentUrl.startsWith('moz-extension://');

          if (isRestrictedUrl) {
            console.warn(`🚫 Skipping AI snapshot on restricted URL: ${currentUrl}`);
            console.warn(
              '💡 Navigate to a regular website (like google.com) to enable AI snapshot features'
            );
            snapshotForAI = undefined;
          } else {
            console.log('🤖 Generating AI snapshot using cordyceps snapshotForAI...');
            snapshotForAI = await this.browserContext.snapshotForAI();
            console.log(`✅ AI snapshot generated: ${snapshotForAI.length} characters`);

            // Smart extraction to capture search results while managing token limits
            const maxSnapshotSize = 15000; // Increased limit to capture search results properly
            if (snapshotForAI.length > maxSnapshotSize) {
              const originalLength = snapshotForAI.length;
              snapshotForAI = this._extractRelevantContent(snapshotForAI, maxSnapshotSize);
              console.log(
                `⚠️ Smart extraction: ${originalLength} → ${snapshotForAI.length} characters`
              );
            }

            // Log the content for debugging (now truncated)
            console.log('📄 === AI SNAPSHOT CONTENT (TRUNCATED FOR POC) ===');
            console.log(snapshotForAI);
            console.log('📄 === END AI SNAPSHOT CONTENT ===');
          }
        } catch (error) {
          console.warn('❌ Failed to generate AI snapshot, falling back to DOM elements:', error);
          // Continue without snapshot - the AgentMessagePrompt will use traditional DOM elements
          snapshotForAI = undefined;
        }
      }

      // DEBUG: Log the snapshot being passed to message manager
      if (snapshotForAI) {
        console.log(
          `🔍 Snapshot being passed to message manager: ${snapshotForAI.length} characters`
        );
        console.log(`🔍 First 200 chars:`, snapshotForAI.substring(0, 200));
      } else {
        console.log(`🔍 No snapshot being passed to message manager`);
      }

      this._messageManager.addStateMessage(
        state,
        this.state.lastResult,
        stepInfo,
        this.settings.useVision,
        snapshotForAI
      );

      // Run planner at specified intervals if planner is configured
      if (this.settings.plannerLlm && this.state.nSteps % this.settings.plannerInterval === 0) {
        const plan = await this._runPlanner();
        // Add plan before last state message
        this._messageManager.addPlan(plan, -1);
      }

      if (stepInfo && stepInfo.isLastStep()) {
        // Add last step warning if needed
        let msg =
          'Now comes your last step. Use only the "done" action now. No other actions - ' +
          'so here your action sequence must have length 1.';
        msg += '\nYou MUST include BOTH of these fields in your done action:';
        msg += '\n1. text: A detailed summary of everything you found out for the ultimate task';
        msg +=
          '\n2. success: Set to true if the task is fully finished, or false if not completely finished';
        msg +=
          '\n\nExample of correct format: {"done": {"text": "Found the information about X. The results show...", ' +
          '"success": true}}';
        msg += '\n\nBoth fields are REQUIRED - the action will fail if either is missing.';
        console.info('Last step finishing up');
        this._messageManager.addMessageWithTokens(new HumanMessage(msg));
        this.AgentOutput = this.DoneAgentOutput;
        this.AgentOutputSchema = this.DoneAgentOutputSchema;
      }

      const inputMessages = this._messageManager.getMessages();
      tokens = this._messageManager.state.history.currentTokens;
      try {
        modelOutput = await this.getNextAction(inputMessages);

        this.state.nSteps += 1;

        if (this.registerNewStepCallback) {
          await this.registerNewStepCallback(state, modelOutput, this.state.nSteps);
        }

        if (this.settings.saveConversationPath) {
          const target = `${this.settings.saveConversationPath}_${this.state.nSteps}.txt`;
          const encoding = this.settings.saveConversationPathEncoding;
          await saveConversation(
            inputMessages,
            agentOutputToModelResponse(modelOutput),
            target,
            encoding && ['utf-8', 'utf8', 'ascii', 'binary', 'base64', 'hex'].includes(encoding)
              ? (encoding as BufferEncoding)
              : 'utf-8'
          );
        }

        this._messageManager.removeLastStateMessage(); // We don't want the whole state in the chat history

        await this._raiseIfStoppedOrPaused();

        this._messageManager.addModelOutput(modelOutput);
      } catch (e) {
        // Model call failed, remove last state message from history
        this._messageManager.removeLastStateMessage();
        throw e;
      }

      result = await this.multiAct(modelOutput.action);

      this.state.lastResult = result;

      if (result && result.length > 0) {
        const lastResult = result[result.length - 1];
        if (lastResult?.isDone) {
          // Match Python implementation by logging the extracted content
          console.info(`📄 Result: ${lastResult.extractedContent || 'No content'}`);
        }
      }

      this.state.consecutiveFailures = 0;
    } catch (e) {
      if ((e as Error).message === 'Interrupted') {
        console.debug('Agent paused');
        this.state.lastResult = [
          new ActionResult({
            error: 'The agent was paused - now continuing actions might need to be repeated',
            includeInMemory: true,
          }),
        ];
        return;
      }

      result = await this._handleStepError(e as Error);
      this.state.lastResult = result;
    } finally {
      const stepEndTime = Date.now() / 1000;

      // Equivalent to Python's telemetry capturing
      // We're not implementing telemetry here as per Python code structure

      if (result && state) {
        const metadata = new StepMetadata(this.state.nSteps, stepStartTime, stepEndTime, tokens);
        this._makeHistoryItem(modelOutput, state, result, metadata);
      }
    }
  }

  /**
   * Handle all types of errors that can occur during a step
   */
  private async _handleStepError(error: Error): Promise<ActionResult[]> {
    // Circuit breaker: Check for persistent network failures
    if (this._isNetworkFailure(error)) {
      this._networkFailureCount++;
      console.warn(`🌐 Network failure ${this._networkFailureCount}/${this.MAX_NETWORK_FAILURES}`);

      if (this._networkFailureCount >= this.MAX_NETWORK_FAILURES) {
        const circuitBreakerMsg =
          `Circuit breaker activated: ${this._networkFailureCount} consecutive network failures. ` +
          `Stopping agent to prevent endless loop.`;
        console.error(`🚨 ${circuitBreakerMsg}`);
        this.state.stopped = true; // Stop the agent
        return [
          new ActionResult({
            error: circuitBreakerMsg,
            includeInMemory: true,
          }),
        ];
      }
    } else {
      // Reset network failure count on non-network errors
      this._networkFailureCount = 0;
    }
    const includeTrace = true; // Equivalent to logger.isEnabledFor(logging.DEBUG) in Python
    let errorMsg = AgentError.formatError(error, includeTrace);
    const prefix = `❌ Result failed ${this.state.consecutiveFailures + 1}/${
      this.settings.maxFailures
    } times:\n `;
    // In Python: if isinstance(error, (ValidationError, ValueError)):
    // We can't directly check for ValidationError in TypeScript, so we check for common validation errors
    if (
      error.name === 'ValidationError' ||
      error.name === 'TypeError' ||
      error.name === 'ValueError' ||
      error.name === 'Error'
    ) {
      // In Python: logger.error(f'{prefix}{error_msg}')
      console.error(`${prefix}${errorMsg}`);

      // In Python: if 'Max token limit reached' in error_msg:
      if (
        errorMsg.includes('Max token limit reached') ||
        errorMsg.includes("400 This model's maximum context length is 128000 tokens")
      ) {
        // In Python: # cut tokens from history
        this._messageManager.settings.maxInputTokens = this.settings.maxInputTokens - 500;
        // In Python: logger.info(f'Cutting tokens from history - new max input tokens:
        // {self._message_manager.settings.max_input_tokens}')
        console.info(
          `Cutting tokens from history - new max input tokens: ${this._messageManager.settings.maxInputTokens}`
        );
        // In Python: self._message_manager.cut_messages()
        this._messageManager.cutMessages();
      }
      // In Python: elif 'Could not parse response' in error_msg:
      else if (errorMsg.includes('Could not parse response')) {
        // In Python: # give model a hint how output should look like
        // In Python: error_msg += '\n\nReturn a valid JSON object with the required fields.'
        errorMsg += '\n\nReturn a valid JSON object with the required fields.';
      }

      // In Python: self.state.consecutive_failures += 1
      this.state.consecutiveFailures += 1;
    }
    // In Python: else:
    else {
      // In Python: if isinstance(error, RateLimitError) or isinstance(error, ResourceExhausted):
      // Check for rate limit errors (similar to Python's RateLimitError or ResourceExhausted)
      const isRateLimit =
        error.name === 'RateLimitError' ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('capacity');

      if (isRateLimit) {
        // In Python: logger.warning(f'{prefix}{error_msg}')
        console.warn(`${prefix}${errorMsg}`);
        // In Python: await asyncio.sleep(self.settings.retry_delay)
        await new Promise(resolve => setTimeout(resolve, this.settings.retryDelay * 1000));
        // In Python: self.state.consecutive_failures += 1
        this.state.consecutiveFailures += 1;
      } else {
        // In Python: logger.error(f'{prefix}{error_msg}')
        console.error(`${prefix}${errorMsg}`);
        // In Python: self.state.consecutive_failures += 1
        this.state.consecutiveFailures += 1;
      }
    }

    // In Python: return [ActionResult(error=error_msg, include_in_memory=True)]
    // This is important - the error is included in memory so the agent knows about the failure
    return [
      new ActionResult({
        error: errorMsg,
        includeInMemory: true,
      }),
    ];
  }

  /**
   * Create and store history item
   */
  private _makeHistoryItem(
    modelOutput: AgentOutput | null,
    state: BrowserState,
    result: ActionResult[],
    metadata?: StepMetadata
  ): void {
    if (!state) {
      console.warn('Attempted to create history item with undefined state');
      return;
    }
    if (!result || !Array.isArray(result)) {
      console.warn('Attempted to create history item with invalid result');
      result = [new ActionResult({ error: 'Invalid result' })];
    }
    // Initialize with a default null element
    // In the Python implementation, the type compatibility is handled automatically
    let interactedElements: (DOMHistoryElement | null)[] = [null];

    if (modelOutput) {
      // Get the interacted elements from the model output
      // In the Python implementation, this works seamlessly due to duck typing
      interactedElements =
        AgentHistory.getInteractedElement(modelOutput, state.selectorMap || {}) || [];
    }

    // Create a properly typed BrowserStateHistory object
    // The interactedElements need to be cast to the correct DOMHistoryElement type
    // from dom/views.ts which BrowserStateHistory expects

    // In the Python implementation, this works seamlessly because both classes have compatible structures
    // In TypeScript, we need to use a type assertion to maintain the same behavior
    // without adding any specialized handling logic not present in the Python code
    const stateHistory = new BrowserStateHistory(
      state.url || '',
      state.title || '',
      state.tabs || [],
      // In Python, duck typing allows these compatible types to work together
      // In TypeScript, we need to use a type assertion to maintain the same behavior
      // This is the most direct equivalent to how the Python code works
      interactedElements,
      state.screenshot || undefined
    );

    // Match the AgentHistory constructor parameter order: modelOutput, result, state, metadata
    // We need to ensure the interactedElements are properly typed for BrowserStateHistory
    const historyItem = new AgentHistory(modelOutput, result, stateHistory, metadata);

    this.state.history.history.push(historyItem);
  }

  // Regular expression patterns for removing think tags
  // Equivalent to Python's re.compile(r'<think>.*?</think>', re.DOTALL)
  private readonly THINK_TAGS = /<think>[\s\S]*?<\/think>/g;
  // Equivalent to Python's re.compile(r'.*?</think>', re.DOTALL)
  private readonly STRAY_CLOSE_TAG = /[\s\S]*?<\/think>/g;

  // Circuit breaker for persistent network failures
  private _networkFailureCount = 0;
  private readonly MAX_NETWORK_FAILURES = 3;

  /**
   * Remove think tags from text
   */
  private _removeThinkTags(text: string): string {
    // Step 1: Remove well-formed <think>...</think>
    text = text.replace(this.THINK_TAGS, '');
    // Step 2: If there's an unmatched closing tag </think>,
    //         remove everything up to and including that.
    text = text.replace(this.STRAY_CLOSE_TAG, '');
    return text.trim();
  }

  /**
   * Convert input messages to the correct format
   */
  private _convertInputMessages(inputMessages: BaseMessage[]): BaseMessage[] {
    if (
      this.modelName === 'deepseek-reasoner' ||
      (this.modelName && this.modelName.includes('deepseek-r1'))
    ) {
      return convertInputMessages(inputMessages, this.modelName);
    } else {
      return inputMessages;
    }
  }

  /**
   * Check if an error is a network failure that should trigger circuit breaker
   */
  private _isNetworkFailure(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Check for network-related errors
    return (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('enotfound') ||
      errorName === 'timeouterror' ||
      errorName === 'networkerror' ||
      errorName === 'typeerror' // Often indicates fetch/network issues
    );
  }

  /**
   * Track telemetry for each step
   * This would be expanded in a production environment
   */
  // private _trackStepTelemetry(modelOutput: AgentOutput | null, result: ActionResult[], duration: number): void {
  // In a production environment, this would send telemetry data to a monitoring system
  // For now, we'll just log some basic information

  /**
   * Helper function to trim content for logging
   */
  private _trimContent(content: MessageContent, maxLength: number = 500): string {
    if (content === null || content === undefined) {
      return 'null';
    }

    let stringContent = '';

    if (typeof content === 'string') {
      stringContent = content;
    } else if (typeof content === 'object') {
      try {
        stringContent = JSON.stringify(content);
      } catch (e) {
        stringContent = String(content);
      }
    } else {
      stringContent = String(content);
    }

    if (stringContent.length <= maxLength) {
      return stringContent;
    }

    return (
      stringContent.substring(0, maxLength) +
      `... [${stringContent.length - maxLength} more characters]`
    );
  }

  /**
   * Get next action from LLM based on current state
   * Direct port of the Python implementation
   */
  async getNextAction(inputMessages: BaseMessage[]): Promise<AgentOutput> {
    // In Python: input_messages = self._convert_input_messages(input_messages)
    inputMessages = this._convertInputMessages(inputMessages);

    let parsed: AgentOutput | null = null;

    // In Python: try/except block
    // In Python: if self.tool_calling_method == 'raw':
    if (this.toolCallingMethod === 'raw') {
      // Log request size before sending to OpenAI
      const requestContent = inputMessages.map(msg => msg.content).join('\n');
      const requestSize = requestContent.length;
      console.log(`📊 OpenAI Request Size: ${requestSize} characters`);
      console.log(`📊 Estimated tokens: ~${Math.ceil(requestSize * 1.3)} tokens`);

      // DEBUG: Log each message to find the large one
      inputMessages.forEach((msg, index) => {
        const contentStr =
          typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
        const msgSize = contentStr.length;
        console.log(`📋 Message ${index}: ${msgSize} characters (${msg.constructor.name})`);
        if (msgSize > 50000) {
          console.log(`⚠️ LARGE MESSAGE DETECTED! First 500 chars:`, contentStr.substring(0, 500));
        }
      });

      // In Python: output = self.llm.invoke(input_messages)
      const output = await this.llm.invoke(inputMessages);

      // In Python: output.content = self._remove_think_tags(str(output.content))
      const cleanedContent = this._removeThinkTags(String(output.content));

      // In Python: try/except block for parsing
      try {
        // In Python: parsed_json = extract_json_from_model_output(output.content)
        const parsedJson = extractJsonFromModelOutput(cleanedContent);
        // In Python: parsed = self.AgentOutput(**parsed_json)
        parsed = new AgentOutput(parsedJson);
      } catch (e) {
        // In Python: logger.warning(f'Failed to parse model output: {output} {str(e)}')
        console.warn(`Failed to parse model output: ${this._trimContent(output.content)} ${e}`);
        // In Python: raise ValueError('Could not parse response.')
        throw new Error('Could not parse response.');
      }
    }
    // In Python: elif self.tool_calling_method is None:
    else if (this.toolCallingMethod === undefined || this.toolCallingMethod === null) {
      // Log request size before sending to OpenAI
      const requestContent = inputMessages.map(msg => msg.content).join('\n');
      const requestSize = requestContent.length;
      console.log(`📊 OpenAI Request Size (structured): ${requestSize} characters`);
      console.log(`📊 Estimated tokens: ~${Math.ceil(requestSize * 1.3)} tokens`);

      // In Python: structured_llm = self.llm.with_structured_output(self.AgentOutput, include_raw=True)
      const structuredLlm = this.llm.withStructuredOutput(this.AgentOutputSchema, {
        includeRaw: true,
      });
      // In Python: response: dict[str, Any] = await structured_llm.ainvoke(input_messages)
      const response: StructuredLlmResponse = await structuredLlm.invoke(inputMessages);
      // In Python: parsed: AgentOutput | None = response['parsed']
      parsed = response.parsed ? new AgentOutput(response.parsed) : null;
    }
    // In Python: else:
    else {
      // Log request size before sending to OpenAI
      const requestContent = inputMessages.map(msg => msg.content).join('\n');
      const requestSize = requestContent.length;
      console.log(`📊 OpenAI Request Size (${this.toolCallingMethod}): ${requestSize} characters`);
      console.log(`📊 Estimated tokens: ~${Math.ceil(requestSize * 1.3)} tokens`);

      // In Python: structured_llm = self.llm.with_structured_output(...)
      const structuredLlm = this.llm.withStructuredOutput(this.AgentOutputSchema, {
        includeRaw: true,
        method: this.toolCallingMethod,
      });
      // In Python: response = await structured_llm.ainvoke(input_messages)
      const response: StructuredLlmResponse = await structuredLlm.invoke(inputMessages);

      // In Python: parsed = response['parsed']
      parsed = response.parsed ? new AgentOutput(response.parsed) : null;
    }

    // In Python: if parsed is None:
    if (parsed === null) {
      // In Python: raise ValueError('Could not parse response.')
      throw new Error('Could not parse response.');
    }

    // In Python: if len(parsed.action) > self.settings.max_actions_per_step:
    if (parsed.action && parsed.action.length > this.settings.maxActionsPerStep) {
      // In Python: parsed.action = parsed.action[: self.settings.max_actions_per_step]
      parsed.action = parsed.action.slice(0, this.settings.maxActionsPerStep);
    }

    // In Python: log_response(parsed)
    logResponse(parsed);

    // In Python: return parsed
    return parsed;
  }

  /**
   * Execute multiple actions
   */
  async multiAct(
    actions: ActionModel[],
    checkForNewElements: boolean = true
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    const cachedSelectorMap = await this.browserContext.getSelectorMap();
    // Match Python: cached_path_hashes = set(e.hash.branch_path_hash for e in cached_selector_map.values())
    const cachedPathHashes = new Set<string>();
    if (cachedSelectorMap) {
      Object.values(cachedSelectorMap).forEach(element => {
        if (hasBranchPathHash(element)) {
          cachedPathHashes.add(element.hash.branchPathHash);
        }
      });
    }

    await this.browserContext.removeHighlights();

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      if (
        action &&
        typeof action.getIndex === 'function' &&
        action.getIndex() !== null &&
        i !== 0
      ) {
        const newState = await this.browserContext.getState();
        const newPathHashes = new Set<string>();

        if (newState && newState.selectorMap) {
          for (const elementUnknown of Object.values(newState.selectorMap) as unknown[]) {
            if (hasBranchPathHash(elementUnknown)) {
              newPathHashes.add(
                (elementUnknown as { hash: { branchPathHash: string } }).hash.branchPathHash
              );
            }
          }
        }

        // Match Python: if check_for_new_elements and not new_path_hashes.issubset(cached_path_hashes):
        // Check if newPathHashes is NOT a subset of cachedPathHashes
        const isSubset = Array.from(newPathHashes).every(hash => cachedPathHashes.has(hash));
        if (checkForNewElements && !isSubset) {
          // next action requires index but there are new elements on the page
          const msg = `Something new appeared after action ${i} / ${actions.length}`;
          console.info(msg); // logger.info in Python
          const result = new ActionResult({
            extractedContent: msg,
            includeInMemory: true,
          });
          results.push(result);
          break;
        }
      }

      await this._raiseIfStoppedOrPaused();

      // Match Python's controller.act method exactly
      // Build a PageExtractionLLM adapter: prefer configured pageExtractionLlm, else adapt this.llm
      const pageExtractionAdapter: PageExtractionLLM | undefined = this.settings.pageExtractionLlm
        ? (this.settings.pageExtractionLlm as PageExtractionLLM)
        : {
            invoke: async (messages: Array<{ type: string; content: string }>) => {
              const converted = messages.map(m => new HumanMessage(String(m.content)));
              const resp = await this.llm.invoke(converted);

              // Handle different response formats
              let content = '';
              if (typeof resp === 'string') {
                content = resp;
              } else if (resp && typeof resp === 'object') {
                // Try different possible content properties
                if ('content' in resp && resp.content) {
                  content = String(resp.content);
                } else if ('text' in resp && resp.text) {
                  content = String(resp.text);
                } else if ('message' in resp && resp.message) {
                  content = String(resp.message);
                } else if ('response' in resp && resp.response) {
                  content = String(resp.response);
                } else {
                  // Fallback: try to stringify the entire response
                  content = JSON.stringify(resp);
                }
              }

              console.log(`🔍 PageExtractionLLM adapter response:`, {
                responseType: typeof resp,
                contentLength: content.length,
                contentPreview: content.substring(0, 100),
              });

              return { content };
            },
          };

      const result = await this.controller.act(
        action,
        this.browserContext,
        pageExtractionAdapter,
        this.sensitiveData,
        this.settings.availableFilePaths || undefined,
        this.context
      );

      results.push(result);

      console.debug(`Executed action ${i + 1} / ${actions.length}`); // logger.debug in Python

      if (
        results[results?.length - 1]?.isDone ||
        results[results?.length - 1]?.error ||
        i === actions.length - 1
      ) {
        break;
      }

      // Match Python implementation using config parameter
      if (this.browserContext.config && this.browserContext.config.waitBetweenActions) {
        await new Promise(resolve =>
          setTimeout(resolve, this.browserContext.config.waitBetweenActions)
        );
      }
      // hash all elements. if it is a subset of cached_state its fine - else break (new elements on page)
    }

    return results;
  }

  /**
   * Convert dictionary-based actions to ActionModel instances
   */
  private _convertInitialActions(actions: RawAction[]): ActionModel[] {
    const convertedActions: ActionModel[] = [];

    for (const actionDict of actions) {
      // Each action_dict should have a single key-value pair
      const actionName = Object.keys(actionDict)[0];
      if (!actionName) {
        console.warn('Action name is undefined');
        continue;
      }
      const params = actionDict[actionName];

      // Get the parameter model for this action from registry
      if (
        !this.controller.registry.registry.actions ||
        !this.controller.registry.registry.actions[actionName]
      ) {
        console.warn(`Action ${actionName} not found in registry`);
        continue;
      }

      const actionInfo = this.controller.registry.registry.actions[actionName];
      const paramModel = actionInfo.paramModel;

      // Create validated parameters using the appropriate param model
      const validatedParams = new paramModel();
      Object.assign(validatedParams, params);

      // Create ActionModel instance with the validated parameters
      const actionModel = new this.ActionModel({
        [actionName]: validatedParams,
      });
      convertedActions.push(actionModel);
    }

    return convertedActions;
  }

  /**
   * Run the planner to analyze state and suggest next steps
   */
  private async _runPlanner(): Promise<string | null> {
    if (!this.settings.plannerLlm) {
      return null;
    }

    const plannerMessages = [
      new PlannerPrompt(this.controller.registry.getPromptDescription()).getSystemMessage(),
      ...this._messageManager.getMessages().slice(1),
    ];

    if (!this.settings.useVisionForPlanner && this.settings.useVision) {
      const lastStateMessage = plannerMessages[plannerMessages.length - 1] as HumanMessage;
      let newMsg = '';

      if (Array.isArray(lastStateMessage.content)) {
        for (const msg of lastStateMessage.content) {
          if (typeof msg === 'object' && msg.type === 'text') {
            newMsg += msg.text;
          }
        }
      } else {
        newMsg = String(lastStateMessage.content);
      }

      plannerMessages[plannerMessages.length - 1] = new HumanMessage(newMsg);
    }

    const convertedMessages = this._convertInputMessages(plannerMessages);

    try {
      const response = await this.settings.plannerLlm.invoke(convertedMessages);
      const plan = String(response.content);

      if (
        this.plannerModelName &&
        (this.plannerModelName.includes('deepseek-r1') ||
          this.plannerModelName.includes('deepseek-reasoner'))
      ) {
        const cleanedPlan = this._removeThinkTags(plan);
        try {
          const planJson = JSON.parse(cleanedPlan);
          console.info(`Planning Analysis:\n${JSON.stringify(planJson, null, 4)}`);
        } catch (e) {
          console.info(`Planning Analysis:\n${cleanedPlan}`);
        }

        return cleanedPlan;
      } else {
        try {
          const planJson = JSON.parse(plan);
          console.info(`Planning Analysis:\n${JSON.stringify(planJson, null, 4)}`);
        } catch (e) {
          console.info(`Planning Analysis:\n${plan}`);
        }

        return plan;
      }
    } catch (e) {
      console.error(`Error in planner: ${e}`);
      return null;
    }
  }

  /**
   * Get the message manager
   */
  get messageManager(): MessageManager {
    return this._messageManager;
  }

  /**
   * Run the agent to completion
   */
  async run(
    maxSteps: number = 20,
    initialUrl?: string,
    initialActions?: ActionModel[],
    waitForUserInput: boolean = false
  ): Promise<AgentHistoryList> {
    console.info(`🤖 Starting agent with task: ${this.task}`);
    console.info(`🔧 Model: ${this.modelName}`);
    console.info(`🧠 Tool calling method: ${this.toolCallingMethod || 'default'}`);

    try {
      // Ensure a BrowserContext is available. In this build we don't manage Browser instances.
      if (!this.browserContext) {
        throw new Error('No BrowserContext available. Agent requires options.browserContext');
      }

      if (initialUrl) {
        const page = await this.browserContext.getCurrentPage();
        await page.goto(initialUrl);
      }

      if (initialActions && initialActions.length > 0) {
        console.info(`Executing ${initialActions.length} initial actions`);
        const results = await this.multiAct(initialActions, false);
        this.state.lastResult = results;
      } else if (this.initialActions && this.initialActions.length > 0) {
        console.info(`Executing ${this.initialActions.length} initial actions from constructor`);
        const results = await this.multiAct(this.initialActions, false);
        this.state.lastResult = results;
      }

      for (let i = 0; i < maxSteps; i++) {
        if (this.state.stopped || this.state.paused) {
          console.info('Agent stopped or paused');
          break;
        }

        if (this.state.consecutiveFailures >= this.settings.maxFailures) {
          console.error(
            `Too many consecutive failures (${this.state.consecutiveFailures}/${this.settings.maxFailures})`
          );
          break;
        }

        const stepInfo = new AgentStepInfo(i, maxSteps);
        await this.step(stepInfo);

        if (this.state.history.isDone()) {
          console.info('Agent completed task');
          break;
        }

        if (waitForUserInput) {
          console.info('Waiting for user input...');
        }
      }

      if (this.registerDoneCallback) {
        await this.registerDoneCallback(this.state.history);
      }

      if (this.settings.generateGif) {
        console.info('GIF generation would happen here');
      }

      return this.state.history;
    } catch (e) {
      console.error(`Error running agent: ${e}`);
      throw e;
    } finally {
      // No browser lifecycle management in this build; contexts are closed externally if needed.
    }
  }

  /**
   * Extract relevant content from large AI snapshots
   * Prioritizes main content areas and interactive elements
   */
  private _extractRelevantContent(snapshot: string, maxSize: number): string {
    // Strategy: Extract the most important sections for the current task
    const lines = snapshot.split('\n');
    const importantSections: string[] = [];
    let currentSize = 0;

    // Priority 1: Interactive elements and search results (first 80%)
    const navigationSize = Math.floor(maxSize * 0.8);
    let navContent = '';
    for (const line of lines) {
      // Include ALL lines with ARIA references (clickable elements) plus search-related content
      if (
        line.includes('[ref=') ||
        line.includes('search') ||
        line.includes('combobox') ||
        line.includes('wikipedia') ||
        line.includes('link') ||
        line.includes('button') ||
        line.includes('heading') ||
        line.includes('list') ||
        line.includes('listitem')
      ) {
        if (navContent.length + line.length < navigationSize) {
          navContent += line + '\n';
        } else {
          break;
        }
      }
    }
    if (navContent) {
      importantSections.push('=== ESSENTIAL CONTROLS ===\n' + navContent);
      currentSize += navContent.length;
    }

    // Priority 2: High-value content (remaining space)
    const highValueKeywords = [
      'elephant',
      'behavior',
      'social',
      'intelligence',
      'communication',
      'family',
      'herd',
      'trunk',
      'tusk',
    ];

    const mainContentLines: string[] = [];
    const remainingSize = maxSize - currentSize - 200; // Reserve space for footer
    let contentSize = 0;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      // Include lines with high-value keywords or essential actions
      const isHighValue =
        highValueKeywords.some(keyword => lowerLine.includes(keyword)) ||
        (line.includes('[ref=') && lowerLine.includes('extract'));

      if (isHighValue && contentSize + line.length < remainingSize) {
        mainContentLines.push(line);
        contentSize += line.length + 1; // +1 for newline
      }
    }

    if (mainContentLines.length > 0) {
      importantSections.push('\n=== MAIN CONTENT ===\n' + mainContentLines.join('\n'));
    }

    // Combine all sections
    let result = importantSections.join('\n');

    // Final safety check - but much more generous limit
    const safetyLimit = Math.min(maxSize, 12000); // Increased from 3k to 12k chars
    if (result.length > safetyLimit) {
      result =
        result.substring(0, safetyLimit - 100) +
        '\n\n[... CONTENT TRUNCATED for token management ...]';
    }

    return result;
  }
}
