import { useState, useCallback, useEffect } from 'react';
import { IDisposable } from 'vs/base/common/lifecycle';
import { useService } from './useService';
import { IBrowserUseService } from '@src/services/browser-use/browserUse.service';
import { EventMessage, Severity } from '@src/utils/types';

export interface UseBrowserUseReturn {
  /** Run the browser use example */
  runExample: () => Promise<void>;
  /** All events emitted by browser use */
  events: EventMessage[];
  /** Whether the example is currently running */
  isRunning: boolean;
  /** Any error that occurred during example execution */
  error: string | null;
  /** Clear any error */
  clearError: () => void;
  /** Clear all events and reset state */
  clearEvents: () => void;
}

export const useBrowserUse = (): UseBrowserUseReturn => {
  const browserUseService = useService(IBrowserUseService);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!browserUseService) return;

    const disposables: IDisposable[] = [];

    // Listen to browser use events
    disposables.push(
      browserUseService.onEvent((event: EventMessage) => {
        setEvents(prevEvents => [...prevEvents, event]);
        // Track running state based on events
        if (event.severity === Severity.Info && event.message === 'Starting Browser Use example') {
          setIsRunning(true);
          setError(null);
        } else if (
          event.severity === Severity.Success &&
          event.message === 'Browser Use example completed successfully'
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
  }, [browserUseService]);

  const runExample = useCallback(async (): Promise<void> => {
    if (!browserUseService) {
      setError('Browser Use service not available');
      return;
    }

    try {
      setError(null);
      await browserUseService.runExample();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run browser use example';
      setError(errorMessage);
      console.error('useBrowserUse: Failed to run example:', err);
    }
  }, [browserUseService]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const clearEvents = useCallback((): void => {
    setEvents([]);
    setError(null);
  }, []);

  return {
    runExample,
    events,
    isRunning,
    error,
    clearError,
    clearEvents,
  };
};
