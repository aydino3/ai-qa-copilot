import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.UI_API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/ws':  { target: API_TARGET.replace(/^http/, 'ws'), ws: true, changeOrigin: true },
      // Playwright artifacts (screenshots, videos, traces, snapshot baselines)
      // are served as static files by Express — proxy them so the browser can
      // reach them from the Vite dev server without a separate port.
      '/test-results': { target: API_TARGET, changeOrigin: true },
      '/tests':        { target: API_TARGET, changeOrigin: true },
    },
  },
});
