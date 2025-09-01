import { defineConfig } from 'vite';
import { resolve } from 'path';

const rootDir = resolve(__dirname);
const vsDir = resolve(rootDir, '../../packages/vs/vs'); // Adjust this path as necessary
const srcDir = resolve(rootDir, 'src');
const sharedDir = resolve(rootDir, '../../packages/shared/src'); // Adjust this path as necessary

const isDev = process.env.__DEV__ === 'true';
const isProduction = !isDev;

export default defineConfig({
  resolve: {
    alias: {
      '@src': srcDir,
      vs: vsDir,
      '@shared': sharedDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      formats: ['iife'],
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ContentMainScript',
      fileName: 'index',
    },
    outDir: resolve(rootDir, '..', '..', 'dist', 'content-main'),
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
