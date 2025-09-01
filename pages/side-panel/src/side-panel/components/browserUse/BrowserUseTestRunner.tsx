import React from 'react';
import { Button } from '@fluentui/react-components';
import { useBrowserUse } from '@src/side-panel/hooks/useBrowserBaseUse';
import { DarkScrollContainer } from '../common/DarkScrollContainer';

export const BrowserUseTestRunner: React.FC = () => {
  const { runExample, isRunning, error, clearError } = useBrowserUse();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3>Browser Use Test Runner</h3>

      {error && (
        <div
          style={{
            position: 'relative',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#d00',
            maxHeight: '150px',
          }}
        >
          <Button
            appearance="subtle"
            size="small"
            onClick={clearError}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              zIndex: 1,
              minWidth: '24px',
              height: '24px',
              padding: 0,
              fontSize: '12px',
              color: '#d00',
              background: 'transparent',
              border: 'none',
            }}
          >
            ✕
          </Button>
          <DarkScrollContainer
            style={{
              padding: '12px',
              paddingRight: '36px', // Make room for close button
              maxHeight: '150px',
              overflow: 'auto',
              background: 'transparent',
            }}
          >
            <strong>Error:</strong> {error}
          </DarkScrollContainer>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button appearance="primary" disabled={isRunning} onClick={runExample}>
          {isRunning ? 'Running Example...' : 'Run Browser Use Example'}
        </Button>
      </div>

      {isRunning && (
        <div
          style={{
            padding: '12px',
            background: '#e7f3ff',
            border: '1px solid #b3d9ff',
            borderRadius: '4px',
            color: '#0066cc',
          }}
        >
          🔄 Browser Use example is running...
        </div>
      )}
    </div>
  );
};
