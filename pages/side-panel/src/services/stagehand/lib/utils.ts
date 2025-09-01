/**
 * Stagehand Utilities - Chrome Extension Compatible Version
 *
 * This file contains utility functions for the Stagehand library adapted for Chrome extension usage.
 * Key adaptations from the original Node.js version:
 *
 **/

import { z } from 'zod';
import { Page } from '../../cordyceps/page';
import { ObserveResult, ZodPathSegments } from '../types/stagehand';
import { LogLine } from '../types/log';
import { type Schema, Type } from '@google/genai';
import { ModelProvider } from '../types/model';
import { ZodSchemaValidationError } from '../types/stagehandErrors';
import { ID_PATTERN } from '../types/context';

// Helper type for accessing Zod internals
type ZodWithDef = {
  _def: {
    typeName: string;
    values?: unknown[];
    innerType?: z.ZodTypeAny;
    value?: unknown;
    checks?: Array<{ kind: string }>;
    shape?: () => Record<string, z.ZodTypeAny>;
    type?: z.ZodTypeAny;
    options?: z.ZodTypeAny[];
    left?: z.ZodTypeAny;
    right?: z.ZodTypeAny;
    schema?: z.ZodTypeAny;
    effect?: unknown;
  };
  shape?: Record<string, z.ZodTypeAny>;
};

// A tuple type that satisfies z.union's requirement: at least 2 options.
type ZodUnionTuple = [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];

// A runtime type guard for unions that also narrows the TS type
type AnyZodUnion = z.ZodUnion<ZodUnionTuple>;
function isZodUnion(s: z.ZodTypeAny): s is AnyZodUnion {
  return getZodType(s) === 'ZodUnion';
}

export function validateZodSchema(schema: z.ZodTypeAny, data: unknown) {
  const result = schema.safeParse(data);

  if (result.success) {
    return true;
  }
  throw new ZodSchemaValidationError(data, result.error.format());
}

export async function drawObserveOverlay(page: Page, results: ObserveResult[]) {
  try {
    // Convert single xpath to array for consistent handling
    const xpathList = results.map(result => result.selector);

    // Filter out empty xpaths
    const validXpaths = xpathList.filter(xpath => xpath !== 'xpath=');

    await page.evaluate(selectors => {
      selectors.forEach(selector => {
        let element;
        if (selector.startsWith('xpath=')) {
          const xpath = selector.substring(6);
          element = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
        } else {
          element = document.querySelector(selector);
        }

        if (element instanceof HTMLElement) {
          const overlay = document.createElement('div');
          overlay.setAttribute('stagehandObserve', 'true');
          const rect = element.getBoundingClientRect();
          overlay.style.position = 'absolute';
          overlay.style.left = rect.left + 'px';
          overlay.style.top = rect.top + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';
          overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '10000';
          document.body.appendChild(overlay);
        }
      });
    }, validXpaths);
  } catch (error) {
    // Silently fail if overlay drawing fails - don't break the main functionality
    console.warn('Failed to draw observe overlays:', error);
  }
}

export async function clearOverlays(page: Page) {
  try {
    // remove existing stagehandObserve attributes
    await page.evaluate(() => {
      const elements = document.querySelectorAll('[stagehandObserve="true"]');
      elements.forEach(el => {
        const parent = el.parentNode;
        while (el.firstChild) {
          parent?.insertBefore(el.firstChild, el);
        }
        parent?.removeChild(el);
      });
    });
  } catch (error) {
    // Silently fail if overlay clearing fails - don't break the main functionality
    console.warn('Failed to clear overlays:', error);
  }
}

/**
 * Detects if the code is running in the Bun runtime environment.
 * In Chrome extension context, this will always return false since we don't have access to process.
 * @returns {boolean} Always false in Chrome extension environment.
 */
export function isRunningInBun(): boolean {
  // In Chrome extension context, we don't have access to Node.js process object
  // Always return false since Chrome extensions don't run in Bun
  return false;
}

/*
 * Helper functions for converting between Gemini and Zod schemas
 */
function decorateGeminiSchema(geminiSchema: Schema, zodSchema: z.ZodTypeAny): Schema {
  if (geminiSchema.nullable === undefined) {
    geminiSchema.nullable = zodSchema.isOptional();
  }

  if (zodSchema.description) {
    geminiSchema.description = zodSchema.description;
  }

  return geminiSchema;
}

