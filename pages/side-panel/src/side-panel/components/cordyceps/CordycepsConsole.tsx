import React from 'react';
import { useCordycepsPlayground } from '../../hooks/useCordycepsPlayground';
import { ConsoleComponent } from '../common/ConsoleComponent';

export const CordycepsConsole: React.FC = () => {
  const { events, clearEvents } = useCordycepsPlayground();

  return (
    <ConsoleComponent
      title="Cordyceps Console"
      serviceName="cordyceps"
      events={events}
      onClearEvents={clearEvents}
      emptyStateMessage="Cordyceps console ready"
      emptyStateSubtitle="Waiting for test execution..."
    />
  );
};
