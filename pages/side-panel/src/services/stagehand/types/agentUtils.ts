/**
 * Utility functions for agent message handling and type safety
 */

import { AnthropicMessage, ResponseInputItem } from './agent';

/**
 * Creates initial input items for Anthropic agents, safely handling optional userProvidedInstructions
 */
export function createAnthropicInitialInputItems(
  instruction: string,
  userProvidedInstructions?: string
): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];

  // Only add system message if userProvidedInstructions is provided
  if (userProvidedInstructions) {
    messages.push({
      role: 'system',
      content: userProvidedInstructions,
    });
  }

  messages.push({
    role: 'user',
    content: instruction,
  });

  return messages;
}

/**
 * Creates initial input items for OpenAI agents, safely handling optional userProvidedInstructions
 */
export function createOpenAIInitialInputItems(
  instruction: string,
  userProvidedInstructions?: string
): ResponseInputItem[] {
  const messages: ResponseInputItem[] = [];

  // Only add system message if userProvidedInstructions is provided
  if (userProvidedInstructions) {
    messages.push({
      role: 'system',
      content: userProvidedInstructions,
    });
  }

  messages.push({
    role: 'user',
    content: instruction,
  });

  return messages;
}

/**
 * Type guard to check if a value is defined (not undefined)
 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Safe accessor for usage statistics with fallback defaults
 */
export function safeUsageAccess(
  usage: { input_tokens: number; output_tokens: number } | undefined
): {
  input_tokens: number;
  output_tokens: number;
} {
  return {
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
  };
}
