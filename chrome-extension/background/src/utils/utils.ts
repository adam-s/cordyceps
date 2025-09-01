import { IDocumentIdResponse } from '@shared/utils/message';

export async function getDocumentId(sender?: chrome.runtime.MessageSender): Promise<string> {
  if (sender?.documentId) {
    return sender?.documentId;
  } else {
    throw new Error('DocumentId not found.');
  }
}

export async function getWindowId(sender?: chrome.runtime.MessageSender): Promise<number> {
  if (sender?.tab?.windowId != null) {
    return sender.tab.windowId;
  } else {
    throw new Error('WindowId not found.');
  }
}

export function sendErrorResponse(
  error: string,
  sendResponse: (response: IDocumentIdResponse) => void,
): void {
  console.error(error);
  sendResponse({ error });
}

export interface IInformationResponse {
  documentId?: string;
  windowId?: number;
  tabId?: number;
  frameId?: number;
  error?: string;
}

export async function getInformation(
  sender?: chrome.runtime.MessageSender,
): Promise<IInformationResponse> {
  if (!sender) {
    throw new Error('Sender not found.');
  }

  return {
    documentId: sender.documentId,
    windowId: sender.tab?.windowId,
    tabId: sender.tab?.id,
    frameId: sender.frameId,
  };
}

export async function checkSidePanelStatus(windowId: number): Promise<boolean> {
  try {
    await chrome.runtime.sendMessage({
      type: `crx-deep-research:sidePanelVisibilityChangeTest:${windowId}`,
    });
    return true; // Panel is open
  } catch (error) {
    return false; // Panel is closed
  }
}
