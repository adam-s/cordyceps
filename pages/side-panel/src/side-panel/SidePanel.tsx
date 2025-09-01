import React from 'react';
import '@src/side-panel/SidePanel.css';
import { FluentProvider, makeStyles, webDarkTheme, tokens } from '@fluentui/react-components';
import { withErrorBoundary, withSuspense } from '@crx-deep-research/shared';
import { Header } from './components/Header';
import { Content } from './components/Content';
import { TabNavigationProvider } from './context/TabNavigationProvider';

export const useClasses = makeStyles({
  root: {
    display: 'grid',
    gridTemplateRows: '48px 1fr',
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    gridRow: 1,
    backgroundColor: tokens.colorBrandBackground,
    width: '100%',
    overflow: 'hidden',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 48px)',
    gridRow: 2,
    backgroundColor: tokens.colorNeutralBackground4,
  },
});

const SidePanel: React.FC = () => {
  const styles = useClasses();

  return (
    <FluentProvider theme={webDarkTheme}>
      <TabNavigationProvider initialPage="cordyceps">
        <div className={styles.root}>
          <div className={styles.header}>
            <Header />
          </div>
          <div className={styles.content}>
            <Content />
          </div>
        </div>
      </TabNavigationProvider>
    </FluentProvider>
  );
};

export default withErrorBoundary(
  withSuspense(SidePanel, <div>Loading ...</div>),
  <div>Error Occurred</div>
);
