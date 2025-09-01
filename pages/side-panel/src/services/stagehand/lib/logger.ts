/**
 * Chrome extension compatible logger with concise console output
 * Drop-in replacement for Pino-based logging
 */
import { LogLine } from '../types/log';

// Define configuration options - maintains original API
export interface LoggerOptions {
  pretty?: boolean;
  level?: 'error' | 'warn' | 'info' | 'debug';
  destination?: unknown; // Ignored in console implementation
  usePino?: boolean; // Ignored in console implementation
}

/**
 * Creates a simple console logger - maintains original API
 */
export function createLogger(options: LoggerOptions = {}) {
  // Return a minimal logger interface for compatibility
  return {
    level: options.level || 'info',
    error: (data: unknown, message?: string) =>
      console.error(`[ERROR] ${message || JSON.stringify(data)}`),
    warn: (data: unknown, message?: string) =>
      console.warn(`[WARN] ${message || JSON.stringify(data)}`),
    info: (data: unknown, message?: string) =>
      console.info(`[INFO] ${message || JSON.stringify(data)}`),
    debug: (data: unknown, message?: string) =>
      console.debug(`[DEBUG] ${message || JSON.stringify(data)}`),
    trace: (data: unknown, message?: string) =>
      console.debug(`[TRACE] ${message || JSON.stringify(data)}`),
  };
}

/**
 * Check if we're running in a test environment - maintains original API
 */
function isTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'test' ||
      process.env?.JEST_WORKER_ID !== undefined ||
      process.env?.PLAYWRIGHT_TEST_BASE_DIR !== undefined ||
      process.env?.CI === 'true')
  );
}

/**
 * Get emoji for log level
 */
function getLevelEmoji(level: number): string {
  const emojis: Record<number, string> = {
    0: '❌', // error
    1: 'ℹ️', // info
    2: '🐛', // debug
  };
  return emojis[level] || 'ℹ️';
}

/**
 * Format timestamp for console display
 */
function formatTime(): string {
  return new Date().toISOString().slice(11, 23);
}

/**
 * StagehandLogger class - maintains original API
 */
export class StagehandLogger {
  private static sharedPinoLogger: unknown = null; // Maintains compatibility

  private verbose: 0 | 1 | 2;
  private externalLogger?: (logLine: LogLine) => void;
  private isTest: boolean;

  constructor(_options: LoggerOptions = {}, externalLogger?: (logLine: LogLine) => void) {
    this.isTest = isTestEnvironment();
    this.verbose = 1; // Default verbosity level
    this.externalLogger = externalLogger;
  }

  /**
   * Set the verbosity level - maintains original API
   */
  setVerbosity(level: 0 | 1 | 2): void {
    this.verbose = level;
  }

  /**
   * Log a message using LogLine format - maintains original API
   */
  log(logLine: LogLine): void {
    // Skip logs above verbosity level
    if ((logLine.level ?? 1) > this.verbose) {
      return;
    }

    // Use external logger if provided
    if (this.externalLogger) {
      this.externalLogger(logLine);
      return;
    }

    // Format console output
    const level = logLine.level ?? 1;
    const emoji = getLevelEmoji(level);
    const time = formatTime();
    const category = logLine.category ? `[${logLine.category}]` : '';
    const message = `${emoji} ${category} ${logLine.message} | ${time}`;

    // Log to appropriate console method
    switch (level) {
      case 0:
        console.error(message);
        break;
      case 1:
        console.log(message);
        break;
      case 2:
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  /**
   * Helper to format auxiliary data - maintains original structure
   */
  private formatAuxiliaryData(auxiliary?: LogLine['auxiliary']): Record<string, unknown> {
    if (!auxiliary) return {};

    const formattedData: Record<string, unknown> = {};

    for (const [key, { value, type }] of Object.entries(auxiliary)) {
      switch (type) {
        case 'integer':
          formattedData[key] = parseInt(value, 10);
          break;
        case 'float':
          formattedData[key] = parseFloat(value);
          break;
        case 'boolean':
          formattedData[key] = value === 'true';
          break;
        case 'object':
          try {
            formattedData[key] = JSON.parse(value);
          } catch {
            formattedData[key] = value;
          }
          break;
        default:
          formattedData[key] = value;
      }
    }

    return formattedData;
  }

  /**
   * Convenience methods - maintain original API
   */
  error(message: string, data?: Record<string, unknown>): void {
    this.log({
      message,
      level: 0,
      auxiliary: this.convertToAuxiliary(data),
    });
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log({
      message,
      level: 1,
      category: 'warning',
      auxiliary: this.convertToAuxiliary(data),
    });
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log({
      message,
      level: 1,
      auxiliary: this.convertToAuxiliary(data),
    });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log({
      message,
      level: 2,
      auxiliary: this.convertToAuxiliary(data),
    });
  }

  /**
   * Convert a plain object to auxiliary format - maintains original API
   */
  private convertToAuxiliary(data?: Record<string, unknown>): LogLine['auxiliary'] {
    if (!data) return undefined;

    const auxiliary: LogLine['auxiliary'] = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;

      const type = typeof value;

      auxiliary[key] = {
        value: type === 'object' ? JSON.stringify(value) : String(value),
        type:
          type === 'number'
            ? Number.isInteger(value)
              ? 'integer'
              : 'float'
            : type === 'boolean'
              ? 'boolean'
              : type === 'object'
                ? 'object'
                : 'string',
      };
    }

    return auxiliary;
  }
}
