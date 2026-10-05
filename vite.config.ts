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
    // AI Studio Cloud Environment Requirement:
    // Vite 6 host validation blocks requests from Google Cloud Run preview domains,
    // Google internal proxies (e.g. localhost.corp.google.com), and dynamic iframe hosts.
    // Broad allowedHosts: true is required by the AI Studio cloud sandbox to prevent 403 Forbidden errors.
    // Note: This is an environment preview binding, not a production security configuration.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  // Prototype client-side AI keys use import.meta.env.VITE_GEMINI_API_KEY only.
  clearScreen: false,
});
