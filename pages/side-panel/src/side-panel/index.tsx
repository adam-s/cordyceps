import { createRoot } from 'react-dom/client';
import SidePanel from '@src/side-panel/SidePanel';
import { InstantiationServiceProvider } from '@src/side-panel/context/InstantiationServiceProvider';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';

export function renderSidePanel(instantiationService: InstantiationService) {
  const appContainer = document.querySelector('#app');
  if (!appContainer) {
    throw new Error('Can not find #app');
  }

  const root = createRoot(appContainer);
  root.render(
    <InstantiationServiceProvider instantiationService={instantiationService}>
      <SidePanel />
    </InstantiationServiceProvider>,
  );
}
