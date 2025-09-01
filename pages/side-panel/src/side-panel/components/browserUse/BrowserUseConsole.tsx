import React from 'react';
import { useBrowserUse } from '@src/side-panel/hooks/useBrowserBaseUse';
import { ConsoleComponent } from '../common/ConsoleComponent';

export const BrowserUseConsole: React.FC = () => {
  const { events, clearEvents } = useBrowserUse();

  return (
    <ConsoleComponent
      title="Browser Use Console"
      serviceName="browser-use"
      events={events}
      onClearEvents={clearEvents}
      emptyStateMessage="Browser Use console ready"
      emptyStateSubtitle="Waiting for example execution..."
    />
  );
};
