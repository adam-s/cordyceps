import { BackgroundApp } from './src/background.app';

console.log('background loaded');

(async () => {
  try {
    const app = new BackgroundApp();
    await app.start();
  } catch (error) {
    console.log('Error: ', error);
  }
})();

chrome.action.onClicked.addListener(() => {
  // Get the current window and open the side panel in that window
  chrome.windows.getCurrent({ populate: true }, window => {
    if (window?.id) {
      chrome.sidePanel.open({ windowId: window.id }).catch(error => console.error(error));
    }
  });
});
