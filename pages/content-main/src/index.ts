import { IContentMainConfiguration, ContentMainApp } from '@src/contentMain.app';

const configuration: IContentMainConfiguration = {};

let content: ContentMainApp | undefined;

const loader = () => {
  content?.dispose();
  content = new ContentMainApp(configuration);
  content.start();
};

// Listen for reload messages from side panel
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'CRX_DEEP_RESEARCH_SIDE_PANEL_RELOAD') {
    console.log('Content Injected script received reload message from side panel');
    try {
      loader();
    } catch (error) {
      console.log(error);
    }
  }
});

try {
  loader();
} catch (error) {
  console.log(error);
}
