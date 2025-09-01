/**
 * Component names for logging configuration
 */
export type LogComponent =
  | 'RemoteMessageServer'
  | 'RemoteMessageClient'
  | 'Protocol'
  | 'SocketServerFactory'
  | 'SocketClientFactory'
  | 'RemoteMarketDataService'; // Added new component

/**
 * Debug configuration for application logging
 */
export const DEBUG_CONFIG = {
  enabled: false,
  components: {
    // Core components
    RemoteMessageServer: false,
    RemoteMessageClient: false,
    Protocol: false,
    SocketServerFactory: false,
    SocketClientFactory: false,
    RemoteMarketDataService: false, // Added new component configuration
    // Add other components as needed
  } as Record<LogComponent, boolean>,
};

/**
 * Logger utility for consistent debug logging across the application
 */
export class Logger {
  /**
   * Create a logger instance for a specific component
   */
  static forComponent(componentName: LogComponent): Logger {
    return new Logger(componentName);
  }

  /**
   * Enable or disable all logging
   */
  static enableLogging(enabled: boolean): void {
    DEBUG_CONFIG.enabled = enabled;
  }

  /**
   * Enable or disable logging for a specific component
   */
  static enableComponentLogging(componentName: LogComponent, enabled: boolean): void {
    DEBUG_CONFIG.components[componentName] = enabled;
  }

  /**
   * Enable or disable logging for multiple components
   */
  static configureComponentLogging(config: Partial<Record<LogComponent, boolean>>): void {
    Object.entries(config).forEach(([component, enabled]) => {
      const logComponent = component as LogComponent;
      if (DEBUG_CONFIG.components[logComponent] !== undefined) {
        DEBUG_CONFIG.components[logComponent] = enabled;
      }
    });
  }

  private constructor(private readonly componentName: LogComponent) {}

  /**
   * Log a debug message with optional data
   */
  debug(message: string, data?: unknown): void {
    if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.components[this.componentName]) {
      return;
    }

    console.group(`[${this.componentName}]: ${message}`);
    if (data !== undefined) {
      console.log(data);
    }
    console.groupEnd();
  }

  /**
   * Log an error message with optional context
   */
  error(message: string, error: unknown, context?: Record<string, unknown>): void {
    const errObj =
      error instanceof Error || (typeof error === 'object' && error !== null && 'message' in error)
        ? error
        : { message: String(error) };
    console.error(`[${this.componentName}] ERROR: ${message}`, {
      error: {
        message: 'message' in errObj ? errObj.message : String(errObj),
        name: errObj instanceof Error ? errObj.name : 'UnknownError',
        stack: errObj instanceof Error ? errObj.stack : new Error().stack,
      },
      context,
    });
  }
}
