import React from 'react';
import { useStagehandPlayground } from '@src/side-panel/hooks/useStagehandPlayground';
import { ConsoleComponent } from '../common/ConsoleComponent';

export const StagehandConsole: React.FC = () => {
  const { events, clearEvents } = useStagehandPlayground();

  return (
    <ConsoleComponent
      title="Stagehand Console"
      serviceName="stagehand"
      events={events}
      onClearEvents={clearEvents}
      emptyStateMessage="Stagehand console ready"
      emptyStateSubtitle="Waiting for test execution..."
    />
  );
};
