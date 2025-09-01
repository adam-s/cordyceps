/* eslint-disable import/named */
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Server } from 'http';
import { createApp } from '../server/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExtensionTestFixtures {
  context: BrowserContext;
  extensionId: string;
  background: Worker;
  serverUrl: string;
}

export const test = base.extend<ExtensionTestFixtures>({
  // Start the server on port 3005
  // eslint-disable-next-line no-empty-pattern
  serverUrl: async ({}, use) => {
    const app = createApp();
    const port = 3005;
    const listener: Server = app.listen(port);
    await new Promise<void>(resolve => listener.once('listening', resolve));
    const url = `http://localhost:${port}`;
    console.log(`🟢 Test server running at ${url}`);
    await use(url);
    await new Promise<void>((resolve, reject) => {
      listener.close(err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  context: async ({ serverUrl }, use) => {
    const pathToExtension = path.join(__dirname, '../../../dist');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        process.env.CI ? `--headless=new` : '',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      // Set baseURL so you can use relative URLs in tests
      baseURL: serverUrl,
    });

    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // for manifest v3:
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
  background: async ({ context }, use) => {
    // for manifest v3:
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    await use(background);
  },
});

export const expect = test.expect;
