/**
 * Controller type definitions
 */

export interface Context {
  // Define properties that would be in a context object
  // This is a placeholder that should be filled with actual context properties
  [key: string]: unknown;
}

export interface ActionParams {
  [key: string]: unknown;
}

export interface ActionResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface ActionResultParams {
  isDone?: boolean;
  success?: boolean;
  extractedContent?: string;
  includeInMemory?: boolean;
  error?: string;
}

export class ActionResult {
  isDone: boolean;
  success: boolean;
  extractedContent: string;
  includeInMemory: boolean;
  error?: string;

  constructor(
    params: ActionResultParams = {
      isDone: false,
      success: false,
      extractedContent: '',
      includeInMemory: false,
    },
  ) {
    this.isDone = params.isDone !== undefined ? params.isDone : false;
    this.success = params.success !== undefined ? params.success : false;
    this.extractedContent = params.extractedContent !== undefined ? params.extractedContent : '';
    this.includeInMemory = params.includeInMemory !== undefined ? params.includeInMemory : false;
    // Only set error if it exists in params
    if (params.error !== undefined) {
      this.error = params.error;
    }
  }
}
