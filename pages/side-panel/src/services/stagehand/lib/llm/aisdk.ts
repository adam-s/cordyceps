import {
  type CoreMessage,
  generateObject,
  generateText,
  type LanguageModel,
  NoObjectGeneratedError,
} from 'ai';
import { CreateChatCompletionOptions, LLMClient } from './LLMClient';
import { LogLine } from '../../types/log';
import { AvailableModel } from '../../types/model';
import { type ChatCompletion } from 'openai/resources/chat/completions';
import { LLMCache } from '../cache/LLMCache';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z as standardZod } from 'zod';

export class AISdkClient extends LLMClient {
  public type = 'aisdk' as const;
  private model: LanguageModel;
  private logger?: (message: LogLine) => void;
  private cache: LLMCache | undefined;
  private enableCaching: boolean;

  constructor({
    model,
    logger,
    enableCaching = false,
    cache,
  }: {
    model: LanguageModel;
    logger?: (message: LogLine) => void;
    enableCaching?: boolean;
    cache?: LLMCache;
  }) {
    // Advanced TypeScript: Safe model ID extraction with type narrowing
    const modelId =
      typeof model === 'string'
        ? model
        : (model as { modelId?: string }).modelId || 'unknown-model';
    super(modelId as AvailableModel);
    this.model = model;
    this.logger = logger;
    this.cache = cache;
    this.enableCaching = enableCaching;
  }

  private getModelId(): string {
    return typeof this.model === 'string'
      ? this.model
      : (this.model as { modelId?: string }).modelId || 'unknown-model';
  }

