// InstantiationServiceContext.ts
import React from 'react';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';

export const InstantiationServiceContext = React.createContext<InstantiationService | null>(null);
