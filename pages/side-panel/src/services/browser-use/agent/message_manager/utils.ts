/**
 * Utility functions for the message manager
 */
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { IConversationService } from '@shared/features/conversation/conversation.service';
import {
  MessageRole,
  ConversationType,
} from '@shared/features/conversation/ConversationDataAccessObject';

// Define BufferEncoding type for browser environment
type BufferEncoding = 'utf-8' | 'utf8' | 'ascii' | 'binary' | 'base64' | 'hex';

interface JsonObject {
  [key: string]: unknown;
}

export interface ModelResponse {
  content?: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

/**
 * Extract JSON from model output, handling both plain JSON and code-block-wrapped JSON.
 */
export function extractJsonFromModelOutput(content: string): JsonObject {
  try {
    // If content is wrapped in code blocks, extract just the JSON part
    if (content.includes('```')) {
      // Find the JSON content between code blocks
      const parts = content.split('```');
      if (parts.length > 1 && parts[1] !== undefined) {
        // TypeScript safety: ensure parts[1] exists
        const extractedContent = parts[1];
        content = extractedContent;
        // Remove language identifier if present (e.g., 'json\n')
        if (content.includes('\n')) {
          const lines = content.split('\n');
          if (lines.length > 1) {
            // Skip the first line (language identifier) and join the rest
            content = lines.slice(1).join('\n');
          }
        }
      }
    }
    // Parse the cleaned content
    const parsed = JSON.parse(content) as JsonObject;
    return parsed;
  } catch (e) {
    console.warn(`Failed to parse model output: ${content} ${e}`);
    throw new Error('Could not parse response.');
  }
}

/**
 * Convert input messages to a format that is compatible with the planner model
 */
export function convertInputMessages(
  inputMessages: BaseMessage[],
  modelName: string | null
): BaseMessage[] {
  if (modelName === null) {
    return inputMessages;
  }
  if (modelName === 'deepseek-reasoner' || modelName.includes('deepseek-r1')) {
    const convertedInputMessages = convertMessagesForNonFunctionCallingModels(inputMessages);
    let mergedInputMessages = mergeSuccessiveMessages(convertedInputMessages, HumanMessage);
    mergedInputMessages = mergeSuccessiveMessages(mergedInputMessages, AIMessage);
    return mergedInputMessages;
  }
  return inputMessages;
}

/**
 * Convert messages for non-function-calling models
 */
function convertMessagesForNonFunctionCallingModels(inputMessages: BaseMessage[]): BaseMessage[] {
  const outputMessages: BaseMessage[] = [];
  for (const message of inputMessages) {
    if (message instanceof HumanMessage) {
      outputMessages.push(message);
    } else if (message instanceof SystemMessage) {
      outputMessages.push(message);
    } else if (message instanceof ToolMessage) {
      // Wrap message content in an object with content field if it's a complex type
      if (typeof message.content === 'string') {
        outputMessages.push(new HumanMessage({ content: message.content }));
      } else {
        // Handle complex content type
        outputMessages.push(new HumanMessage({ content: JSON.stringify(message.content) }));
      }
    } else if (message instanceof AIMessage) {
      if (message.tool_calls) {
        const toolCalls = JSON.stringify(message.tool_calls);
        outputMessages.push(new AIMessage({ content: toolCalls }));
      } else {
        outputMessages.push(message);
      }
    } else {
      throw new Error(`Unknown message type: ${typeof message}`);
    }
  }
  return outputMessages;
}

/**
 * Some models like deepseek-reasoner dont allow multiple human messages in a row.
 * This function merges them into one.
 */
function mergeSuccessiveMessages<T extends BaseMessage>(
  messages: BaseMessage[],
  classToMerge: new (...args: never[]) => T
): BaseMessage[] {
  const mergedMessages: BaseMessage[] = [];
  let streak = 0;
  for (const message of messages) {
    if (message instanceof classToMerge) {
      streak += 1;
      if (streak > 1) {
        const lastMessage = mergedMessages[mergedMessages.length - 1];
        if (lastMessage && typeof lastMessage.content === 'string') {
          if (Array.isArray(message.content)) {
            const firstContent = message.content[0];
            if (firstContent && typeof firstContent === 'object' && 'text' in firstContent) {
              lastMessage.content += (firstContent as { text: string }).text;
            }
          } else if (typeof message.content === 'string') {
            lastMessage.content += message.content;
          }
        }
      } else {
        mergedMessages.push(message);
      }
    } else {
      mergedMessages.push(message);
      streak = 0;
    }
  }
  return mergedMessages;
}

/**
 * Save conversation history to a file.
 */
export async function saveConversation(
  inputMessages: BaseMessage[],
  response: ModelResponse,
  targetPath: string,
  encoding?: BufferEncoding
): Promise<void>;

/**
 * Save conversation history using the conversation service.
 */
export async function saveConversation(
  inputMessages: BaseMessage[],
  response: ModelResponse,
  conversationService: IConversationService,
  title?: string,
  sessionId?: string
): Promise<string>;

/**
 * Save conversation history - unified implementation supporting both file and service targets.
 */
export async function saveConversation(
  inputMessages: BaseMessage[],
  response: ModelResponse,
  third: string | IConversationService,
  fourth?: string,
  fifth?: string
): Promise<void | string> {
  // File-path branch
  if (typeof third === 'string') {
    const targetPath = third;
    const encoding: BufferEncoding = (fourth as BufferEncoding) ?? 'utf-8';

    // Build a simple text payload (similar to the Python variant)
    const serializeMessage = (m: BaseMessage) => {
      const role = m.constructor.name; // HumanMessage/SystemMessage/AIMessage/ToolMessage
      const content = Array.isArray(m.content)
        ? m.content
            .map((c: unknown) => {
              if (typeof c === 'object' && c && 'text' in (c as { text: unknown })) {
                return String((c as { text: unknown }).text);
              }
              return String(c);
            })
            .join('\n')
        : typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content);
      return `ROLE: ${role}\nCONTENT:\n${content}\n---\n`;
    };

    const header = `# Agent Conversation\n\n`;
    const inputDump = inputMessages.map(serializeMessage).join('\n');
    const responseDump = `# Model Response\n${JSON.stringify(response, null, 2)}\n`;

    const body = `${header}${inputDump}\n${responseDump}`;

    // In Chrome extension context, we'll use chrome.downloads API instead of fs
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      const blob = new Blob([body], { type: `text/plain;charset=${encoding}` });
      const url = URL.createObjectURL(blob);

      try {
        await new Promise<void>((resolve, reject) => {
          chrome.downloads.download(
            {
              url,
              filename: targetPath,
              conflictAction: 'overwrite',
            },
            _downloadId => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            }
          );
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    } else {
      console.warn('Chrome downloads API is not available. Conversation not saved.');
    }

    return; // Promise<void>
  }

  // Service branch
  const conversationService = third as IConversationService;
  const title = fourth ?? 'Agent Conversation';
  const sessionId = fifth;

  // Create a new conversation
  const conversationId = await conversationService.createConversation({
    title,
    type: ConversationType.BROWSER_USE,
    messages: [],
    metadata: {
      sessionId: sessionId || `agent-${Date.now()}`,
      agentId: 'browser-use',
      totalTokens: 0,
    },
    tags: ['agent', 'browser-use'],
  });

  // Convert and add input messages
  for (const message of inputMessages) {
    let role: MessageRole;
    let content: string;

    if (message instanceof HumanMessage) {
      role = MessageRole.USER;
    } else if (message instanceof SystemMessage) {
      role = MessageRole.SYSTEM;
    } else if (message instanceof AIMessage) {
      role = MessageRole.ASSISTANT;
    } else if (message instanceof ToolMessage) {
      role = MessageRole.TOOL;
    } else {
      role = MessageRole.SYSTEM; // Default fallback
    }

    // Convert content to string format
    if (Array.isArray(message.content)) {
      const textParts: string[] = [];
      for (const item of message.content) {
        if (typeof item === 'object' && item !== null && 'text' in item) {
          textParts.push((item as { text: string }).text);
        } else if (typeof item === 'string') {
          textParts.push(item);
        }
      }
      content = textParts.join('\n');
    } else if (typeof message.content === 'string') {
      content = message.content;
    } else {
      content = JSON.stringify(message.content);
    }

    await conversationService.addMessage(conversationId, {
      role,
      content,
      metadata: {
        messageType: message.constructor.name,
        originalContent: message.content,
      },
    });
  }

  // Add response as assistant message
  const responseContent = response.content || JSON.stringify(response);
  await conversationService.addMessage(conversationId, {
    role: MessageRole.ASSISTANT,
    content: responseContent,
    metadata: {
      messageType: 'ModelResponse',
      toolCalls: response.tool_calls,
      fullResponse: response,
    },
    toolCalls: response.tool_calls,
  });

  return conversationId; // Promise<string>
}
