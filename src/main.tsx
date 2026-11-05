import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { startReminderScheduler } from './reminders/scheduler';
import { startSyncEngine } from './sync/engine';
import { useUI } from './store/ui';
import './styles/global.css';

// Ask the browser not to evict our IndexedDB data. Export is still the safety net.
void navigator.storage?.persist?.().catch(() => undefined);

// With autoUpdate, a new service worker reloads the page; tell the user afterwards.
try {
  if (sessionStorage.getItem('gb-updated')) {
    sessionStorage.removeItem('gb-updated');
    window.setTimeout(() => useUI.getState().showToast('Greenbit was updated to the latest version'), 500);
  }
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (navigator.serviceWorker.controller) sessionStorage.setItem('gb-updated', '1');
  });
} catch {
  /* storage unavailable */
}

startReminderScheduler();
startSyncEngine();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
