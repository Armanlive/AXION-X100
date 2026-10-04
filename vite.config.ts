import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Narrowed host policy:
    // - '.run.app' wildcard is explicitly required by the Google AI Studio cloud development/preview environment
    // - 'localhost' and '127.0.0.1' are required for native Tauri v2 webview IPC development
    // Note: This is a preview/dev environment binding, not a production security configuration.
    allowedHosts: ['.run.app', 'localhost', '127.0.0.1'],
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['.run.app', 'localhost', '127.0.0.1'],
  },
  // Do NOT expose process.env server/native secrets into client bundle.
  // Prototype client-side AI keys use import.meta.env.VITE_GEMINI_API_KEY only.
  clearScreen: false,
});
