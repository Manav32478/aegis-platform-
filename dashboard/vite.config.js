import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies /api and /api-docs to the API server (or the local demo on :8080).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_TARGET || 'http://localhost:8080', changeOrigin: true },
      '/api-docs': { target: process.env.API_TARGET || 'http://localhost:8080', changeOrigin: true },
    },
  },
});
