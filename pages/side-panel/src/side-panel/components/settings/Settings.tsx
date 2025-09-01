import React, { useState, FormEvent } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  Button,
  Input,
  Label,
  makeStyles,
  type InputOnChangeData,
  tokens,
} from '@fluentui/react-components';
import { SettingsRegular } from '@fluentui/react-icons';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { SidePanelAppStorageSchema, StorageKeys } from '@shared/storage/types/storage.types';

const useStyles = makeStyles({
  content: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '10px',
  },
  menuNavContainer: {
    display: 'flex',
    lineHeight: '48px',
    height: '100%',
    '&:active': {
      background: tokens.colorBrandBackgroundHover,
    },
  },
  menuNavContainerActive: {
    display: 'flex',
    lineHeight: '48px',
    height: '100%',
    background: tokens.colorBrandBackgroundHover,
    '&:active': {
      background: tokens.colorBrandBackgroundHover,
    },
  },
  menuNavButton: {
    border: '0px',
    borderRadius: '0px',
    minWidth: '48px',
    height: '48px',
    '&:hover': {
      background: tokens.colorBrandBackgroundHover,
    },
  },
  menuNavButtonActive: {
    border: '0px',
    borderRadius: '0px',
    minWidth: '48px',
    height: '48px',
    background: tokens.colorBrandBackgroundHover,
    '&:hover': {
      background: tokens.colorBrandBackgroundHover,
    },
  },
  menuIcon: {
    display: 'inline-block',
    fontSize: '16px',
    color: 'white',
  },
  dialogSurface: {
    '@media (max-width: 620px)': {
      marginLeft: '10px',
      marginRight: '10px',
    },
  },
});

export const Settings: React.FC = () => {
  const styles = useStyles();
  // Use useLocalStorage to manage API keys for different services
  const [storedOpenAiApiKey, setStoredOpenAiApiKey] = useLocalStorage<
    SidePanelAppStorageSchema,
    typeof StorageKeys.OPEN_AI_API_KEY
  >(StorageKeys.OPEN_AI_API_KEY, '');
  const [storedGoogleGeminiApiKey, setStoredGoogleGeminiApiKey] = useLocalStorage<
    SidePanelAppStorageSchema,
    typeof StorageKeys.GOOGLE_GEMINI_API_KEY
  >(StorageKeys.GOOGLE_GEMINI_API_KEY, '');

  const [dialogOpen, setDialogOpen] = useState(false);

  // Handles changes to the input fields and updates local storage
  const handleOpenAiInputChange = (
    _event: React.ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setStoredOpenAiApiKey(data.value);
  };
  const handleGoogleGeminiInputChange = (
    _event: React.ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setStoredGoogleGeminiApiKey(data.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDialogOpen(false);
  };

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(_e, data) => setDialogOpen(data.open)}
      modalType="modal"
    >
      <DialogTrigger disableButtonEnhancement>
        <div className={dialogOpen ? styles.menuNavContainerActive : styles.menuNavContainer}>
          <Button
            className={dialogOpen ? styles.menuNavButtonActive : styles.menuNavButton}
            appearance="transparent"
          >
            <SettingsRegular className={styles.menuIcon} />
          </Button>
        </div>
      </DialogTrigger>
      <DialogSurface aria-describedby={undefined} className={styles.dialogSurface}>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle>API Keys</DialogTitle>
            <DialogContent className={styles.content}>
              <Label htmlFor="openai-api-key-input">OpenAI (ChatGPT) API Key</Label>
              <Input
                id="openai-api-key-input"
                type="password"
                value={storedOpenAiApiKey || ''}
                onChange={handleOpenAiInputChange}
                placeholder="OpenAI key for ChatGPT features"
              />
              <Label htmlFor="google-gemini-api-key-input">Google Gemini API Key</Label>
              <Input
                id="google-gemini-api-key-input"
                type="password"
                disabled
                value={storedGoogleGeminiApiKey || ''}
                onChange={handleGoogleGeminiInputChange}
                placeholder="Gemini key for Google AI features"
              />
            </DialogContent>
            <DialogActions>
              <Button type="submit" appearance="primary">
                Save
              </Button>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" type="button">
                  Close
                </Button>
              </DialogTrigger>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
};
