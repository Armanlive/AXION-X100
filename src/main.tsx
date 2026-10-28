import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { requestBackgroundSync } from './services/memorySync.ts';

// Opportunistic background cloud-sync at startup (offline-safe; no-ops when
// Supabase env vars are absent or the device is offline). Never blocks UI.
if (typeof navigator !== 'undefined' && navigator.onLine) {
  requestBackgroundSync();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
