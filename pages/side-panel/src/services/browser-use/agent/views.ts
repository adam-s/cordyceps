import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BrowserStateHistory } from '../browser/views';
import { SelectorMap, DOMElementNode, DOMHistoryElement } from '../dom/views';

// Types moved to types.ts
import {
  ToolCallingMethod,
  IAgentSettings,
  AgentSettingsSchema,
  IAgentState,
  AgentStateSchema,
  IAgentStepInfo,
  AgentStepInfoSchema,
  IActionResult,
  ActionResultSchema,
  IStepMetadata,
  StepMetadataSchema,
  IAgentBrain,
  AgentBrainSchema,
  IAgentOutput,
  AgentOutputSchema,
  IDoneAgentOutput,
  DoneAgentOutputSchema,
  AgentOutputData,
  DoneAgentOutputData,
} from './types';

// Forward declarations to avoid circular imports (value imports)
import { ActionModel } from '../controller/registry/views';
import { MessageManagerState } from './message_manager/views';

// Mock HistoryTreeProcessor for type compatibility
class HistoryTreeProcessor {
  static convertDomElementToHistoryElement(el: DOMElementNode): DOMHistoryElement {
    return el as unknown as DOMHistoryElement;
  }
}

// AgentSettings class (schema is imported from types.ts)
export class AgentSettings implements IAgentSettings {
  /**
   * Options for the agent
   */
  useVision: boolean = true;
  useVisionForPlanner: boolean = false;
  saveConversationPath: string | null = null;
  saveConversationPathEncoding: string | null = 'utf-8';
  maxFailures: number = 3;
  retryDelay: number = 10;
  maxInputTokens: number = 128000;
  validateOutput: boolean = false;
  messageContext: string | null = null;
  generateGif: boolean | string = false;
  availableFilePaths: string[] | null = null;
  overrideSystemMessage: string | null = null;
  extendSystemMessage: string | null = null;
  includeAttributes: string[] = [
    'title',
    'type',
    'name',
    'role',
    'tabindex',
    'aria-label',
    'placeholder',
    'value',
    'alt',
    'aria-expanded',
  ];
  maxActionsPerStep: number = 10;
  toolCallingMethod: ToolCallingMethod | null = 'auto';
  pageExtractionLlm: BaseChatModel | null = null;
  plannerLlm: BaseChatModel | null = null;
  plannerInterval: number = 1; // Run planner every N steps
  useSnapshotForAI: boolean = false;

  static schema = AgentSettingsSchema;

  constructor(data?: Partial<IAgentSettings>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}

// AgentHistoryList class
export class AgentHistoryList {
  /**
   * List of agent history items
   */
  history: AgentHistory[] = [];

  totalDurationSeconds(): number {
    /**
     * Calculate total duration of all steps in seconds
     */
    return this.history.reduce((total, item) => {
      if (item.metadata) {
        return total + item.metadata.durationSeconds;
      }
      return total;
    }, 0);
  }

  averageDurationSeconds(): number {
    /**
     * Calculate average duration of steps in seconds
     */
    if (this.history.length === 0) {
      return 0;
    }
    const historyWithMetadata = this.history.filter(item => item.metadata !== null);
    if (historyWithMetadata.length === 0) {
      return 0;
    }
    return this.totalDurationSeconds() / historyWithMetadata.length;
  }

  totalInputTokens(): number {
    /**
     * Calculate total input tokens for all steps
     */
    return this.history.reduce((total, item) => {
      if (item.metadata) {
        return total + item.metadata.inputTokens;
      }
      return total;
    }, 0);
  }

  averageInputTokens(): number {
    /**
     * Calculate average input tokens per step
     */
    if (this.history.length === 0) {
      return 0;
    }
    const historyWithMetadata = this.history.filter(item => item.metadata !== null);
    if (historyWithMetadata.length === 0) {
      return 0;
    }
    return this.totalInputTokens() / historyWithMetadata.length;
  }

  isDone(): boolean {
    /**
     * Check if the agent has completed its task
     */
    if (this.history.length === 0) {
      return false;
    }

    // Check if the last action result indicates completion
    const lastHistory = this.history[this.history.length - 1];
    if (lastHistory && lastHistory.result && lastHistory.result.length > 0) {
      const lastResult = lastHistory.result[lastHistory.result.length - 1];
      return lastResult ? lastResult.isDone === true : false;
    }

    return false;
  }

