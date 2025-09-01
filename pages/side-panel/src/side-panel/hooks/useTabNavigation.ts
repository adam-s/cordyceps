import { useState, useCallback } from 'react';
import { type TabValue } from '@fluentui/react-components';

export type PageType = 'cordyceps' | 'browseruse' | 'stagehand';
export interface PagePayloads {
  stagehand: undefined;
  cordyceps: undefined;
  browseruse: undefined;
  tradeSimulator: undefined;
  news: undefined;
  chat: string | undefined;
  chatgpt: undefined;
}

export type ActiveNavigationPayload =
  | {
      [P in PageType]: {
        page: P;
        payload?: PagePayloads[P];
      };
    }[PageType]
  | undefined;

export interface TabNavigationState {
  currentPage: TabValue;
  navigateTo: <P extends PageType>(page: P, payload?: PagePayloads[P]) => void;
  navigationPayload: ActiveNavigationPayload;
  clearNavigationPayload: () => void;
}

export const useTabNavigation = (initialPage: PageType = 'stagehand'): TabNavigationState => {
  const [currentPage, setCurrentPage] = useState<TabValue>(initialPage);
  const [navigationPayload, setNavigationPayload] = useState<ActiveNavigationPayload>(undefined);

  const navigateTo = useCallback(<P extends PageType>(page: P, payload?: PagePayloads[P]) => {
    setCurrentPage(page);
    // Cast to ActiveNavigationPayload to satisfy the more specific parts of the union
    // after ensuring 'page' and 'payload' match one of the union members.
    setNavigationPayload({ page, payload } as ActiveNavigationPayload);
  }, []);

  const clearNavigationPayload = useCallback(() => {
    setNavigationPayload(undefined);
  }, []);

  return { currentPage, navigateTo, navigationPayload, clearNavigationPayload };
};
