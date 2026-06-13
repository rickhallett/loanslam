import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// The widget is served as an iframe app. In dev it talks to the backend on
// :8787; in production the API origin is injected at build/runtime.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
