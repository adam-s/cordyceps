import {
  UnsupportedAISDKModelProviderError,
  UnsupportedModelError,
  UnsupportedModelProviderError,
} from '../../types/stagehandErrors';
import { LogLine } from '../../types/log';
import { AvailableModel, ClientOptions, ModelProvider } from '../../types/model';
import { LLMCache } from '../cache/LLMCache';
import { AISdkClient } from './aisdk';
import { GoogleClient } from './GoogleClient';
import { LLMClient } from './LLMClient';
import { OpenAIClient } from './OpenAIClient';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { AISDKProvider, AISDKCustomProvider } from '../../types/llm';

const AISDKProviders: Record<string, AISDKProvider> = {
  openai,
  google,
};

const AISDKProvidersWithAPIKey: Record<string, AISDKCustomProvider> = {
  openai: createOpenAI,
  google: createGoogleGenerativeAI,
};

const modelToProviderMap: { [key in AvailableModel]: ModelProvider } = {
  'gpt-4.1': 'openai',
  'gpt-4.1-mini': 'openai',
  'gpt-4.1-nano': 'openai',
  'o4-mini': 'openai',
  //prettier-ignore
  "o3": "openai",
  'o3-mini': 'openai',
  //prettier-ignore
  "o1": "openai",
  'o1-mini': 'openai',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-4o-2024-08-06': 'openai',
  'gpt-4.5-preview': 'openai',
  'o1-preview': 'openai',
  'gemini-1.5-flash': 'google',
  'gemini-1.5-pro': 'google',
  'gemini-1.5-flash-8b': 'google',
  'gemini-2.0-flash-lite': 'google',
  'gemini-2.0-flash': 'google',
  'gemini-2.5-flash-preview-04-17': 'google',
  'gemini-2.5-pro-preview-03-25': 'google',
};

export function getAISDKLanguageModel(subProvider: string, subModelName: string, apiKey?: string) {
  console.log(
    `[getAISDKLanguageModel] subProvider=${subProvider} subModelName=${subModelName} hasApiKey=${!!apiKey} ######`
  );
  if (apiKey) {
    const creator = AISDKProvidersWithAPIKey[subProvider];
    if (!creator) {
      throw new UnsupportedAISDKModelProviderError(
        subProvider,
        Object.keys(AISDKProvidersWithAPIKey)
      );
    }
    // Create the provider instance with the API key
    const provider = creator({ apiKey });
    // Get the specific model from the provider
    return provider(subModelName);
  } else {
    const provider = AISDKProviders[subProvider];
    if (!provider) {
      throw new UnsupportedAISDKModelProviderError(subProvider, Object.keys(AISDKProviders));
    }
    return provider(subModelName);
  }
}

export class LLMProvider {
  private logger: (message: LogLine) => void;
  private enableCaching: boolean;
  private cache: LLMCache | undefined;

  constructor(logger: (message: LogLine) => void, enableCaching: boolean) {
    this.logger = logger;
    this.enableCaching = enableCaching;
    this.cache = undefined;
  }

  cleanRequestCache(requestId: string): void {
    if (!this.enableCaching) {
      return;
    }

    this.logger({
      category: 'llm_cache',
      message: 'cleaning up cache',
      level: 1,
      auxiliary: {
        requestId: {
          value: requestId,
          type: 'string',
        },
      },
    });
    this.cache?.deleteCacheForRequestId(requestId);
  }

  getClient(modelName: AvailableModel, clientOptions?: ClientOptions): LLMClient {
    if (modelName.includes('/')) {
      const firstSlashIndex = modelName.indexOf('/');
      const subProvider = modelName.substring(0, firstSlashIndex);
      const subModelName = modelName.substring(firstSlashIndex + 1);
      console.log(
        `[LLMProvider.getClient] using AI SDK provider=${subProvider} model=${subModelName} ######`
      );

      const languageModel = getAISDKLanguageModel(
        subProvider,
        subModelName,
        typeof clientOptions?.apiKey === 'string' ? clientOptions.apiKey : undefined
      );

      return new AISdkClient({
        model: languageModel,
        logger: this.logger,
        enableCaching: this.enableCaching,
        cache: this.cache,
      });
    }

    const provider = modelToProviderMap[modelName];
    if (!provider) {
      throw new UnsupportedModelError(Object.keys(modelToProviderMap));
    }
    const availableModel = modelName as AvailableModel;
    switch (provider) {
      case 'openai':
        return new OpenAIClient({
          logger: this.logger,
          enableCaching: this.enableCaching,
          cache: this.cache,
          modelName: availableModel,
          clientOptions,
        });
      case 'google':
        return new GoogleClient({
          logger: this.logger,
          enableCaching: this.enableCaching,
          cache: this.cache,
          modelName: availableModel,
          clientOptions,
        });
      default:
        throw new UnsupportedModelProviderError([...new Set(Object.values(modelToProviderMap))]);
    }
  }

  static getModelProvider(modelName: AvailableModel): ModelProvider {
    if (modelName.includes('/')) {
      const firstSlashIndex = modelName.indexOf('/');
      const subProvider = modelName.substring(0, firstSlashIndex);
      if (AISDKProviders[subProvider]) {
        return 'aisdk';
      }
    }
    const provider = modelToProviderMap[modelName];
    return provider;
  }
}
