import { useState, useCallback, useEffect } from 'react';
import { IDisposable } from 'vs/base/common/lifecycle';
import { useService } from './useService';
import { EventMessage, Severity } from '../../utils/types';
import { IStagehandPlaygroundService } from '@src/services/stagehand/playground/stagehandPlayground.service';

export interface UseStagehandPlaygroundReturn {
  /** Run elephant research test */
  runElephantResearchTest: () => Promise<void>;
  /** All events emitted by the playground */
  events: EventMessage[];
  /** Latest event from the playground */
  latestEvent: EventMessage | undefined;
  /** Whether any test is currently running */
  isRunning: boolean;
  /** Any error that occurred during test execution */
  error: string | null;
  /** Clear all events and reset state */
  clearEvents: () => void;
  /** Clear any error */
  clearError: () => void;
  /** Get events filtered by severity */
  getEventsBySeverity: (severity: Severity) => EventMessage[];
}

export const useStagehandPlayground = (): UseStagehandPlaygroundReturn => {
  const stagehandPlaygroundService = useService(IStagehandPlaygroundService);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stagehandPlaygroundService) return;

    const disposables: IDisposable[] = [];

    // Listen to playground events
    disposables.push(
      stagehandPlaygroundService.onEvent((event: EventMessage) => {
        setEvents(prevEvents => [...prevEvents, event]);

        // Track running state based on events
        if (
          event.severity === Severity.Info &&
          (event.message === 'Starting Stagehand playground tests' ||
            event.message.includes('Starting'))
        ) {
          setIsRunning(true);
          setError(null);
        } else if (
          event.severity === Severity.Success &&
          (event.message === 'Stagehand playground tests completed successfully' ||
            event.message.includes('completed'))
        ) {
          setIsRunning(false);
        } else if (event.severity === Severity.Error) {
          setIsRunning(false);
          setError(event.error?.message || event.message);
        }
      })
    );

    return () => {
      disposables.forEach(disposable => disposable.dispose());
    };
  }, [stagehandPlaygroundService]);

  const runElephantResearchTest = useCallback(async () => {
    if (!stagehandPlaygroundService) {
      setError('Stagehand playground service not available');
      return;
    }

    try {
      setError(null);
      await stagehandPlaygroundService.runElephantResearchTest();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to run elephant research test';
      setError(errorMessage);
      console.error('useStagehandPlayground: Failed to run elephant research test:', err);
    }
  }, [stagehandPlaygroundService]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const latestEvent = events.length > 0 ? events[events.length - 1] : undefined;

  const getEventsBySeverity = useCallback(
    (severity: Severity) => {
      return events.filter(e => e.severity === severity);
    },
    [events]
  );

  return {
    runElephantResearchTest,
    events,
    latestEvent,
    isRunning,
    error,
    clearEvents,
    clearError,
    getEventsBySeverity,
  };
};
