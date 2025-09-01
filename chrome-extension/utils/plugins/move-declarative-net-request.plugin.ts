import * as fs from 'fs';
import * as path from 'path';
import { colorLog } from '@crx-deep-research/dev-utils';
import type { PluginOption } from 'vite';

const { resolve } = path;

// Root directory and declarative_net_request.json path
const rootDir = resolve(__dirname, '..', '..');
const declarativeNetRequestFile = resolve(rootDir, 'declarative-net-request.json');

/**
 * Move the declarative_net_request.json file to the output directory (outDir).
 * @param config - Configuration object containing the output directory.
 * @returns PluginOption - The Vite plugin option.
 */
export default function moveDeclarativeNetRequestPlugin(config: { outDir: string }): PluginOption {
  function moveDeclarativeNetRequest(to: string) {
    if (!fs.existsSync(declarativeNetRequestFile)) {
      // File does not exist, skip quietly
      return;
    }

    // Ensure the destination directory exists
    if (!fs.existsSync(to)) {
      fs.mkdirSync(to, { recursive: true });
    }

    const destinationPath = resolve(to, 'declarative-net-request.json');

    // Copy the file to the output directory
    fs.copyFileSync(declarativeNetRequestFile, destinationPath);

    // Log success
    colorLog(`declarative-net-request.json moved to: ${destinationPath}`, 'success');
  }

  return {
    name: 'move-declarative-net-request',
    buildStart() {
      // Watch the declarative_net_request.json file for changes
      this.addWatchFile(declarativeNetRequestFile);
    },
    writeBundle() {
      // Move the declarative_net_request.json file during the writeBundle stage
      moveDeclarativeNetRequest(config.outDir);
    },
  };
}
