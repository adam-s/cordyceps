import { DOMElementNode, ElementHash } from '../dom/types';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ActionResult, AgentHistoryList, AgentOutput, DoneAgentOutput } from './views';
import type { MessageManagerState } from './message_manager/views';
import type { ActionModel } from '../controller/registry/views';

// Type guard: narrow unknown values to objects that have ElementHash.branchPathHash
export function hasBranchPathHash(el: unknown): el is DOMElementNode & { hash: ElementHash } {
  if (el === null || typeof el !== 'object') {
    return false;
  }
  const rec = el as Record<string, unknown>;
  if (!('hash' in rec)) {
    return false;
  }
  const maybeHash = rec.hash as Record<string, unknown> | undefined;
  return (
    maybeHash !== undefined && maybeHash !== null && typeof maybeHash.branchPathHash === 'string'
  );
}

/**
 * Type guard: object has a string `modelName` property.
 */
export function hasModelName(llm: unknown): llm is LLMWithModelName {
  if (llm === null || typeof llm !== 'object') {
    return false;
  }
  const rec = llm as Record<string, unknown>;
  return typeof rec.modelName === 'string' && rec.modelName.length > 0;
}

/**
 * Type guard: object has a string `model` property.
 */
export function hasModel(llm: unknown): llm is LLMWithModel {
  if (llm === null || typeof llm !== 'object') {
    return false;
  }
  const rec = llm as Record<string, unknown>;
  return typeof rec.model === 'string' && rec.model.length > 0;
}

/**
 * Interfaces describing optional shape of LLM metadata we read from different LLM implementations.
 * Keep these minimal and narrow using type guards instead of using `any`.
 */
export interface LLMWithModelName {
  modelName: string;
}

export interface LLMWithModel {
  model: string;
}
/**
 * Minimal schema type for structured LLM output descriptors used by withStructuredOutput(...)
 */