export function toGeminiSchema(zodSchema: z.ZodTypeAny): Schema {
  const zodType = getZodType(zodSchema);

  switch (zodType) {
    case 'ZodArray': {
      return decorateGeminiSchema(
        {
          type: Type.ARRAY,
          items: toGeminiSchema((zodSchema as z.ZodArray<z.ZodTypeAny>).element),
        },
        zodSchema
      );
    }
    case 'ZodObject': {
      const properties: Record<string, Schema> = {};
      const required: string[] = [];

      const shape = (zodSchema as unknown as ZodWithDef).shape;
      if (shape) {
        for (const [key, value] of Object.entries(shape)) {
          properties[key] = toGeminiSchema(value as z.ZodTypeAny);
          if (getZodType(value as z.ZodTypeAny) !== 'ZodOptional') {
            required.push(key);
          }
        }
      }

      return decorateGeminiSchema(
        {
          type: Type.OBJECT,
          properties,
          required: required.length > 0 ? required : undefined,
        },
        zodSchema
      );
    }
    case 'ZodString':
      return decorateGeminiSchema(
        {
          type: Type.STRING,
        },
        zodSchema
      );
    case 'ZodNumber':
      return decorateGeminiSchema(
        {
          type: Type.NUMBER,
        },
        zodSchema
      );
    case 'ZodBoolean':
      return decorateGeminiSchema(
        {
          type: Type.BOOLEAN,
        },
        zodSchema
      );
    case 'ZodEnum':
      return decorateGeminiSchema(
        {
          type: Type.STRING,
          enum: (zodSchema as unknown as ZodWithDef)._def.values as string[],
        },
        zodSchema
      );
    case 'ZodDefault':
    case 'ZodNullable':
    case 'ZodOptional': {
      const innerType = (zodSchema as unknown as ZodWithDef)._def.innerType;
      if (innerType) {
        const innerSchema = toGeminiSchema(innerType);
        return decorateGeminiSchema(
          {
            ...innerSchema,
            nullable: true,
          },
          zodSchema
        );
      }
      break;
    }
    case 'ZodLiteral':
      return decorateGeminiSchema(
        {
          type: Type.STRING,
          enum: [(zodSchema as unknown as ZodWithDef)._def.value as string],
        },
        zodSchema
      );
    default:
      return decorateGeminiSchema(
        {
          type: Type.OBJECT,
          nullable: true,
        },
        zodSchema
      );
  }

  // Default return for unhandled schema types
  return decorateGeminiSchema(
    {
      type: Type.STRING,
      description: `Unhandled Zod type: ${(zodSchema as unknown as ZodWithDef)._def?.typeName || 'unknown'}`,
    },
    zodSchema
  );
}

// Helper function to check the type of Zod schema
export function getZodType(schema: z.ZodTypeAny): string {
  return (schema as unknown as ZodWithDef)._def.typeName;
}

/**
 * Recursively traverses a given Zod schema, scanning for any fields of type `z.string().url()`.
 * For each such field, it replaces the `z.string().url()` with `z.number()`.
 *
 * This function is used internally by higher-level utilities (e.g., transforming entire object schemas)
 * and handles nested objects, arrays, unions, intersections, optionals.
 *
 * @param schema - The Zod schema to transform.
 * @param currentPath - An array of string/number keys representing the current schema path (used internally for recursion).
 * @returns A two-element tuple:
 *   1. The updated Zod schema, with any `.url()` fields replaced by `z.number()`.
 *   2. An array of {@link ZodPathSegments} objects representing each replaced field, including the path segments.
 */
