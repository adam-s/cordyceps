import { Progress } from '@src/services/cordyceps/core/progress';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

/**
 * Enhanced error handling for Chrome extension test environment
 */
export function handleTestError(
  error: unknown,
  testName: string,
  progress: Progress,
  context: TestContext,
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
  const errorType = error instanceof Error ? error.constructor.name : typeof error;

  // Log detailed error information for debugging in Chrome extension DevTools
  progress.log(`${testName} failed: ${errorMessage}`);
  progress.log(`Error type: ${errorType}`);
  progress.log(`Error stack trace: ${errorStack}`);

  // Additional Chrome extension specific debugging
  if (error instanceof Error) {
    progress.log(`Error cause: ${error.cause ? String(error.cause) : 'No cause specified'}`);
    progress.log(`Error name: ${error.name}`);

    // Log any custom properties that might exist on the error
    const customProps = Object.getOwnPropertyNames(error).filter(
      prop => !['name', 'message', 'stack', 'cause'].includes(prop),
    );
    if (customProps.length > 0) {
      progress.log(
        `Custom error properties: ${customProps
          .map(prop => `${prop}=${String((error as unknown as Record<string, unknown>)[prop])}`)
          .join(', ')}`,
      );
    }
  }

  // Emit structured error event for the test framework
  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Error,
    message: `${testName} failed with detailed error information`,
    details: {
      error: errorMessage,
      stack: errorStack,
      errorType,
      testName,
      // Include additional context for Chrome extension debugging
      userAgent: globalThis.navigator?.userAgent || 'Unknown',
      location: globalThis.location?.href || 'Unknown',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Enhanced error throwing for test methods in Chrome extension environment
 */
export function throwTestError(
  error: unknown,
  testName: string,
  additionalContext?: Record<string, unknown>,
): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : 'No stack trace available';

  let enhancedMessage = `${testName} failed: ${errorMessage}`;

  if (additionalContext) {
    const contextStr = Object.entries(additionalContext)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(', ');
    enhancedMessage += `\nContext: ${contextStr}`;
  }

  enhancedMessage += `\nStack trace: ${errorStack}`;

  // Create a new error with enhanced information
  const enhancedError = new Error(enhancedMessage);
  enhancedError.name = 'TestError';
  enhancedError.cause = error;

  throw enhancedError;
}

/**
 * Wrap test execution with enhanced error handling
 */
export async function executeTestWithErrorHandling<T>(
  testName: string,
  testFn: () => Promise<T>,
  progress: Progress,
  context: TestContext,
  additionalContext?: Record<string, unknown>,
): Promise<T> {
  try {
    progress.log(`Starting ${testName}`);
    const result = await testFn();
    progress.log(`${testName} completed successfully`);
    return result;
  } catch (error) {
    handleTestError(error, testName, progress, context);
    throwTestError(error, testName, additionalContext);
  }
}

/**
 * Enhanced assertion with Chrome extension context
 */
export function assertTestCondition(
  condition: boolean,
  message: string,
  testName: string,
  actualValue?: unknown,
  expectedValue?: unknown,
): void {
  if (!condition) {
    let errorMessage = `${testName}: ${message}`;

    if (actualValue !== undefined && expectedValue !== undefined) {
      errorMessage += `\nExpected: ${String(expectedValue)}\nActual: ${String(actualValue)}`;
    } else if (actualValue !== undefined) {
      errorMessage += `\nActual value: ${String(actualValue)}`;
    }

    const error = new Error(errorMessage);
    error.name = 'AssertionError';

    throw error;
  }
}
