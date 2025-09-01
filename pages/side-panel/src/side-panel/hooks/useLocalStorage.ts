import { useState, useEffect, useCallback } from 'react';
import { useService } from './useService'; // Changed from useInjection
import { AsyncStorageSchema, ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';

/**
 * A React hook to manage a value in chrome.storage.local via LocalAsyncStorageService.
 *
 * @template Schema The specific storage schema interface extending AsyncStorageSchema.
 * @template Key A key within the Schema.
 * @param key The key of the item in storage.
 * @param defaultValue The default value to use if the key is not found in storage.
 *                     This default value will also be written to storage if the key is initially absent.
 * @returns A tuple:
 *          - The current value from storage (or defaultValue, or undefined).
 *          - A function to update the value in storage and in the local state.
 */
export function useLocalStorage<Schema extends AsyncStorageSchema, Key extends keyof Schema>(
  key: Key,
  defaultValue?: Schema[Key],
): [
  Schema[Key] | undefined,
  (value: Schema[Key] | ((prevState: Schema[Key] | undefined) => Schema[Key])) => Promise<void>,
] {
  const baseStorageService = useService<ILocalAsyncStorage<AsyncStorageSchema>>(ILocalAsyncStorage);
  // Use double assertion to avoid unsafe direct cast between generics
  const storageService = baseStorageService as unknown as ILocalAsyncStorage<Schema>;
  const [storedValue, setStoredValue] = useState<Schema[Key] | undefined>(() => {
    // Initialize state with defaultValue. The effect below will load from storage.
    // This avoids a potential flicker if storage is slow to load.
    return defaultValue;
  });

  // Effect for initial load from storage and setting defaultValue if storage is empty
  useEffect(() => {
    let isMounted = true;

    // useService throws if the service is not available, so storageService should be defined here.
    // However, keeping the check for robustness or future changes where service might become null.
    if (!storageService) {
      console.warn('useLocalStorage: LocalAsyncStorageService not available.');
      return;
    }

    storageService
      .get(key)
      .then(valueFromStorage => {
        if (isMounted) {
          if (valueFromStorage === undefined) {
            // Storage is empty for this key
            setStoredValue(defaultValue); // Update state to current defaultValue
            if (defaultValue !== undefined) {
              // Persist defaultValue to storage if it's defined
              storageService.set(key, defaultValue).catch(error => {
                console.error(
                  `useLocalStorage: Failed to set default value for key "${String(
                    key,
                  )}" in storage.`,
                  error,
                );
              });
            }
          } else {
            // Storage has a value, update state
            setStoredValue(valueFromStorage);
          }
        }
      })
      .catch(error => {
        console.error(
          `useLocalStorage: Failed to get value for key "${String(
            key,
          )}" from storage. Falling back to default.`,
          error,
        );
        if (isMounted) {
          setStoredValue(defaultValue); // Fallback to defaultValue on error
        }
      });

    return () => {
      isMounted = false;
    };
  }, [key, defaultValue, storageService]); // storageService is stable from useService

  // Effect for listening to external storage changes
  useEffect(() => {
    if (!storageService) {
      return;
    }

    const disposable = storageService.onUpdateValue(event => {
      if (event.key === key) {
        // Ensure type compatibility for setStoredValue
        setStoredValue(event.newValue as Schema[Key] | undefined);
      }
    });

    return () => disposable.dispose();
  }, [key, storageService]);

  // Function to set the value in storage
  const setValue = useCallback(
    async (value: Schema[Key] | ((prevState: Schema[Key] | undefined) => Schema[Key])) => {
      if (!storageService) {
        console.error('useLocalStorage: LocalAsyncStorageService not available. Cannot set value.');
        return;
      }

      const oldValue = storedValue;
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;

        setStoredValue(valueToStore); // Optimistic update of local state

        await storageService.set(key, valueToStore);
        // The onUpdateValue listener will also be triggered by this set operation,
        // potentially calling setStoredValue again. React handles this gracefully if the value is the same.
      } catch (error) {
        console.error(
          `useLocalStorage: Failed to set value for key "${String(
            key,
          )}" in storage. Reverting optimistic update.`,
          error,
        );
        setStoredValue(oldValue); // Revert optimistic update on error
        // Optionally re-throw or handle the error further
      }
    },
    [key, storageService, storedValue],
  );

  return [storedValue, setValue];
}