export function transformSchema(
  schema: z.ZodTypeAny,
  currentPath: Array<string | number>
): [z.ZodTypeAny, ZodPathSegments[]] {
  // 1) If it's a string with .url(), convert to z.number()
  if (isKind(schema, 'ZodString')) {
    const schemaWithDef = schema as unknown as ZodWithDef;
    const checks = (schemaWithDef._def as { checks?: Array<{ kind: string }> }).checks;
    const hasUrlCheck = checks?.some((check: { kind: string }) => check.kind === 'url') ?? false;
    if (hasUrlCheck) {
      return [makeIdStringSchema(schema as z.ZodString), [{ segments: [] }]];
    }
    return [schema, []];
  }

  // 2) If it's an object, transform each field
  if (isKind(schema, 'ZodObject')) {
    // The shape is a raw object containing fields keyed by string (no symbols):
    const schemaWithDef = schema as unknown as ZodWithDef;
    const shapeFn = (schemaWithDef._def as { shape?: () => Record<string, z.ZodTypeAny> }).shape;
    const shape = shapeFn?.() as Record<string, z.ZodTypeAny>;
    const newShape: Record<string, z.ZodTypeAny> = {};
    const urlPaths: ZodPathSegments[] = [];
    let changed = false;

    const shapeKeys = Object.keys(shape);

    for (const key of shapeKeys) {
      const child = shape[key];
      const [transformedChild, childPaths] = transformSchema(child, [...currentPath, key]);

      if (transformedChild !== child) {
        changed = true;
      }
      newShape[key] = transformedChild;

      if (childPaths.length > 0) {
        for (const cp of childPaths) {
          urlPaths.push({ segments: [key, ...cp.segments] });
        }
      }
    }

    if (changed) {
      return [z.object(newShape), urlPaths];
    }
    return [schema, urlPaths];
  }

  // 3) If it's an array, transform its item type
  if (isKind(schema, 'ZodArray')) {
    const schemaWithDef = schema as unknown as ZodWithDef;
    const itemType = schemaWithDef._def.type as unknown as z.ZodTypeAny;
    const [transformedItem, childPaths] = transformSchema(itemType, [...currentPath, '*']);
    const changed = transformedItem !== itemType;
    const arrayPaths: ZodPathSegments[] = childPaths.map(cp => ({
      segments: ['*', ...cp.segments],
    }));

    if (changed) {
      return [z.array(transformedItem), arrayPaths];
    }
    return [schema, arrayPaths];
  }

  // 4) If it's a union, transform each option
  if (isZodUnion(schema)) {
    // Cast the union's options to an array of ZodTypeAny
    const options = schema._def.options as ZodUnionTuple;
    let changed = false;
    let allPaths: ZodPathSegments[] = [];

    const newOptions = options.map((option, idx) => {
      const [newOption, childPaths] = transformSchema(option, [...currentPath, `union_${idx}`]);
      if (newOption !== option) changed = true;
      if (childPaths.length) allPaths = allPaths.concat(childPaths);
      return newOption;
    }) as ZodUnionTuple; // still a tuple (>=2 entries)

    if (changed) {
      return [z.union(newOptions), allPaths];
    }
    return [schema, allPaths];
  }

  // 5) If it's an intersection, transform left and right
  if (isKind(schema, 'ZodIntersection')) {
    const schemaWithDef = schema as unknown as ZodWithDef;
    const leftType = (schemaWithDef._def as { left?: z.ZodTypeAny }).left as z.ZodTypeAny;
    const rightType = (schemaWithDef._def as { right?: z.ZodTypeAny }).right as z.ZodTypeAny;

    const [left, leftPaths] = transformSchema(leftType, [...currentPath, 'intersection_left']);
    const [right, rightPaths] = transformSchema(rightType, [...currentPath, 'intersection_right']);
    const changed = left !== leftType || right !== rightType;
    const allPaths = [...leftPaths, ...rightPaths];
    if (changed) {
      return [z.intersection(left, right), allPaths];
    }
    return [schema, allPaths];
  }

  // 6) If it's optional, transform inner
  if (isKind(schema, 'ZodOptional')) {
    const schemaWithDef = schema as unknown as ZodWithDef;
    const innerType = (schemaWithDef._def as { innerType?: z.ZodTypeAny })
      .innerType as z.ZodTypeAny;
    const [inner, innerPaths] = transformSchema(innerType, currentPath);
    if (inner !== innerType) {
      return [z.optional(inner), innerPaths];
    }
    return [schema, innerPaths];
  }

  // 7) If it's nullable, transform inner
  if (isKind(schema, 'ZodNullable')) {
    const schemaWithDef = schema as unknown as ZodWithDef;
    const innerType = (schemaWithDef._def as { innerType?: z.ZodTypeAny })
      .innerType as z.ZodTypeAny;
    const [inner, innerPaths] = transformSchema(innerType, currentPath);
    if (inner !== innerType) {
      return [z.nullable(inner), innerPaths];
    }
    return [schema, innerPaths];
  }

  // 8) If it's an effect, transform base schema
  if (isKind(schema, 'ZodEffects')) {
    const schemaWithDef = schema as unknown as ZodWithDef;
    const baseSchema = (schemaWithDef._def as { schema?: z.ZodTypeAny }).schema as z.ZodTypeAny;
    const [newBaseSchema, basePaths] = transformSchema(baseSchema, currentPath);
    if (newBaseSchema !== baseSchema) {
      // Note: z.effect doesn't exist in newer Zod versions, use z.transform or skip
      return [newBaseSchema, basePaths];
    }
    return [schema, basePaths];
  }

  // 9) If none of the above, return as-is
  return [schema, []];
}

