// Generic message interfaces for port types
export interface InitializeContentScriptMessage<TPort extends string> {
  type: `crx-deep-research:initializeContentScript:${TPort}`;
}

export interface CreateMainPortMessage<TPort extends string> {
  type: `crx-deep-research:create${TPort}Port`;
  id: string;
}

export interface HelloMessage<TPort extends string> {
  type: `crx-deep-research:hello:${TPort}`;
}

export type CrxDeepResearchMessage<TPort extends string> =
  | InitializeContentScriptMessage<TPort>
  | CreateMainPortMessage<TPort>
  | HelloMessage<TPort>;

// Define the Port interface
export interface Port<TPort extends string = string> {
  name: string;
  postMessage: (message: CrxDeepResearchMessage<TPort>) => void;
  disconnect: () => void;
  onMessage: {
    addListener: (callback: (message: CrxDeepResearchMessage<TPort>) => void) => void;
  };
  onDisconnect: {
    addListener: (callback: () => void) => void;
  };
}
