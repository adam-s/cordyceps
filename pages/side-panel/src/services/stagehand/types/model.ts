import type { ClientOptions as OpenAIClientOptions } from 'openai';
import { z } from 'zod/v3';

export const AvailableModelSchema = z.enum([
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'o4-mini',
  'o3',
  'o3-mini',
  'o1',
  'o1-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-2024-08-06',
  'gpt-4.5-preview',
  'o1-preview',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.5-pro-preview-03-25',
]);

export type AvailableModel = z.infer<typeof AvailableModelSchema> | string;

export type ModelProvider = 'openai' | 'google' | 'aisdk';

export type ClientOptions = OpenAIClientOptions | Record<string, unknown>;

export interface AnthropicJsonSchemaObject {
  definitions?: {
    MySchema?: { properties?: Record<string, unknown>; required?: string[] };
  };
  properties?: Record<string, unknown>;
  required?: string[];
}