export interface StructuredOutputSchema {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

/**
 * Constructor signature for dynamic ActionModel classes returned by the registry.
 * The registry produces a class/constructor which can be instantiated with a
 * plain object of validated parameters.
 */
export type ActionModelConstructor = new (data?: Record<string, unknown>) => ActionModel;

/**
 * Local aliases for the output model classes imported from ./views
 */
export type AgentOutputClass = typeof AgentOutput;
export type DoneAgentOutputClass = typeof DoneAgentOutput;

// ---- Moved types and schemas from views.ts ----

export type ToolCallingMethod = 'function_calling' | 'json_mode' | 'raw' | 'auto';

export interface IAgentSettings {
  useVision: boolean;
  useVisionForPlanner: boolean;
  saveConversationPath: string | null;
  saveConversationPathEncoding: string | null;
  maxFailures: number;
  retryDelay: number;
  maxInputTokens: number;
  validateOutput: boolean;
  messageContext: string | null;
  generateGif: boolean | string;
  availableFilePaths: string[] | null;
  overrideSystemMessage: string | null;
  extendSystemMessage: string | null;
  includeAttributes: string[];
  maxActionsPerStep: number;
  toolCallingMethod: ToolCallingMethod | null;
  pageExtractionLlm: BaseChatModel | null;
  plannerLlm: BaseChatModel | null;
  plannerInterval: number;
  useSnapshotForAI: boolean;
}

export const AgentSettingsSchema = {
  type: 'object',
  properties: {
    useVision: { type: 'boolean', default: true },
    useVisionForPlanner: { type: 'boolean', default: false },
    saveConversationPath: { type: ['string', 'null'], default: null },
    saveConversationPathEncoding: { type: ['string', 'null'], default: 'utf-8' },
    maxFailures: { type: 'number', default: 3 },
    retryDelay: { type: 'number', default: 10 },
    maxInputTokens: { type: 'number', default: 128000 },
    validateOutput: { type: 'boolean', default: false },
    messageContext: { type: ['string', 'null'], default: null },
    generateGif: { type: ['boolean', 'string'], default: false },
    availableFilePaths: { type: ['array', 'null'], items: { type: 'string' }, default: null },
    overrideSystemMessage: { type: ['string', 'null'], default: null },
    extendSystemMessage: { type: ['string', 'null'], default: null },
    includeAttributes: {
      type: 'array',
      items: { type: 'string' },
      default: [
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
      ],
    },
    maxActionsPerStep: { type: 'number', default: 10 },
    toolCallingMethod: {
      type: ['string', 'null'],
      enum: ['function_calling', 'json_mode', 'raw', 'auto'],
      default: 'auto',
    },
    pageExtractionLlm: { type: ['object', 'null'], default: null },
    plannerLlm: { type: ['object', 'null'], default: null },
    plannerInterval: { type: 'number', default: 1 },
    useSnapshotForAI: { type: 'boolean', default: false },
  },
  required: [
    'useVision',
    'maxFailures',
    'retryDelay',
    'maxInputTokens',
    'validateOutput',
    'includeAttributes',
    'maxActionsPerStep',
  ],
};

export interface IAgentState {
  agentId: string;
  nSteps: number;
  consecutiveFailures: number;
  lastResult: ActionResult[] | null;
  history: AgentHistoryList;
  lastPlan: string | null;
  paused: boolean;
  stopped: boolean;
  messageManagerState: MessageManagerState;
  errorHistory: Record<string, number>;
}

export const AgentStateSchema = {
  type: 'object',
  properties: {
    agentId: { type: 'string', default: crypto.randomUUID() },
    nSteps: { type: 'number', default: 1 },
    consecutiveFailures: { type: 'number', default: 0 },
    lastResult: { type: ['array', 'null'], default: null },
    // Use plain objects for defaults in the types module to avoid runtime constructors
    history: { type: 'object', default: {} },
    lastPlan: { type: ['string', 'null'], default: null },
    paused: { type: 'boolean', default: false },
    stopped: { type: 'boolean', default: false },
    messageManagerState: { type: 'object', default: {} },
    errorHistory: { type: 'object', default: {} },
  },
  required: [
    'agentId',
    'nSteps',
    'consecutiveFailures',
    'history',
    'paused',
    'stopped',
    'messageManagerState',
    'errorHistory',
  ],
};

export interface IAgentStepInfo {
  stepNumber: number;
  maxSteps: number;
}

export const AgentStepInfoSchema = {
  type: 'object',
  properties: {
    stepNumber: { type: 'number' },
    maxSteps: { type: 'number' },
  },
  required: ['stepNumber', 'maxSteps'],
};

export interface IActionResult {
  isDone: boolean | null;
  success: boolean | null;
  extractedContent: string | null;
  error?: string | null;
  includeInMemory: boolean;
}

export const ActionResultSchema = {
  type: 'object',
  properties: {
    isDone: { type: ['boolean', 'null'], default: false },
    success: { type: ['boolean', 'null'], default: null },
    extractedContent: { type: ['string', 'null'], default: null },
    error: { type: ['string', 'null'] },
    includeInMemory: { type: 'boolean', default: false },
  },
  required: ['isDone', 'success', 'extractedContent', 'includeInMemory'],
};

export interface IStepMetadata {
  stepStartTime: number;
  stepEndTime: number;
  inputTokens: number;
  stepNumber: number;
  readonly durationSeconds: number;
}

export const StepMetadataSchema = {
  type: 'object',
  properties: {
    stepStartTime: { type: 'number' },
    stepEndTime: { type: 'number' },
    inputTokens: { type: 'number' },
    stepNumber: { type: 'number' },
    durationSeconds: { type: 'number' },
  },
  required: ['stepStartTime', 'stepEndTime', 'inputTokens', 'stepNumber'],
};

export interface IAgentBrain {
  evaluation_previous_goal: string;
  memory: string;
  next_goal: string;
}

export const AgentBrainSchema = {
  type: 'object',
  properties: {
    evaluation_previous_goal: { type: 'string' },
    memory: { type: 'string' },
    next_goal: { type: 'string' },
  },
  required: ['evaluation_previous_goal', 'memory', 'next_goal'],
};

export interface IAgentOutput {
  current_state: IAgentBrain;
  action: ActionModel[];
}

export const AgentOutputSchema = {
  type: 'object',
  properties: {
    current_state: AgentBrainSchema,
    action: {
      type: 'array',
      items: {
        type: 'object',
      },
      description: 'List of actions to execute (at least one action is required)',
    },
  },
  required: ['current_state', 'action'],
};

export interface IDoneAgentOutput {
  current_state: IAgentBrain;
  action: Array<{
    done: {
      text: string;
      success: boolean;
    };
  }>;
}

export const DoneAgentOutputSchema = {
  type: 'object',
  properties: {
    current_state: AgentBrainSchema,
    action: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          done: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              success: { type: 'boolean' },
            },
            required: ['text', 'success'],
          },
        },
        required: ['done'],
      },
      description: 'Done action with text and success properties',
    },
  },
  required: ['current_state', 'action'],
};

export interface AgentOutputData {
  current_state?: {
    evaluation_previous_goal?: string;
    memory?: string;
    next_goal?: string;
  };
  action?: unknown[];
}

export interface DoneAgentOutputData {
  current_state?: {
    evaluation_previous_goal?: string;
    memory?: string;
    next_goal?: string;
  };
  action?: Array<{
    done?: {
      text?: string;
      success?: boolean;
    };
  }>;
  reason?: string;
}

export interface StructuredLlmResponse {
  parsed: Record<string, unknown> | null; // Raw parsed data from LLM
  raw?: unknown; // Optional raw response
}
