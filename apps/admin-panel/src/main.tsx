import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Suppress benign PerformanceObserver / web-vitals crash that fires on page load
// ("Cannot read properties of undefined (reading 'startTime')")
window.addEventListener('error', (e) => {
  if (e.message?.includes('startTime')) {
    e.preventDefault();
  }
});

// Register the PWA service worker (production only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration is best-effort; the app works fine without it
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
