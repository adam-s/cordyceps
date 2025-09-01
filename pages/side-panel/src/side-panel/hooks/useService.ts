// useService.ts
import { useContext } from 'react';
import { InstantiationServiceContext } from '../context/InstantiationServiceContext';
import { ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';

export function useService<T>(serviceIdentifier: ServiceIdentifier<T>): T {
  const instantiationService = useContext(InstantiationServiceContext);
  if (!instantiationService) {
    throw new Error('No instantiationService found in context');
  }
  return instantiationService.invokeFunction(accessor =>
    accessor.get<T>(serviceIdentifier),
  );
}
