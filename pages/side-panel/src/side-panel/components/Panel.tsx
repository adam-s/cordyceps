import { makeStyles, tokens, mergeClasses } from '@fluentui/react-components';
import React from 'react';

const useStyles = makeStyles({
  panel: {
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusXLarge,
    height: '100%',
    width: '100%',
  },
  scrollablePanel: {
    overflowY: 'auto',
    maxHeight: '100%',
    height: '100%',
    '&::-webkit-scrollbar': {
      width: '6px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: tokens.colorNeutralBackground3,
      borderRadius: '6px',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: tokens.colorNeutralStroke1,
      borderRadius: '6px',
      '&:hover': {
        backgroundColor: tokens.colorNeutralStrokeAccessible,
      },
    },
  },
});

export interface PanelProps {
  className?: string;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ className, children }) => {
  const styles = useStyles();
  return <div className={mergeClasses(styles.panel, className)}>{children}</div>;
};

export const ScrollablePanel: React.FC<PanelProps> = ({ className, children }) => {
  const styles = useStyles();
  return <Panel className={mergeClasses(styles.scrollablePanel, className)}>{children}</Panel>;
};
