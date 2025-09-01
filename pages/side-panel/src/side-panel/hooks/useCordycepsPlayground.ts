import { useState, useEffect, useCallback } from 'react';
import { IDisposable } from 'vs/base/common/lifecycle';
import { useService } from './useService';
import { EventMessage, Severity } from '../../utils/types';
import { ICordycepsPlaygroundService } from '@src/services/cordyceps/playground/cordycepsPlayground.service';

export interface UseCordycepsPlaygroundReturn {
  /** Run locator test */
  runLocatorTest: () => Promise<void>;
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
}

export const useCordycepsPlayground = (): UseCordycepsPlaygroundReturn => {
  const cordycepsPlaygroundService = useService(ICordycepsPlaygroundService);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [latestEvent, setLatestEvent] = useState<EventMessage | undefined>(undefined);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cordycepsPlaygroundService) return;

    const disposables: IDisposable[] = [];

    // Listen to playground events
    disposables.push(
      cordycepsPlaygroundService.onEvent((event: EventMessage) => {
        setLatestEvent(event);
        setEvents(prevEvents => [...prevEvents, event]);
        // Track running state based on events
        if (
          event.severity === Severity.Info &&
          (event.message === 'Playground starting' ||
            event.message.includes('Starting') ||
            event.message === 'Starting locator test')
        ) {
          setIsRunning(true);
          setError(null);
        } else if (
          event.severity === Severity.Success &&
          (event.message === 'Playground complete' ||
            event.message.includes('completed') ||
            event.message === 'Locator test completed successfully')
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
  }, [cordycepsPlaygroundService]);

  const runLocatorTest = useCallback(async (): Promise<void> => {
    if (!cordycepsPlaygroundService) {
      setError('Cordyceps playground service not available');
      return;
    }

    try {
      setError(null);
      await cordycepsPlaygroundService.runLocatorTest();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run locator test';
      setError(errorMessage);
      console.error('useCordycepsPlayground: Failed to run locator test:', err);
    }
  }, [cordycepsPlaygroundService]);

  const clearEvents = useCallback((): void => {
    setEvents([]);
    setLatestEvent(undefined);
    setError(null);
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    runLocatorTest,
    events,
    latestEvent,
    isRunning,
    error,
    clearEvents,
    clearError,
  };
};
