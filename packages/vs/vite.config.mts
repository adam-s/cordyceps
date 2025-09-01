import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: 'strict', // Preserve the entry signature
      input: {
        // Specify your entry points here
        index: resolve(__dirname, 'vs/index.ts'),
      },
      output: {
        entryFileNames: '[name].js', // Output file naming pattern
        preserveModules: true, // Preserve module structure
      },
      external: ['chrome'],
    },
  },
});
