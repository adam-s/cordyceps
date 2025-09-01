import React, { type ReactNode } from 'react';
import { useTabNavigation, type PageType } from '@src/side-panel/hooks/useTabNavigation';
import { TabNavigationContext, type TabNavigationContextState } from './TabNavigationContext';

interface TabNavigationProviderProps {
  children: ReactNode;
  initialPage: PageType;
}

export const TabNavigationProvider: React.FC<TabNavigationProviderProps> = ({
  children,
  initialPage,
}) => {
  const { currentPage, navigateTo, navigationPayload, clearNavigationPayload } =
    useTabNavigation(initialPage);

  const contextValue: TabNavigationContextState = {
    currentPage,
    navigateTo,
    navigationPayload,
    clearNavigationPayload,
  };

  return (
    <TabNavigationContext.Provider value={contextValue}>{children}</TabNavigationContext.Provider>
  );
};
