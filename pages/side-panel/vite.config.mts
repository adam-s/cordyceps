import { defineConfig, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import { watchRebuildPlugin } from '@crx-deep-research/hmr';

const rootDir = resolve(__dirname);
const srcDir = resolve(rootDir, 'src');
const vsDir = resolve(rootDir, '../../packages/vs/vs');
const sharedDir = resolve(rootDir, '../../packages/shared/src');
const injectedDir = resolve(rootDir, '../../packages/injected/lib');
const isDev = process.env.__DEV__ === 'true';
const isProduction = !isDev;

const mainEntry = resolve(rootDir, 'index.html');

function conditionalHmrPlugin(config: { refresh?: boolean; reload?: boolean }): PluginOption {
  const basePlugin = watchRebuildPlugin(config) as Plugin;

  return {
    ...basePlugin,
    name: `conditional-${basePlugin?.name || 'watch-rebuild'}`,
    transform(code, id) {
      if (typeof basePlugin?.transform === 'function') {
        return basePlugin?.transform.call(this, code, id);
      }
      return null;
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@src': srcDir,
      vs: vsDir,
      '@shared': sharedDir,
      '@injected': injectedDir,
    },
  },
  base: '',
  plugins: [react(), isDev && conditionalHmrPlugin({ refresh: true })].filter(
    Boolean,
  ) as PluginOption[],
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, '..', '..', 'dist', 'side-panel'),
    minify: isProduction,
    reportCompressedSize: isProduction,
    rollupOptions: {
      external: ['chrome'],
      input: {
        main: mainEntry,
      },
      output: {
        entryFileNames: chunkInfo => {
          switch (chunkInfo.name) {
            case 'worker':
              return 'worker.js';
            case 'workerASR':
            default:
              return 'assets/[name]-[hash].js';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    target: 'esnext',
  },
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
  },
});
