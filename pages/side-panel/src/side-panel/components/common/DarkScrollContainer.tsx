import React, { forwardRef, HTMLAttributes } from 'react';
import { makeStyles, tokens, mergeClasses } from '@fluentui/react-components';

const useStyles = makeStyles({
  darkScrollContainer: {
    // Webkit browsers (Chrome, Safari, Edge)
    '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '&::-webkit-scrollbar-track': {
      background: tokens.colorNeutralBackground3,
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb': {
      background: tokens.colorNeutralForeground3,
      borderRadius: '4px',
      '&:hover': {
        background: tokens.colorNeutralForeground2,
      },
    },
    // Firefox scrollbar styling
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens.colorNeutralForeground3} ${tokens.colorNeutralBackground3}`,
  },
});

interface DarkScrollContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  // className, style, role, aria-label, tabIndex, data-test-id are already part of HTMLAttributes<HTMLDivElement>
}

export const DarkScrollContainer = forwardRef<HTMLDivElement, DarkScrollContainerProps>(
  ({ children, className, ...otherProps }, ref) => {
    const styles = useStyles();

    return (
      <div
        ref={ref}
        className={mergeClasses(styles.darkScrollContainer, className)}
        {...otherProps}>
        {children}
      </div>
    );
  },
);

// Add a display name for better debugging in React DevTools
DarkScrollContainer.displayName = 'DarkScrollContainer';
