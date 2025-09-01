import { defineConfig } from 'vite';
import { resolve } from 'path';
import { makeEntryPointPlugin, watchRebuildPlugin } from '@crx-deep-research/hmr';

const rootDir = resolve(__dirname);
const vsDir = resolve(rootDir, '../../packages/vs/vs');
const srcDir = resolve(rootDir, 'src');
const sharedDir = resolve(rootDir, '../../packages/shared/src');
const injectedDir = resolve(rootDir, '../../packages/injected/lib');

const isDev = process.env.__DEV__ === 'true';
const isProduction = !isDev;

export default defineConfig({
  resolve: {
    alias: {
      '@src': srcDir,
      vs: vsDir,
      '@shared': sharedDir,
      '@injected': injectedDir,
    },
  },
  plugins: [isDev && watchRebuildPlugin({ refresh: true }), isDev && makeEntryPointPlugin()],
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      formats: ['iife'],
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ContentCordycepsMainScript',
      fileName: 'index',
    },
    outDir: resolve(rootDir, '..', '..', 'dist', 'content-cordyceps-main'),
    minify: isProduction,
    reportCompressedSize: isProduction,
    modulePreload: true,
    rollupOptions: {
      external: ['chrome'],
    },
  },
  define: {
    'process.env.NODE_ENV': isDev ? `"development"` : `"production"`,
  },
});
