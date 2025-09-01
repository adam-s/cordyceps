import { EventMessage, Severity } from './types';

/**
 * Creates an event message with the specified severity and options.
 */
export function makeEvent(
  severity: Severity,
  message: string,
  options: {
    source?: string;
    duration?: number;
    details?: Record<string, unknown>;
    error?: Error;
  } = {},
): EventMessage {
  return {
    message,
    timestamp: Date.now(),
    severity,
    source: options.source,
    duration: options.duration,
    details: options.details,
    error: options.error,
    stackTrace: options.error?.stack,
  };
}