  toJSON(): Record<string, unknown>[] {
    /**
     * Serialize history list to JSON
     */
    return this.history.map(item => item.toJSON());
  }
}

export class AgentState implements IAgentState {
  /**
   * Holds all state information for an Agent
   */
  agentId: string = crypto.randomUUID();
  nSteps: number = 1;
  consecutiveFailures: number = 0;
  lastResult: ActionResult[] | null = null;
  history: AgentHistoryList = new AgentHistoryList();
  lastPlan: string | null = null;
  paused: boolean = false;
  stopped: boolean = false;
  messageManagerState: MessageManagerState = new MessageManagerState();
  errorHistory: Record<string, number> = {};

  static schema = AgentStateSchema;

  constructor(data?: Partial<IAgentState>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}

export class AgentStepInfo implements IAgentStepInfo {
  /**
   * Information about the current step
   */
  stepNumber: number;
  maxSteps: number;

  static schema = AgentStepInfoSchema;

  constructor(stepNumber: number, maxSteps: number) {
    this.stepNumber = stepNumber;
    this.maxSteps = maxSteps;
  }

  isLastStep(): boolean {
    /**
     * Check if this is the last step
     */
    return this.stepNumber >= this.maxSteps - 1;
  }
}

export class ActionResult implements IActionResult {
  /**
   * Result of executing an action
   */
  isDone: boolean | null = false;
  success: boolean | null = null;
  extractedContent: string | null = null;
  error?: string | null = null;
  includeInMemory: boolean = false; // whether to include in past messages as context or not

  static schema = ActionResultSchema;

  constructor(params: Partial<IActionResult> = {}) {
    if (params.isDone !== undefined) this.isDone = params.isDone;
    if (params.success !== undefined) this.success = params.success;
    if (params.extractedContent !== undefined) this.extractedContent = params.extractedContent;
    if (params.error !== undefined) this.error = params.error;
    if (params.includeInMemory !== undefined) this.includeInMemory = params.includeInMemory;
  }
}

export class StepMetadata implements IStepMetadata {
  /**
   * Metadata for a single step including timing and token information
   */
  stepStartTime: number;
  stepEndTime: number;
  inputTokens: number; // Approximate tokens from message manager for this step
  stepNumber: number;

  static schema = StepMetadataSchema;

  constructor(stepStartTime: number, stepEndTime: number, inputTokens: number, stepNumber: number) {
    this.stepStartTime = stepStartTime;
    this.stepEndTime = stepEndTime;
    this.inputTokens = inputTokens;
    this.stepNumber = stepNumber;
  }

  get durationSeconds(): number {
    /**
     * Calculate step duration in seconds
     */
    return this.stepEndTime - this.stepStartTime;
  }
}

export class AgentBrain {
  /**
   * Current state of the agent
   */
  evaluationPreviousGoal: string;
  memory: string;
  nextGoal: string;

  static schema = AgentBrainSchema;

  constructor(evaluationPreviousGoal: string, memory: string, nextGoal: string) {
    this.evaluationPreviousGoal = evaluationPreviousGoal;
    this.memory = memory;
    this.nextGoal = nextGoal;
  }
}

// AgentOutput schema is imported from types.ts

// DoneAgentOutput schema is imported from types.ts

// Interface for AgentOutput constructor data
export class AgentOutput implements IAgentOutput {
  /**
   * Output model for agent
   *
   * @dev note: this model is extended with custom actions in AgentService.
   * You can also use some fields that are not in this model as provided by the
   * linter, as long as they are registered in the DynamicActions model.
   */
  currentState: AgentBrain;
  action: ActionModel[];

  // Schema definition for structured output
  static schema = AgentOutputSchema;

