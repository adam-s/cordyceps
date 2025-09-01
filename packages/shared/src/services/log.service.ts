import { Disposable } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';

/**
 * Enumeration of log levels.
 */
export const enum LogLevel {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
  Off = 5,
}

// const logService = new LogService();
// logService.setLevel(LogLevel.Debug);

// logService.debug('This is a debug message.');
// logService.info('This is an info message.');
// logService.warn('This is a warning message.');
// logService.error('This is an error message.');

/**
 * Service interface for logging with configurable log levels.
 */
export interface ILogService {
  _serviceBrand: undefined;

  /**
   * Gets the current log level.
   */
  readonly level: LogLevel;

  /**
   * Sets the log level.
   * @param level The new log level.
   */
  setLevel(level: LogLevel): void;

  /**
   * Logs a message at the 'Info' level.
   * @param message The message to log.
   */
  log(...message: unknown[]): void;

  /**
   * Logs a message at the 'Trace' level.
   * @param message The message to log.
   */
  trace(...message: unknown[]): void;

  /**
   * Logs a message at the 'Debug' level.
   * @param message The message to log.
   */
  debug(...message: unknown[]): void;

  /**
   * Logs a message at the 'Info' level.
   * @param message The message to log.
   */
  info(...message: unknown[]): void;

  /**
   * Logs a message at the 'Warn' level.
   * @param message The message to log.
   */
  warn(...message: unknown[]): void;

  /**
   * Logs a message at the 'Error' level.
   * @param message The message to log.
   */
  error(...message: unknown[]): void;
}

export const ILogService = createDecorator<ILogService>('logService');

/**
 * Implementation of a logging service with configurable log levels and colored output.
 */
export class LogService extends Disposable implements ILogService {
  declare readonly _serviceBrand: undefined;

  private _level: LogLevel = LogLevel.Info;

  get level(): LogLevel {
    return this._level;
  }

  setLevel(level: LogLevel): void {
    this._level = level;
  }

  constructor() {
    super();
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this._level && this._level !== LogLevel.Off;
  }

  private formatMessage(levelLabel: string, colorCode: string, message: unknown[]): unknown[] {
    const colorReset = '\x1b[0m';
    const coloredLevel = `${colorCode}[${levelLabel}]${colorReset}`;
    return [coloredLevel, ...message];
  }

  log(...message: unknown[]): void {
    this.info(...message);
  }

  trace(...message: unknown[]): void {
    if (this.shouldLog(LogLevel.Trace)) {
      console.debug(...this.formatMessage('trace', '\x1b[90m', message)); // Gray
    }
  }

  debug(...message: unknown[]): void {
    if (this.shouldLog(LogLevel.Debug)) {
      console.debug(...this.formatMessage('debug', '\x1b[34m', message)); // Blue
    }
  }

  info(...message: unknown[]): void {
    if (this.shouldLog(LogLevel.Info)) {
      console.info(...this.formatMessage('info', '\x1b[32m', message)); // Green
    }
  }

  warn(...message: unknown[]): void {
    if (this.shouldLog(LogLevel.Warn)) {
      console.warn(...this.formatMessage('warn', '\x1b[33m', message)); // Yellow
    }
  }

  error(...message: unknown[]): void {
    if (this.shouldLog(LogLevel.Error)) {
      console.error(...this.formatMessage('error', '\x1b[31m', message)); // Red
    }
  }
}

registerSingleton(ILogService, LogService, InstantiationType.Delayed);
