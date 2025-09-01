import { defineConfig, type PluginOption } from 'vite';
import { resolve } from 'path';
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets';
import makeManifestPlugin from './utils/plugins/make-manifest.plugin';
import { watchRebuildPlugin } from '@crx-deep-research/hmr';
import moveDeclarativeNetRequestPlugin from './utils/plugins/move-declarative-net-request.plugin'; // Import the plugin

const rootDir = resolve(__dirname);
const libDir = resolve(rootDir, 'lib');
const srcDir = resolve(rootDir, 'background/src');
const vsDir = resolve(rootDir, '../packages/vs/vs');
const sharedDir = resolve(rootDir, '../packages/shared/src');

const isDev = process.env.__DEV__ === 'true';
const isProduction = !isDev;

const outDir = resolve(rootDir, '..', 'dist');

export default defineConfig({
  resolve: {
    alias: {
      '@root': rootDir,
      '@lib': libDir,
      '@src': srcDir,
      '@assets': resolve(libDir, 'assets'),
      '@shared': sharedDir,
      vs: vsDir,
    },
  },
  plugins: [
    libAssetsPlugin({
      outputPath: outDir,
    }) as unknown as PluginOption, // Ensure the plugin is typed correctly
    makeManifestPlugin({ outDir }),
    moveDeclarativeNetRequestPlugin({ outDir }), // Use the new plugin
    isDev && watchRebuildPlugin({ reload: true }),
  ],
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      formats: ['iife'],
      entry: resolve(__dirname, 'background/index.ts'),
      name: 'BackgroundScript',
      fileName: 'background',
    },
    outDir,
    minify: isProduction,
    reportCompressedSize: isProduction,
    modulePreload: true,
    rollupOptions: {
      external: ['chrome'],
    },
  },
});
