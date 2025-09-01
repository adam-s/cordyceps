import { IInformationResponse } from './message';

export const requestDocumentId = async (): Promise<string> => {
  const response = await chrome.runtime.sendMessage({
    type: 'crx-deep-research:requestDocumentId',
  });
  return response.documentId;
};

export const requestWindowId = async (): Promise<number> => {
  const response = await chrome.runtime
    .sendMessage({
      type: 'crx-deep-research:requestWindowId',
    })
    .catch(error => {
      console.log('requestWindowId caused error: ', error);
    });
  return response.windowId;
};

export const requestInformation = async () => {
  const response = await chrome.runtime.sendMessage({
    type: 'crx-deep-research:requestInformation',
  });
  return response as IInformationResponse;
};

// Utility to extract documentId and windowId from 'documentId:${documentId}:${windowId}?[:tabId][:frameId]'
export const parseDocumentId = (
  source: string,
): {
  documentId: string;
  windowId?: number;
  tabId?: number;
  frameId?: number;
} | null => {
  try {
    const parts = source.split(':');
    if (parts[0] !== 'documentId') return null;

    const [, documentId, windowId, tabIdStr, frameIdStr] = parts;

    return {
      documentId,
      windowId: windowId ? Number(windowId) : undefined,
      tabId: tabIdStr ? Number(tabIdStr) : undefined,
      frameId: frameIdStr ? Number(frameIdStr) : undefined,
    };
  } catch (error) {
    console.log('parseDocumentId caused error: ', error);
    return null;
  }
};

// Utility to create the documentId string
export const createDocumentId = (
  documentId: string,
  windowId?: string | number,
  tabId?: number | number,
  frameId?: number | number,
): string => {
  let id = documentId;
  if (windowId) id += `:${windowId}`;
  if (tabId !== undefined) id += `:${tabId}`;
  if (frameId !== undefined) id += `:${frameId}`;
  return id;
};

export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100,
): Promise<boolean> {
  const endTime = Date.now() + timeout;
  return new Promise(resolve => {
    function check() {
      if (condition()) {
        resolve(true);
      } else if (Date.now() < endTime) {
        setTimeout(check, interval);
      } else {
        resolve(false);
      }
    }
    check();
  });
}
