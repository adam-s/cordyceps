import { AsyncStorageSchema } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';

export enum StorageKeys {
  OPEN_AI_API_KEY = 'openAiApiKey',
  GOOGLE_GEMINI_API_KEY = 'googleGeminiApiKey',
  RESEARCH_LLM_PROVIDER = 'researchLlmProvider',
  RESEARCH_DEBUG_MODE = 'researchDebugMode',
}

export interface SidePanelAppStorageSchema extends AsyncStorageSchema {
  [StorageKeys.OPEN_AI_API_KEY]?: string;
  [StorageKeys.GOOGLE_GEMINI_API_KEY]?: string;
  [StorageKeys.RESEARCH_LLM_PROVIDER]?: 'openai' | 'gemini';
  [StorageKeys.RESEARCH_DEBUG_MODE]?: boolean;
}
