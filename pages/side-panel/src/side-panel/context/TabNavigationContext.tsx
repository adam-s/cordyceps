import { createContext, useContext } from 'react';
import { type TabValue } from '@fluentui/react-components';
import {
  type PageType,
  type PagePayloads,
  type ActiveNavigationPayload,
} from '@src/side-panel/hooks/useTabNavigation';

export interface TabNavigationContextState {
  currentPage: TabValue;
  navigateTo: <P extends PageType>(page: P, payload?: PagePayloads[P]) => void;
  navigationPayload: ActiveNavigationPayload;
  clearNavigationPayload: () => void;
}

export const TabNavigationContext = createContext<TabNavigationContextState | undefined>(undefined);

export const useTabNavigationContext = (): TabNavigationContextState => {
  const context = useContext(TabNavigationContext);
  if (context === undefined) {
    throw new Error('useTabNavigationContext must be used within a TabNavigationProvider');
  }
  return context;
};
