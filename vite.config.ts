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
    proxy: {
      '/api/fish-audio': {
        target: 'https://api.fish.audio',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/fish-audio/, ''),
        secure: true,
      },
    },
    // Python virtualenvs contain thousands of vendored HTML/JS files; watching
    // them spams "page reload" and makes the dev terminal unusable.
    watch: {
      ignored: ['**/src-python/**', '**/.venv*/**', '**/node_modules/**', '**/dist/**', '**/src-tauri/target/**'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  // Prototype client-side AI keys use import.meta.env.VITE_GEMINI_API_KEY only.
  clearScreen: false,
});
