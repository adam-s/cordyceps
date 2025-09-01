import React from 'react';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { InstantiationServiceContext } from '@src/side-panel/context/InstantiationServiceContext';

// export const useInstantiationService = () => {
//   const context = useContext(InstantiationServiceContext);
//   if (!context) {
//     throw new Error('useInstantiationService must be used within an InstantiationServiceProvider');
//   }
//   return context;
// };

export const InstantiationServiceProvider: React.FC<{
  instantiationService: InstantiationService;
  children: React.ReactNode;
}> = ({ children, instantiationService }) => (
  <InstantiationServiceContext.Provider value={instantiationService}>{children}</InstantiationServiceContext.Provider>
);
