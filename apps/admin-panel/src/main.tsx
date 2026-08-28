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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