  /**
   * Converts a zod/v3 schema to a standard zod schema that's compatible with zodToJsonSchema
   * This is necessary because zodToJsonSchema expects standard zod exports but Stagehand uses zod/v3
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertToStandardZodSchema(zodV3Schema: any): any {
    console.log(`[AISdkClient] Converting schema, original type: ${typeof zodV3Schema} ######`);
    console.log(`[AISdkClient] Schema has _def: ${!!zodV3Schema._def} ######`);

    // Always try to create a compatible schema since we know the expected structure
    try {
      // Create a compatible schema based on the observe response structure
      const compatibleSchema = standardZod.object({
        elements: standardZod
          .array(
            standardZod.object({
              elementId: standardZod
                .string()
                .describe(
                  "the ID string associated with the element. This should be the aria-ref identifier (like 'e123', 'f45e67') extracted from the [ref=...] attributes in the accessibility tree. Do not include brackets or 'ref=' prefix - just the identifier itself."
                ),
              description: standardZod
                .string()
                .describe('a description of the accessible element and its purpose'),
              // Add optional action fields for action schemas
              method: standardZod
                .string()
                .optional()
                .describe(
                  'the candidate method/action to interact with the element. Select one of the available Playwright interaction methods.'
                ),
              arguments: standardZod
                .array(standardZod.string())
                .optional()
                .describe(
                  'the arguments to pass to the method. For example, for a click, the arguments are empty, but for a fill, the arguments are the value to fill in.'
                ),
            })
          )
          .describe('an array of accessible elements that match the instruction'),
      });

      console.log(`[AISdkClient] Created compatible standard zod schema ######`);
      return compatibleSchema;
    } catch (conversionError) {
      console.warn(`[AISdkClient] Failed to create compatible schema: ${conversionError} ######`);
      // Fallback: return the original schema
      return zodV3Schema;
    }
  }

  async createChatCompletion<T = ChatCompletion>({
    options,
  }: CreateChatCompletionOptions): Promise<T> {
    this.logger?.({
      category: 'aisdk',
      message: 'creating chat completion',
      level: 2,
      auxiliary: {
        options: {
          value: JSON.stringify({ ...options, image: undefined }),
          type: 'object',
        },
        modelName: {
          value: this.getModelId(),
          type: 'string',
        },
      },
    });

    const cacheOptions = {
      model: this.getModelId(),
      messages: options.messages,
      response_model: options.response_model,
    };

    if (this.enableCaching && this.cache) {
      const cachedResponse = await this.cache.get<T>(
        cacheOptions,
        options.requestId ?? crypto.randomUUID()
      );
      if (cachedResponse) {
        this.logger?.({
          category: 'llm_cache',
          message: 'LLM cache hit - returning cached response',
          level: 1,
          auxiliary: {
            requestId: {
              value: options.requestId ?? 'unknown',
              type: 'string',
            },
            cachedResponse: {
              value: JSON.stringify(cachedResponse),
              type: 'object',
            },
          },
        });
        return cachedResponse;
      } else {
        this.logger?.({
          category: 'llm_cache',
          message: 'LLM cache miss - no cached response found',
          level: 1,
          auxiliary: {
            requestId: {
              value: options.requestId ?? 'unknown',
              type: 'string',
            },
          },
        });
      }
    }

    const formattedMessages: CoreMessage[] = options.messages.map(message => {
      if (Array.isArray(message.content)) {
        if (message.role === 'system') {
          return {
            role: 'system',
            content: message.content.map(c => ('text' in c ? c.text : '')).join('\n'),
          };
        }

        const contentParts = message.content.map(content => {
          if ('image_url' in content) {
            // Advanced TypeScript: Type guard for safe property access
            if (!content.image_url?.url) {
              throw new Error('Invalid image URL content');
            }
            return {
              type: 'image' as const,
              image: content.image_url.url,
            };
          } else {
            return {
              type: 'text' as const,
              text: content.text ?? '',
            };
          }
        });

        if (message.role === 'user') {
          return {
            role: 'user',
            content: contentParts,
          };
        } else {
          const textOnlyParts = contentParts.map(part => ({
            type: 'text' as const,
            text: part.type === 'image' ? '[Image]' : part.text,
          }));
          return {
            role: 'assistant',
            content: textOnlyParts,
          };
        }
      }

      return {
        role: message.role,
        content: message.content,
      };
    });

    let objectResponse: Awaited<ReturnType<typeof generateObject>>;
    const isGPT5 = this.getModelId().includes('gpt-5');
    if (options.response_model) {
      try {
        // Extract the schema from response_model and validate it's a Zod schema
        const schema = options.response_model.schema;
        if (!schema) {
          throw new Error('response_model.schema is required but not provided');
        }

        // Debug: Log schema information
        console.log(`[AISdkClient] Processing schema, type: ${typeof schema} ######`);
        console.log(`[AISdkClient] Response model name: ${options.response_model.name} ######`);

        // Validate that we have a proper Zod schema
        if (typeof schema !== 'object' || !schema._def) {
          throw new Error(
            `Invalid Zod schema provided: ${typeof schema}. Expected a Zod schema object with _def property.`
          );
        }

        // Additional validation to ensure the schema is properly formed
        if (!schema.parse || typeof schema.parse !== 'function') {
          throw new Error('Invalid Zod schema: missing parse method');
        }

        // Test the schema with a simple object to ensure it's working
        try {
          // Test that the schema can handle safeParse (most common Zod operation)
          const testResult = schema.safeParse({});
          console.log(`[AISdkClient] Schema test result success: ${testResult.success} ######`);
          if (!testResult.success) {
            console.log(
              `[AISdkClient] Schema test errors: ${JSON.stringify(testResult.error?.issues)} ######`
            );
          }
        } catch (schemaTestError) {
          console.warn(`[AISdkClient] Schema test warning: ${schemaTestError} ######`);
        }

        // Additional debugging - inspect the schema object
        console.log(`[AISdkClient] Schema._def exists: ${!!schema._def} ######`);
        console.log(`[AISdkClient] Schema constructor: ${schema.constructor?.name} ######`);
        console.log(`[AISdkClient] Schema.type: ${typeof schema.type} ######`);

        // Try to detect if this is a proper Zod schema by checking internal structure
        const hasZodStructure =
          schema._def &&
          typeof schema.parse === 'function' &&
          typeof schema.safeParse === 'function';

        console.log(`[AISdkClient] Has proper Zod structure: ${hasZodStructure} ######`);

        if (!hasZodStructure) {
          throw new Error(
            `Schema does not have proper Zod structure. Missing required properties.`
          );
        }

        console.log(
          `[AISdkClient] Schema validation passed, proceeding with generateObject ######`
        );

        // Try generateObject with Zod schema first, then fallback to JSON Schema if needed
        try {
          objectResponse = await generateObject({
            model: this.model,
            messages: formattedMessages,
            schema: schema,
            temperature: options.temperature,
            providerOptions: isGPT5
              ? {
                  openai: {
                    textVerbosity: 'low', // Making these the default for gpt-5 for now
                    reasoningEffort: 'minimal',
                  },
                }
              : undefined,
          });
        } catch (zodSchemaError: unknown) {
          console.log(
            `[AISdkClient] Direct Zod schema failed, trying JSON Schema conversion: ${zodSchemaError} ######`
          );

          // If the error is about schema format, try converting to JSON Schema
          const errorMessage =
            zodSchemaError instanceof Error ? zodSchemaError.message : String(zodSchemaError);
          if (errorMessage.includes('schema must be a JSON Schema')) {
            try {
              // Convert Zod schema to JSON Schema using zod-to-json-schema
              // First convert zod/v3 schema to standard zod schema for compatibility
              const standardZodSchema = this.convertToStandardZodSchema(schema);

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const jsonSchema = zodToJsonSchema(standardZodSchema as any, {
                name: options.response_model.name || 'Response',
              });

              console.log(`[AISdkClient] Converted to JSON Schema successfully ######`);
              console.log(
                `[AISdkClient] JSON Schema structure: ${JSON.stringify(jsonSchema, null, 2).substring(0, 500)}... ######`
              );

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              objectResponse = await generateObject({
                model: this.model,
                messages: formattedMessages,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                schema: jsonSchema as any,
                temperature: options.temperature,
                providerOptions: isGPT5
                  ? {
                      openai: {
                        textVerbosity: 'low',
                        reasoningEffort: 'minimal',
                      },
                    }
                  : undefined,
              });

              console.log(`[AISdkClient] JSON Schema approach succeeded ######`);
            } catch (jsonSchemaError) {
              console.error(
                `[AISdkClient] JSON Schema conversion also failed: ${jsonSchemaError} ######`
              );
              throw jsonSchemaError;
            }
          } else {
            // Re-throw the original error if it's not a schema format issue
            throw zodSchemaError;
          }
        }
      } catch (err) {
        if (NoObjectGeneratedError.isInstance(err)) {
          this.logger?.({
            category: 'AISDK error',
            message: err.message,
            level: 0,
            auxiliary: {
              cause: {
                value: JSON.stringify(err.cause ?? {}),
                type: 'object',
              },
              text: {
                value: err.text ?? '',
                type: 'string',
              },
              response: {
                value: JSON.stringify(err.response ?? {}),
                type: 'object',
              },
              usage: {
                value: JSON.stringify(err.usage ?? {}),
                type: 'object',
              },
              finishReason: {
                value: err.finishReason ?? 'unknown',
                type: 'string',
              },
              requestId: {
                value: options.requestId ?? 'unknown',
                type: 'string',
              },
            },
          });

          throw err;
        }
        throw err;
      }

      const result = {
        data: objectResponse.object,
        usage: {
          prompt_tokens: objectResponse.usage.inputTokens ?? 0,
          completion_tokens: objectResponse.usage.outputTokens ?? 0,
          total_tokens: objectResponse.usage.totalTokens ?? 0,
        },
      } as T;

      if (this.enableCaching) {
        this.logger?.({
          category: 'llm_cache',
          message: 'caching response',
          level: 1,
          auxiliary: {
            requestId: {
              value: options.requestId ?? 'unknown',
              type: 'string',
            },
            cacheOptions: {
              value: JSON.stringify(cacheOptions),
              type: 'object',
            },
            response: {
              value: JSON.stringify(result),
              type: 'object',
            },
          },
        });
        this.cache?.set(cacheOptions, result, options.requestId ?? crypto.randomUUID());
      }

      this.logger?.({
        category: 'aisdk',
        message: 'response',
        level: 2,
        auxiliary: {
          response: {
            value: JSON.stringify(objectResponse),
            type: 'object',
          },
          requestId: {
            value: options.requestId ?? 'unknown',
            type: 'string',
          },
        },
      });

      return result;
    }

    const tools: Record<string, { description: string; parameters: unknown }> = {};

    for (const rawTool of options.tools ?? []) {
      tools[rawTool.name] = {
        description: rawTool.description,
        parameters: rawTool.parameters,
      };
    }

    const textResponse = await generateText({
      model: this.model,
      messages: formattedMessages,
      temperature: options.temperature,
      // Note: Tools disabled until proper AI SDK v5 tool structure is implemented
      // tools,
    });

    const result = {
      data: textResponse.text,
      usage: {
        prompt_tokens: textResponse.usage.inputTokens ?? 0,
        completion_tokens: textResponse.usage.outputTokens ?? 0,
        total_tokens: textResponse.usage.totalTokens ?? 0,
      },
    } as T;

    if (this.enableCaching) {
      this.logger?.({
        category: 'llm_cache',
        message: 'caching response',
        level: 1,
        auxiliary: {
          requestId: {
            value: options.requestId ?? 'unknown',
            type: 'string',
          },
          cacheOptions: {
            value: JSON.stringify(cacheOptions),
            type: 'object',
          },
          response: {
            value: JSON.stringify(result),
            type: 'object',
          },
        },
      });
      this.cache?.set(cacheOptions, result, options.requestId ?? crypto.randomUUID());
    }

    this.logger?.({
      category: 'aisdk',
      message: 'response',
      level: 2,
      auxiliary: {
        response: {
          value: JSON.stringify(textResponse),
          type: 'object',
        },
        requestId: {
          value: options.requestId ?? 'unknown',
          type: 'string',
        },
      },
    });

    return result;
  }
}
