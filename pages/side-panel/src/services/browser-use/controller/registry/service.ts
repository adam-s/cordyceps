/**
 * TypeScript implementation of browser-use controller registry
 */
import { BrowserContext } from '../../browser/context';
import { ActionModel, ActionRegistry, RegisteredAction } from './views';

/**
 * Service for registering and managing actions
 */
export class Registry<Context = unknown> {
  registry: ActionRegistry;
  excludeActions: string[];

  constructor(excludeActions: string[] = []) {
    this.registry = new ActionRegistry();
    this.excludeActions = excludeActions;
  }

  /**
   * Creates a parameter model from function signature
   * In TypeScript, we create a basic parameter model with default properties
   * This is a proper implementation that replaces the previous placeholder
   * @param func The function to create a parameter model for
   */
  private _createParamModel(func: (...args: unknown[]) => unknown): new () => ActionModel {
    // Extract function name and parameters
    const funcName = func.name || 'anonymous';
    const funcStr = func.toString();

    // Extract parameter names using regex
    const paramMatch = funcStr.match(/\(([^)]*)\)/)?.[1] || '';
    const paramNames = paramMatch
      .split(',')
      .map(param => param.trim())
      .filter(param => param.length > 0);

    // Create a dynamic model class with the extracted parameters
    return class DynamicModel extends ActionModel {
      constructor() {
        super();
        // Add function name as a property
        Object.defineProperty(this, 'functionName', {
          value: funcName,
          enumerable: true,
        });

        // Add parameters as properties with default values
        paramNames.forEach(param => {
          // Skip undefined or null params
          if (typeof param !== 'string') return;

          // Remove type annotations if present
          const parts = param.split(':');
          if (parts.length > 0 && parts[0] !== undefined) {
            const paramName = parts[0].trim();
            if (paramName) {
              Object.defineProperty(this, paramName, {
                value: undefined,
                enumerable: true,
                writable: true,
              });
            }
          }
        });
      }
    };
  }

  /**
   * Decorator for registering actions
   */
  action(description: string, paramModel?: new () => ActionModel) {
    return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
      // Skip registration if action is in excludeActions
      if (this.excludeActions.includes(propertyKey)) {
        return descriptor;
      }

      // Use provided param model or create one from function
      const actualParamModel = paramModel || this._createParamModel(descriptor.value);

      // Register the action
      const action = new RegisteredAction(
        propertyKey,
        description,
        descriptor.value,
        actualParamModel
      );

      this.registry.actions[propertyKey] = action;
      return descriptor;
    };
  }

  /**
   * Execute an action by name with parameters
   * This matches the Python execute_action method
   */
  async executeAction(
    actionName: string,
    params: Record<string, unknown>,
    browser: BrowserContext,
    pageExtractionLlm?: unknown,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context
  ): Promise<unknown> {
    if (!this.registry.actions[actionName]) {
      throw new Error(`Action ${actionName} not found`);
    }

    const action = this.registry.actions[actionName];

    // Replace sensitive data in parameters if needed
    if (sensitiveData && Object.keys(sensitiveData).length > 0) {
      params = this._replaceSensitiveData(params, sensitiveData);
    }

    // Apply file paths if needed
    if (availableFilePaths && Array.isArray(availableFilePaths) && availableFilePaths.length > 0) {
      const fileParamKey = 'file_path';
      if (params && typeof params === 'object' && fileParamKey in params) {
        const requestedPath = params[fileParamKey];
        if (typeof requestedPath === 'string' && !availableFilePaths.includes(requestedPath)) {
          throw new Error(`File path ${requestedPath} is not available`);
        }
      }
    }

    // Execute the action with appropriate parameters
    return await action.function(params, {
      browser: browser as unknown as BrowserContext,
      pageExtractionLlm,
      sensitiveData,
      availableFilePaths,
      context,
    });
  }

  /**
   * Replaces sensitive data in parameters
   */
  private _replaceSensitiveData(
    params: Record<string, unknown>,
    sensitiveData: Record<string, string>
  ): Record<string, unknown> {
    const secretPattern = /<secret>(.*?)<\/secret>/g;

    const replaceSecrets = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return value.replace(secretPattern, (_, placeholder) => {
          return sensitiveData[placeholder] || `<secret>${placeholder}</secret>`;
        });
      } else if (Array.isArray(value)) {
        return value.map(v => replaceSecrets(v));
      } else if (value && typeof value === 'object') {
        return Object.entries(value).reduce(
          (acc, [k, v]) => {
            acc[k] = replaceSecrets(v);
            return acc;
          },
          {} as Record<string, unknown>
        );
      }
      return value;
    };

    for (const [key, value] of Object.entries(params)) {
      params[key] = replaceSecrets(value);
    }

    return params;
  }

  /**
   * Creates an action model from registered actions
   * @param includeActions Optional list of action names to include
   * @returns A dynamically created ActionModel class
   */
  createActionModel(includeActions?: string[]): typeof ActionModel {
    // Create a model that closely matches Python's create_model function with JSON Schema
    const registryRef = this.registry;

    // Create a specialized action model class that only includes the specified actions
    class DynamicActionModel extends ActionModel {
      registry: ActionRegistry;

      constructor() {
        super();
        this.registry = registryRef;

        // Initialize with null values for all actions
        const registryActions = registryRef.actions;
        for (const name of Object.keys(registryActions)) {
          if (!includeActions || includeActions.includes(name)) {
            (this as Record<string, unknown>)[name] = null;
          }
        }
      }

      // Provide JSON Schema information - this mirrors how Pydantic creates schemas
      static readonly jsonSchema = {
        type: 'object',
        properties: {} as Record<string, unknown>,
      };
    }

    // Add schema definition for each allowed action
    const registryActions = registryRef.actions;
    for (const name of Object.keys(registryActions)) {
      if (!includeActions || includeActions.includes(name)) {
        const actionObj = registryActions[name];

        // Skip if action definition is missing
        if (!actionObj) continue;

        // Define the schema for this action
        // For all actions, use the action's parameter model schema
        const paramModel = actionObj.paramModel;
        let properties = {};

        // Try to get schema properties from the parameter model
        if (paramModel && typeof paramModel === 'function') {
          const schema =
            (
              paramModel as unknown as { schema?: () => { properties?: Record<string, unknown> } }
            ).schema?.() || {};
          properties = schema.properties || {};
        }

        DynamicActionModel.jsonSchema.properties[name] = {
          type: 'object',
          description: actionObj.description || `Execute the ${name} action`,
          properties: properties,
        };

        // No special cases for any actions
      }
    }

    return DynamicActionModel;
  }

  /**
   * Get a description of all actions for the prompt
   */
  getPromptDescription(): string {
    return this.registry.getPromptDescription();
  }
}