/**
 * Once we get the final extracted object that has numeric IDs in place of URLs,
 * use `injectUrls` to walk the object and replace numeric IDs
 * with the real URL strings from idToUrlMapping. The `path` may include `*`
 * for array indices (indicating "all items in the array").
 */
export function injectUrls(
  obj: unknown,
  path: Array<string | number>,
  idToUrlMapping: Record<string, string>
): void {
  if (path.length === 0) return;
  const [key, ...rest] = path;

  if (key === '*') {
    if (Array.isArray(obj)) {
      for (const item of obj) injectUrls(item, rest, idToUrlMapping);
    }
    return;
  }

  if (obj && typeof obj === 'object') {
    const record = obj as Record<string | number, unknown>;
    if (path.length === 1) {
      const fieldValue = record[key];

      const id =
        typeof fieldValue === 'number'
          ? String(fieldValue)
          : typeof fieldValue === 'string' && ID_PATTERN.test(fieldValue)
            ? fieldValue
            : undefined;

      if (id !== undefined) {
        record[key] = idToUrlMapping[id] ?? '';
      }
    } else {
      injectUrls(record[key], rest, idToUrlMapping);
    }
  }
}

function isKind(s: z.ZodTypeAny, kind: string): boolean {
  return getZodType(s) === kind;
}

function makeIdStringSchema(orig: z.ZodString): z.ZodString {
  const userDesc =
    // Zod ≥3.23 exposes .description directly; fall back to _def for older minor versions
    (orig as unknown as { description?: string }).description ??
    (orig as unknown as { _def?: { description?: string } })._def?.description ??
    '';

  const base =
    "This field must be the element-ID in the form 'frameId-backendId' " + '(e.g. "0-432").';
  const composed =
    userDesc.trim().length > 0
      ? `${base} that follows this user-defined description: ${userDesc}`
      : base;

  return z.string().regex(ID_PATTERN).describe(composed);
}

/**
 * Mapping from LLM provider names to their corresponding environment variable names for API keys.
 */
export const providerEnvVarMap: Partial<Record<ModelProvider | string, string>> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  togetherai: 'TOGETHER_AI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  azure: 'AZURE_API_KEY',
  xai: 'XAI_API_KEY',
  google_legacy: 'GOOGLE_API_KEY',
};

/**
 * Loads an API key for a provider.
 * In Chrome extension context, environment variables are not available.
 * This function returns undefined and logs a warning.
 *
 * @param provider The name of the provider (e.g., 'openai', 'anthropic')
 * @param logger Optional logger for info/error messages
 * @returns undefined (API keys should be provided directly in Chrome extension context)
 */
export function loadApiKeyFromEnv(
  provider: string | undefined,
  logger: (logLine: LogLine) => void
): string | undefined {
  if (!provider) {
    return undefined;
  }

  const envVarName = providerEnvVarMap[provider];
  if (!envVarName) {
    logger({
      category: 'init',
      message: `No known environment variable for provider '${provider}'`,
      level: 0,
    });
    return undefined;
  }

  // In Chrome extension context, environment variables are not available
  // API keys should be passed directly through ChromeExtensionStagehandParams
  logger({
    category: 'init',
    message: `API keys cannot be loaded from environment variables in Chrome extension context. Please provide API key directly in ChromeExtensionStagehandParams.modelClientOptions for provider ${provider}`,
    level: 1,
  });

  return undefined;
}

export function trimTrailingTextNode(path: string | undefined): string | undefined {
  return path?.replace(/\/text\(\)(\[\d+\])?$/iu, '');
}
