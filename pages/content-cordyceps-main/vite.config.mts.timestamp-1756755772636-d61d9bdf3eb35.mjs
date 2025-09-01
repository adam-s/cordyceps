// vite.config.mts
import { defineConfig } from "file:///Users/adamsohn/Projects/cordyceps/node_modules/.pnpm/vite@5.4.19_@types+node@20.19.11/node_modules/vite/dist/node/index.js";
import { resolve } from "path";
import { makeEntryPointPlugin, watchRebuildPlugin } from "file:///Users/adamsohn/Projects/cordyceps/packages/hmr/dist/index.js";
var __vite_injected_original_dirname = "/Users/adamsohn/Projects/cordyceps/pages/content-cordyceps-main";
var rootDir = resolve(__vite_injected_original_dirname);
var vsDir = resolve(rootDir, "../../packages/vs/vs");
var srcDir = resolve(rootDir, "src");
var sharedDir = resolve(rootDir, "../../packages/shared/src");
var injectedDir = resolve(rootDir, "../../packages/injected/lib");
var isDev = process.env.__DEV__ === "true";
var isProduction = !isDev;
var vite_config_default = defineConfig({
  resolve: {
    alias: {
      "@src": srcDir,
      vs: vsDir,
      "@shared": sharedDir,
      "@injected": injectedDir
    }
  },
  plugins: [isDev && watchRebuildPlugin({ refresh: true }), isDev && makeEntryPointPlugin()],
  publicDir: resolve(rootDir, "public"),
  build: {
    lib: {
      formats: ["iife"],
      entry: resolve(__vite_injected_original_dirname, "src/index.ts"),
      name: "ContentCordycepsMainScript",
      fileName: "index"
    },
    outDir: resolve(rootDir, "..", "..", "dist", "content-cordyceps-main"),
    minify: isProduction,
    reportCompressedSize: isProduction,
    modulePreload: true,
    rollupOptions: {
      external: ["chrome"]
    }
  },
  define: {
    "process.env.NODE_ENV": isDev ? `"development"` : `"production"`
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL2FkYW1zb2huL1Byb2plY3RzL2NvcmR5Y2Vwcy9wYWdlcy9jb250ZW50LWNvcmR5Y2Vwcy1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvYWRhbXNvaG4vUHJvamVjdHMvY29yZHljZXBzL3BhZ2VzL2NvbnRlbnQtY29yZHljZXBzLW1haW4vdml0ZS5jb25maWcubXRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9hZGFtc29obi9Qcm9qZWN0cy9jb3JkeWNlcHMvcGFnZXMvY29udGVudC1jb3JkeWNlcHMtbWFpbi92aXRlLmNvbmZpZy5tdHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IG1ha2VFbnRyeVBvaW50UGx1Z2luLCB3YXRjaFJlYnVpbGRQbHVnaW4gfSBmcm9tICdAY3J4LWRlZXAtcmVzZWFyY2gvaG1yJztcblxuY29uc3Qgcm9vdERpciA9IHJlc29sdmUoX19kaXJuYW1lKTtcbmNvbnN0IHZzRGlyID0gcmVzb2x2ZShyb290RGlyLCAnLi4vLi4vcGFja2FnZXMvdnMvdnMnKTtcbmNvbnN0IHNyY0RpciA9IHJlc29sdmUocm9vdERpciwgJ3NyYycpO1xuY29uc3Qgc2hhcmVkRGlyID0gcmVzb2x2ZShyb290RGlyLCAnLi4vLi4vcGFja2FnZXMvc2hhcmVkL3NyYycpO1xuY29uc3QgaW5qZWN0ZWREaXIgPSByZXNvbHZlKHJvb3REaXIsICcuLi8uLi9wYWNrYWdlcy9pbmplY3RlZC9saWInKTtcblxuY29uc3QgaXNEZXYgPSBwcm9jZXNzLmVudi5fX0RFVl9fID09PSAndHJ1ZSc7XG5jb25zdCBpc1Byb2R1Y3Rpb24gPSAhaXNEZXY7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0BzcmMnOiBzcmNEaXIsXG4gICAgICB2czogdnNEaXIsXG4gICAgICAnQHNoYXJlZCc6IHNoYXJlZERpcixcbiAgICAgICdAaW5qZWN0ZWQnOiBpbmplY3RlZERpcixcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbaXNEZXYgJiYgd2F0Y2hSZWJ1aWxkUGx1Z2luKHsgcmVmcmVzaDogdHJ1ZSB9KSwgaXNEZXYgJiYgbWFrZUVudHJ5UG9pbnRQbHVnaW4oKV0sXG4gIHB1YmxpY0RpcjogcmVzb2x2ZShyb290RGlyLCAncHVibGljJyksXG4gIGJ1aWxkOiB7XG4gICAgbGliOiB7XG4gICAgICBmb3JtYXRzOiBbJ2lpZmUnXSxcbiAgICAgIGVudHJ5OiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9pbmRleC50cycpLFxuICAgICAgbmFtZTogJ0NvbnRlbnRDb3JkeWNlcHNNYWluU2NyaXB0JyxcbiAgICAgIGZpbGVOYW1lOiAnaW5kZXgnLFxuICAgIH0sXG4gICAgb3V0RGlyOiByZXNvbHZlKHJvb3REaXIsICcuLicsICcuLicsICdkaXN0JywgJ2NvbnRlbnQtY29yZHljZXBzLW1haW4nKSxcbiAgICBtaW5pZnk6IGlzUHJvZHVjdGlvbixcbiAgICByZXBvcnRDb21wcmVzc2VkU2l6ZTogaXNQcm9kdWN0aW9uLFxuICAgIG1vZHVsZVByZWxvYWQ6IHRydWUsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFsnY2hyb21lJ10sXG4gICAgfSxcbiAgfSxcbiAgZGVmaW5lOiB7XG4gICAgJ3Byb2Nlc3MuZW52Lk5PREVfRU5WJzogaXNEZXYgPyBgXCJkZXZlbG9wbWVudFwiYCA6IGBcInByb2R1Y3Rpb25cImAsXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVgsU0FBUyxvQkFBb0I7QUFDOVksU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCLDBCQUEwQjtBQUZ6RCxJQUFNLG1DQUFtQztBQUl6QyxJQUFNLFVBQVUsUUFBUSxnQ0FBUztBQUNqQyxJQUFNLFFBQVEsUUFBUSxTQUFTLHNCQUFzQjtBQUNyRCxJQUFNLFNBQVMsUUFBUSxTQUFTLEtBQUs7QUFDckMsSUFBTSxZQUFZLFFBQVEsU0FBUywyQkFBMkI7QUFDOUQsSUFBTSxjQUFjLFFBQVEsU0FBUyw2QkFBNkI7QUFFbEUsSUFBTSxRQUFRLFFBQVEsSUFBSSxZQUFZO0FBQ3RDLElBQU0sZUFBZSxDQUFDO0FBRXRCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLElBQUk7QUFBQSxNQUNKLFdBQVc7QUFBQSxNQUNYLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUyxDQUFDLFNBQVMsbUJBQW1CLEVBQUUsU0FBUyxLQUFLLENBQUMsR0FBRyxTQUFTLHFCQUFxQixDQUFDO0FBQUEsRUFDekYsV0FBVyxRQUFRLFNBQVMsUUFBUTtBQUFBLEVBQ3BDLE9BQU87QUFBQSxJQUNMLEtBQUs7QUFBQSxNQUNILFNBQVMsQ0FBQyxNQUFNO0FBQUEsTUFDaEIsT0FBTyxRQUFRLGtDQUFXLGNBQWM7QUFBQSxNQUN4QyxNQUFNO0FBQUEsTUFDTixVQUFVO0FBQUEsSUFDWjtBQUFBLElBQ0EsUUFBUSxRQUFRLFNBQVMsTUFBTSxNQUFNLFFBQVEsd0JBQXdCO0FBQUEsSUFDckUsUUFBUTtBQUFBLElBQ1Isc0JBQXNCO0FBQUEsSUFDdEIsZUFBZTtBQUFBLElBQ2YsZUFBZTtBQUFBLE1BQ2IsVUFBVSxDQUFDLFFBQVE7QUFBQSxJQUNyQjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLHdCQUF3QixRQUFRLGtCQUFrQjtBQUFBLEVBQ3BEO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
