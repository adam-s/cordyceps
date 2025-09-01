import { ISidePanelConfiguration, SidePanelApp } from '@src/side-panel/side-panel.app';
const configuration: ISidePanelConfiguration = {};
import './index.css';

try {
  const sidePanel = new SidePanelApp(configuration);
  sidePanel.start();
} catch (error) {
  console.log(error);
}
