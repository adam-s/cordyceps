import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { PlayRegular, DeleteRegular } from '@fluentui/react-icons';
import { DarkScrollContainer } from '../common/DarkScrollContainer';
import type {
  LogEntry,
  LogLevel,
  ServiceConsoleInterface,
  ServiceName,
} from '@shared/types/serviceConsole.types';

// Global window interface extension
declare global {
  interface Window {
    serviceConsole?: ServiceConsoleInterface;
  }
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  console: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'Consolas, "Courier New", Monaco, monospace',
    fontSize: '12px',
    lineHeight: '1.4',
    padding: '12px',
    overflow: 'auto',
    minHeight: 0,
    borderRadius: tokens.borderRadiusSmall,
  },
  logEntry: {
    marginBottom: '2px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  timestamp: {
    color: '#808080',
    marginRight: '8px',
  },
  service: {
    color: '#569cd6',
    marginRight: '8px',
  },
  level: {
    marginRight: '8px',
    fontWeight: 'bold',
  },
  info: {
    color: '#4ec9b0',
  },
  success: {
    color: '#b5cea8',
  },
  warning: {
    color: '#dcdcaa',
  },
  error: {
    color: '#f44747',
  },
  debug: {
    color: '#9cdcfe',
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#1e1e1e',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  prompt: {
    color: '#4ec9b0',
    fontFamily: 'Consolas, "Courier New", Monaco, monospace',
    fontSize: '12px',
    marginRight: '8px',
    userSelect: 'none',
  },
  commandInput: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    color: '#d4d4d4',
    fontFamily: 'Consolas, "Courier New", Monaco, monospace',
    fontSize: '12px',
    padding: '4px',
    outline: 'none',
    '&::placeholder': {
      color: '#808080',
    },
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#808080',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  details: {
    color: '#808080',
    fontSize: '10px',
    marginLeft: '60px',
    marginTop: '2px',
    background: '#2a2a2a',
    padding: '4px 8px',
    borderRadius: '3px',
  },
  thumbnail: {
    marginLeft: '60px',
    marginTop: '8px',
    '& img': {
      maxWidth: '300px',
      maxHeight: '200px',
      border: '1px solid #444',
      borderRadius: '4px',
      display: 'block',
      background: '#2a2a2a',
    },
    '& .caption': {
      fontSize: '10px',
      color: '#888',
      marginTop: '2px',
      fontStyle: 'italic',
    },
  },
});

// Export the shared types for backward compatibility
export type { LogLevel, LogEntry, ServiceName } from '@shared/types/serviceConsole.types';

interface ServiceConsoleProps {
  /** Title displayed in the console header */
  title?: string;
  /** Service name for filtering (if provided, only shows logs from this service) */
  serviceName?: ServiceName;
  /** Callback when a command is entered */
  onCommand?: (command: string) => void;
  /** Maximum number of log entries to keep in memory */
  maxEntries?: number;
  /** Whether to show the command input */
  showCommandInput?: boolean;
}

export const ServiceConsole: React.FC<ServiceConsoleProps> = ({
  title = 'Service Console',
  serviceName,
  onCommand,
  maxEntries = 1000,
  showCommandInput = false,
}) => {
  const styles = useStyles();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [command, setCommand] = useState('');
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback(
    (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
      const newEntry: LogEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      };

      setLogs(prev => {
        const newLogs = [...prev, newEntry];
        return newLogs.length > maxEntries ? newLogs.slice(-maxEntries) : newLogs;
      });
    },
    [maxEntries]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const handleCommandSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && command.trim()) {
        // Add command to console as user input
        addLog({
          service: 'system',
          level: 'info',
          message: `$ ${command}`,
        });

        // Execute command
        if (onCommand) {
          onCommand(command.trim());
        }

        setCommand('');
      }
    },
    [command, onCommand, addLog]
  );

  const getLevelClassName = useCallback(
    (level: LogLevel): string => {
      switch (level) {
        case 'info':
          return styles.info;
        case 'success':
          return styles.success;
        case 'warning':
          return styles.warning;
        case 'error':
          return styles.error;
        case 'debug':
          return styles.debug;
        default:
          return styles.info;
      }
    },
    [styles]
  );

  const formatTimestamp = useCallback((timestamp: Date): string => {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }, []);

  // Expose addLog function globally so services can use it
  useEffect(() => {
    window.serviceConsole = { addLog };
    return () => {
      delete window.serviceConsole;
    };
  }, [addLog]);

  // Filter logs by service if specified
  const filteredLogs = serviceName ? logs.filter(log => log.service === serviceName) : logs;

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    // Hide broken images
    (e.target as HTMLImageElement).style.display = 'none';
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text className={styles.headerTitle}>{title}</Text>
        <div className={styles.headerActions}>
          <Button
            appearance="subtle"
            size="small"
            icon={<DeleteRegular />}
            onClick={clearLogs}
            disabled={filteredLogs.length === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      <DarkScrollContainer ref={consoleRef} className={styles.console}>
        {filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>
            <PlayRegular style={{ fontSize: '24px', marginBottom: '8px' }} />
            <div>{title.toLowerCase()} ready</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              Waiting for {serviceName ? `${serviceName} ` : ''}messages...
            </div>
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className={styles.logEntry}>
              <span className={styles.timestamp}>{formatTimestamp(log.timestamp)}</span>
              <span className={styles.service}>[{log.service}]</span>
              <span className={`${styles.level} ${getLevelClassName(log.level)}`}>
                {log.level.toUpperCase()}
              </span>
              <span>{log.message}</span>
              {log.step !== undefined && (
                <span style={{ color: '#808080', fontSize: '10px', marginLeft: '8px' }}>
                  #{log.step}
                </span>
              )}
              {log.details && Object.keys(log.details).length > 0 && (
                <div className={styles.details}>
                  {typeof log.details === 'string'
                    ? log.details
                    : JSON.stringify(log.details, null, 2)}
                </div>
              )}
              {log.thumbnail && (
                <div className={styles.thumbnail}>
                  <img src={log.thumbnail} alt="Screenshot thumbnail" onError={handleImageError} />
                  <div className="caption">📷 Screenshot thumbnail</div>
                </div>
              )}
              {log.error && (
                <div
                  style={{
                    marginLeft: '60px',
                    marginTop: '4px',
                    color: '#ff6b6b',
                    fontSize: '11px',
                  }}
                >
                  Error: {log.error.message}
                  {log.stackTrace && (
                    <pre
                      style={{
                        marginTop: '4px',
                        fontSize: '10px',
                        color: '#ccc',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {log.stackTrace}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </DarkScrollContainer>

      {showCommandInput && (
        <div className={styles.inputContainer}>
          <span className={styles.prompt}>{'>'}</span>
          <input
            className={styles.commandInput}
            type="text"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={handleCommandSubmit}
            placeholder="Enter command..."
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
};

// Utility function for services to easily log messages
export const logToServiceConsole = (
  service: ServiceName,
  level: LogLevel,
  message: string,
  options?: {
    step?: number;
    details?: Record<string, unknown>;
    error?: Error;
    stackTrace?: string;
    thumbnail?: string;
  }
): void => {
  const serviceConsole = window.serviceConsole;
  if (serviceConsole?.addLog) {
    serviceConsole.addLog({
      service,
      level,
      message,
      step: options?.step,
      details: options?.details,
      error: options?.error,
      stackTrace: options?.stackTrace,
      thumbnail: options?.thumbnail,
    });
  }
};
