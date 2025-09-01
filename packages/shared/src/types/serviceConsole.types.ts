/**
 * Log levels for service console entries
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

/**
 * Service names that can log to the console
 */
export type ServiceName =
  | 'crxMCP'
  | 'babyElephantV1'
  | 'babyElephantV2'
  | 'system'
  | 'stagehand'
  | 'cordyceps'
  | 'browser-use';

/**
 * Structured log entry for the service console
 */
export interface LogEntry {
  /** Unique identifier for the log entry */
  readonly id: string;
  /** Timestamp when the log was created */
  readonly timestamp: Date;
  /** Service that generated the log */
  readonly service: ServiceName;
  /** Log level/severity */
  readonly level: LogLevel;
  /** Log message content */
  readonly message: string;
  /** Optional step number for multi-step processes */
  readonly step?: number;
  /** Optional additional details */
  readonly details?: Record<string, unknown>;
  /** Optional error object */
  readonly error?: Error;
  /** Optional stack trace */
  readonly stackTrace?: string;
  /** Optional thumbnail data URL */
  readonly thumbnail?: string;
}

/**
 * Interface for the global service console
 */
export interface ServiceConsoleInterface {
  /** Add a log entry to the console */
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
}
