export interface IBaseMessage {
  type: string;
}

export interface IDocumentIdMessage extends IBaseMessage {
  type: 'crx-deep-research:requestDocumentId';
}

export interface IWindowIdMessage extends IBaseMessage {
  type: 'crx-deep-research:requestWindowId';
}

export interface IConsoleLogMessage extends IBaseMessage {
  type: 'crx-deep-research:console.log';
  [key: string]: unknown;
}

export interface ICreateMAINPortMessage extends IBaseMessage {
  type: 'crx-deep-research:createMAINPort';
  id: string;
}

export const CRX_DEEP_RESEARCH_SIDE_PANEL_VISIBILITY_CHANGE =
  'crx-deep-research:sidePanelVisibilityChange';
export interface ISidePanelVisibilityChangeMessage extends IBaseMessage {
  type: typeof CRX_DEEP_RESEARCH_SIDE_PANEL_VISIBILITY_CHANGE;
  open: boolean;
  windowId: number;
}

export const CRX_DEEP_RESEARCH_SIDE_PANEL_RELOAD = 'crx-deep-research:sidePanelReload';
export interface ISidePanelReloadMessage extends IBaseMessage {
  type: typeof CRX_DEEP_RESEARCH_SIDE_PANEL_RELOAD;
  windowId: number;
}
export interface IContentScriptReloadPostMessage extends IBaseMessage {
  type: typeof CRX_DEEP_RESEARCH_SIDE_PANEL_RELOAD;
  source: string;
}

export const CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED = 'crx-deep-research:contentScriptLoaded';
export interface IContentScriptLoadedMessage extends IBaseMessage {
  type: typeof CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED;
}

export const CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE =
  'crx-deep-research:fileTransferPortCreate';
export interface IFileTransferPortCreateMessage extends IBaseMessage {
  type: typeof CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE;
  portId: string;
}

export const CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_EVENT = 'crx-deep-research:fileTransferPortEvent';
export interface IFileTransferPortEventMessage extends IBaseMessage {
  type: typeof CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_EVENT;
  portId: string;
  event: unknown;
}

export const CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_COMMAND =
  'crx-deep-research:fileTransferPortCommand';
export interface IFileTransferPortCommandMessage extends IBaseMessage {
  type: typeof CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_COMMAND;
  portId: string;
  command: unknown;
}

export const CRX_DEEP_RESEARCH_NAVIGATION_EVENT = 'cordyceps:navigation-event';
export interface INavigationEventMessage extends IBaseMessage {
  type: typeof CRX_DEEP_RESEARCH_NAVIGATION_EVENT;
  detail: {
    type: 'pushState' | 'replaceState' | 'popstate' | 'hashchange';
    url: string;
    timestamp: number;
  };
  tabId?: number;
  frameId?: number;
}

export interface IInformationResponse {
  documentId?: string;
  windowId?: number;
  tabId?: number;
  frameId?: number;
  error?: string;
}

export type DocumentMessage =
  | IDocumentIdMessage
  | IWindowIdMessage
  | IConsoleLogMessage
  | ICreateMAINPortMessage
  | ISidePanelVisibilityChangeMessage
  | ISidePanelReloadMessage
  | IContentScriptLoadedMessage
  | IContentScriptReloadPostMessage
  | IFileTransferPortCreateMessage
  | IFileTransferPortEventMessage
  | IFileTransferPortCommandMessage
  | INavigationEventMessage
  | { type: 'crx-deep-research:requestInformation' }
  | IIPCMessageTypes;

export interface IDocumentIdResponse {
  documentId?: string;
  error?: string;
}

export interface IWindowIdResponse {
  windowId?: number;
  error?: string;
}

export const CRX_DEEP_RESEARCH_MESSAGE = 'crx-deep-research:message';
export const CRX_DEEP_RESEARCH_HELLO = 'crx-deep-research:hello';
export const CRX_DEEP_RESEARCH_DISCONNECT = 'crx-deep-research:disconnect';
export const CRX_DEEP_RESEARCH_RECONNECT = 'crx-deep-research:reconnect';

export interface IIPCMessage {
  type: string;
}

export interface IIPCHelloMessage extends IIPCMessage {
  type: typeof CRX_DEEP_RESEARCH_HELLO;
  source: string;
}

export interface IIPCDisconnectMessage extends IIPCMessage {
  type: typeof CRX_DEEP_RESEARCH_DISCONNECT;
  source: string;
  target: string;
}

export interface IIPCReconnectMessage extends IIPCMessage {
  type: typeof CRX_DEEP_RESEARCH_RECONNECT;
  source: string;
  target: string;
}

export interface IIPCDataMessage extends IIPCMessage {
  type: typeof CRX_DEEP_RESEARCH_MESSAGE;
  source: string;
  body: number[];
  target?: string;
}

export type IIPCMessageTypes = IIPCHelloMessage | IIPCDisconnectMessage | IIPCDataMessage;

export interface Message {
  type: string;
  source: string;
  body: number[]; // Serialized as an array of numbers
  target: string;
}

export type DocumentResponse =
  | IDocumentIdResponse
  | IWindowIdResponse
  | IInformationResponse
  | { error: string };
