import React, { useEffect, useRef } from 'react';
import { Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { DeleteRegular, PlayRegular } from '@fluentui/react-icons';
import { DarkScrollContainer } from '../common/DarkScrollContainer';
import { EventMessage, Severity } from '../../../utils/types';

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
});

const getSeverityColor = (severity: Severity): string => {
  switch (severity) {
    case Severity.Success:
      return '#b5cea8';
    case Severity.Info:
      return '#4ec9b0';
    case Severity.Warning:
      return '#dcdcaa';
    case Severity.Error:
      return '#f44747';
    default:
      return '#d4d4d4';
  }
};

const getSeverityLevel = (severity: Severity): string => {
  switch (severity) {
    case Severity.Success:
      return 'SUCCESS';
    case Severity.Info:
      return 'INFO';
    case Severity.Warning:
      return 'WARNING';
    case Severity.Error:
      return 'ERROR';
    default:
      return 'INFO';
  }
};

interface ConsoleComponentProps {
  /** Title displayed in the console header */
  title: string;
  /** Service name displayed in brackets for each log entry */
  serviceName: string;
  /** Array of event messages to display */
  events: EventMessage[];
  /** Function to clear all events */
  onClearEvents?: () => void;
  /** Empty state message when no events */
  emptyStateMessage?: string;
  /** Empty state subtitle when no events */
  emptyStateSubtitle?: string;
}

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

export const ConsoleComponent: React.FC<ConsoleComponentProps> = ({
  title,
  serviceName,
  events,
  onClearEvents,
  emptyStateMessage = `${title} console ready`,
  emptyStateSubtitle = 'Waiting for execution...',
}) => {
  const styles = useStyles();
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text className={styles.headerTitle}>{title}</Text>
        {onClearEvents && (
          <div className={styles.headerActions}>
            <Button
              appearance="subtle"
              size="small"
              icon={<DeleteRegular />}
              onClick={onClearEvents}
              disabled={events.length === 0}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      <DarkScrollContainer ref={consoleRef} className={styles.console}>
        {events.length === 0 ? (
          <div className={styles.emptyState}>
            <PlayRegular style={{ fontSize: '24px', marginBottom: '8px' }} />
            <div>{emptyStateMessage}</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>{emptyStateSubtitle}</div>
          </div>
        ) : (
          events.map((event, index) => (
            <div key={index} className={styles.logEntry}>
              <span className={styles.timestamp}>{formatTimestamp(event.timestamp)}</span>
              <span className={styles.service}>[{serviceName}]</span>
              <span className={styles.level} style={{ color: getSeverityColor(event.severity) }}>
                {getSeverityLevel(event.severity)}
              </span>
              <span>{event.message}</span>
              {event.thumbnail && (
                <div style={{ marginLeft: '60px', marginTop: '8px' }}>
                  <img
                    src={event.thumbnail}
                    alt="Screenshot thumbnail"
                    onError={e => {
                      // Hide broken images
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    style={{
                      maxWidth: '300px',
                      maxHeight: '200px',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      display: 'block',
                      background: '#2a2a2a',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#888',
                      marginTop: '2px',
                      fontStyle: 'italic',
                    }}
                  >
                    📷 Screenshot thumbnail
                  </div>
                </div>
              )}
              {event.details && (
                <div
                  style={{
                    color: '#808080',
                    fontSize: '10px',
                    marginLeft: '60px',
                    marginTop: '2px',
                  }}
                >
                  {typeof event.details === 'string'
                    ? event.details
                    : JSON.stringify(event.details, null, 2)}
                </div>
              )}
            </div>
          ))
        )}
      </DarkScrollContainer>
    </div>
  );
};
