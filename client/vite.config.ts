import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Backend port — keep in sync with server/src/config.ts (defaults to 5174).
// Target 127.0.0.1 (not "localhost") so the proxy always hits the IPv4 backend
// and can't be shadowed by a stray process on IPv6 ::1.
const API_PORT = process.env.SERVER_PORT ?? '5174';
const API_TARGET = `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Bind to 0.0.0.0 so the studio is reachable from an iPad/iPhone on the same WiFi.
    host: true,
    port: Number(process.env.CLIENT_PORT ?? 3000),
    strictPort: false,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
