import { Severity } from '@src/utils/types';
import { Progress } from '../../core/progress';
import { TestContext } from './api';

export interface DetailedErrorInfo extends Record<string, unknown> {
  error: string;
  stack: string;
  errorType: string;
  testName?: string;
  testStep?: string;
}

export function logDetailedError(
  error: unknown,
  progress: Progress,
  context: TestContext,
  testName: string,
  testStep?: string,
): DetailedErrorInfo {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack =
    error instanceof Error ? error.stack || 'No stack trace available' : 'No stack trace available';
  const errorType = error instanceof Error ? error.constructor.name : typeof error;

  const errorInfo: DetailedErrorInfo = {
    error: errorMessage,
    stack: errorStack,
    errorType,
    testName,
    testStep,
  };

  progress.log(`${testName} failed: ${errorMessage}`);
  if (testStep) {
    progress.log(`Failed at step: ${testStep}`);
  }
  progress.log(`Error type: ${errorType}`);
  progress.log(`Error stack trace: ${errorStack}`);

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Error,
    message: `${testName} failed with detailed error information`,
    details: errorInfo,
  });

  return errorInfo;
}

export function createDetailedError(error: unknown, testName: string, testStep?: string): Error {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack =
    error instanceof Error ? error.stack || 'No stack trace available' : 'No stack trace available';
  const errorType = error instanceof Error ? error.constructor.name : typeof error;

  let message = `${testName} failed: ${errorMessage}`;
  if (testStep) {
    message += `\nFailed at step: ${testStep}`;
  }
  message += `\nError type: ${errorType}`;
  message += `\nStack trace: ${errorStack}`;

  return new Error(message);
}

export function wrapTestStep<T>(
  stepName: string,
  testFunction: () => Promise<T>,
  progress: Progress,
  context: TestContext,
): Promise<T> {
  return testFunction().catch(error => {
    logDetailedError(error, progress, context, `Test step: ${stepName}`);
    throw createDetailedError(error, `Test step: ${stepName}`);
  });
}