  constructor(data: AgentOutputData) {
    this.currentState = new AgentBrain(
      data.current_state?.evaluation_previous_goal || '',
      data.current_state?.memory || '',
      data.current_state?.next_goal || ''
    );
    // Convert action array to ActionModel instances
    this.action = (data.action || []).map((actionData: unknown) => {
      return new ActionModel(actionData as Record<string, unknown>);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static typeWithCustomActions(_customActions: typeof ActionModel): typeof AgentOutput {
    /**
     * Extend actions with custom actions
     */
    return AgentOutput;
  }

  // Getter for current_state to match interface
  get current_state(): IAgentBrain {
    return {
      evaluation_previous_goal: this.currentState.evaluationPreviousGoal,
      memory: this.currentState.memory,
      next_goal: this.currentState.nextGoal,
    };
  }
}

export class DoneAgentOutput implements IDoneAgentOutput {
  /**
   * Output model for agent when it's done
   */
  currentState: AgentBrain;
  action: Array<{
    done: {
      text: string;
      success: boolean;
    };
  }>;
  done = true as const;
  reason?: string;

  // Schema definition for structured output
  static schema = DoneAgentOutputSchema;

  constructor(data: DoneAgentOutputData) {
    this.currentState = new AgentBrain(
      data.current_state?.evaluation_previous_goal || '',
      data.current_state?.memory || '',
      data.current_state?.next_goal || ''
    );
    // Convert action array to instances with done property
    this.action = (data.action || []).map(
      (actionData: { done?: { text?: string; success?: boolean } }) => {
        const doneData = actionData.done || {};
        return {
          done: {
            text: doneData.text || '',
            success: doneData.success || false,
          },
        };
      }
    );
    if (data.reason) {
      this.reason = data.reason;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static typeWithCustomActions(_customActions: typeof ActionModel): typeof DoneAgentOutput {
    /**
     * Extend actions with custom actions
     */
    return DoneAgentOutput;
  }

  // Getter for current_state to match interface
  get current_state(): IAgentBrain {
    return {
      evaluation_previous_goal: this.currentState.evaluationPreviousGoal,
      memory: this.currentState.memory,
      next_goal: this.currentState.nextGoal,
    };
  }
}

// Forward declare AgentHistory for use in AgentHistoryList
export class AgentHistory {
  /**
   * History item for agent actions
   */
  modelOutput: AgentOutput | null;
  result: ActionResult[];
  state: BrowserStateHistory;
  metadata: StepMetadata | null;

  constructor(
    modelOutput: AgentOutput | null,
    result: ActionResult[],
    state: BrowserStateHistory,
    metadata: StepMetadata | null = null
  ) {
    this.modelOutput = modelOutput;
    this.result = result;
    this.state = state;
    this.metadata = metadata;
  }

  static getInteractedElement(
    modelOutput: AgentOutput,
    selectorMap: SelectorMap
  ): (DOMHistoryElement | null)[] {
    const elements: (DOMHistoryElement | null)[] = [];
    for (const action of modelOutput.action) {
      const index = typeof action.getIndex === 'function' ? action.getIndex() : null;
      if (index !== null && index in selectorMap) {
        const el: DOMElementNode = selectorMap[index] as DOMElementNode;
        elements.push(HistoryTreeProcessor.convertDomElementToHistoryElement(el));
      } else {
        elements.push(null);
      }
    }
    return elements;
  }

  toJSON(): Record<string, unknown> {
    /**
     * Custom serialization handling circular references
     */
    let modelOutputDump = null;
    if (this.modelOutput) {
      const actionDump = this.modelOutput.action.map(action => {
        const actionObj: Record<string, unknown> = {};
        for (const key in action) {
          if (key !== 'undefined' && (action as Record<string, unknown>)[key] !== undefined) {
            actionObj[key] = (action as Record<string, unknown>)[key];
          }
        }
        return actionObj;
      });

      modelOutputDump = {
        currentState: this.modelOutput.currentState,
        action: actionDump,
      };
    }

    return {
      modelOutput: modelOutputDump,
      result: this.result.map(r => {
        const resultObj: Record<string, unknown> = {};
        // Handle ActionResult properties explicitly
        const actionResult = r as unknown as ActionResult;
        if (actionResult.isDone !== undefined) resultObj.isDone = actionResult.isDone;
        if (actionResult.success !== undefined) resultObj.success = actionResult.success;
        if (actionResult.extractedContent !== undefined)
          resultObj.extractedContent = actionResult.extractedContent;
        if (actionResult.error !== undefined) resultObj.error = actionResult.error;
        if (actionResult.includeInMemory !== undefined)
          resultObj.includeInMemory = actionResult.includeInMemory;
        return resultObj;
      }),
      state: this.state.toDict(),
      metadata: this.metadata,
    };
  }
}

export class AgentError {
  /**
   * Container for agent error handling
   */
  static VALIDATION_ERROR = 'Invalid model output format. Please follow the correct schema.';
  static RATE_LIMIT_ERROR = 'Rate limit reached. Waiting before retry.';
  static NO_VALID_ACTION = 'No valid action found';

  static formatError(error: Error, includeTrace: boolean = false): string {
    /**
     * Format error message based on error type and optionally include trace
     */
    let message = error.message;
    if (includeTrace && error.stack) {
      message += '\n' + error.stack;
    }
    return message;
  }
}
