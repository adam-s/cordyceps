import React from 'react';
import { makeStyles } from '@fluentui/react-components';
import { StagehandTestRunner } from '../components/stagehand/StagehandTestRunner';
import { StagehandConsole } from '../components/stagehand/StagehandConsole';

// Define breakpoints (consider moving to a shared constants file)
const BREAKPOINTS = {
  MOBILE: '300px',
  TABLET: '600px',
  DESKTOP: '900px',
} as const;

const useStyles = makeStyles({
  root: {
    height: '100%',
    width: '100%',
    display: 'grid',
    gap: '10px',
    gridTemplateRows: 'auto 1fr',
    gridTemplateColumns: '1fr',
    [`@media (min-width: ${BREAKPOINTS.TABLET})`]: {
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: 'auto 1fr',
    },
    [`@media (min-width: ${BREAKPOINTS.DESKTOP})`]: {
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: 'auto 1fr',
    },
  },
  testRunner: {
    gridColumn: '1',
    gridRow: '1',
    [`@media (min-width: ${BREAKPOINTS.TABLET})`]: {
      gridColumn: '1',
      gridRow: '1',
    },
  },
  console: {
    gridColumn: '1',
    gridRow: '2',
    minHeight: 0,
    [`@media (min-width: ${BREAKPOINTS.TABLET})`]: {
      gridColumn: '2',
      gridRow: '1 / 3',
    },
  },
});

export const Stagehand: React.FC = () => {
  const styles = useStyles();

  return (
    <div data-test-id="stagehand" className={styles.root}>
      <div className={styles.testRunner}>
        <StagehandTestRunner />
      </div>
      <div className={styles.console}>
        <StagehandConsole />
      </div>
    </div>
  );
};
