import { makeStyles } from '@fluentui/react-components';

export const useTextStyles = makeStyles({
  labelText: {
    fontSize: '8px',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: '#777',
    marginBottom: '2px', // Reduced from 3px
  },
  symbolText: {
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 8px', // Match StrikeFlow: less vertical padding
    color: '#777',
    lineHeight: '20px',
    letterSpacing: '0.5px',
  },
});
