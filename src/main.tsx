/**
 * LIFEKIT entry point.
 *
 * Registers the service worker (progressive enhancement: the app works fine without it,
 * it just loses the offline cache), and mounts the React tree. Service worker updates are
 * surfaced to the user instead of being applied silently, because an unexpected reload
 * mid-entry would be worse than a small "update ready" prompt.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installNativeShell, isNativeApp } from './lib/native';
import { StoreProvider } from './state/store';

const container = document.getElementById('root');
if (!container) {
  throw new Error('LIFEKIT could not find its root element.');
}

/*
 * Inside the Android app (see android/README.md) the shell supplies printing, saving exports and
 * system notifications. This must run before the first render so a "Print" press during the first
 * paint already goes to Android's print dialog.
 */
installNativeShell();

createRoot(container).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);

/* ----------------------------- service worker ----------------------------- */

export interface UpdateNotice {
  available: boolean;
  apply: () => void;
}

declare global {
  interface Window {
    __lifekitUpdateAvailable?: boolean;
    __lifekitApplyUpdate?: () => void;
  }
}

/* The Android shell bundles the built app inside the APK, so a service worker would add nothing
   there but a second cache to keep in step; it is registered for the web app only. */
if ('serviceWorker' in navigator && !import.meta.env.DEV && !isNativeApp()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              window.__lifekitUpdateAvailable = true;
              window.dispatchEvent(new CustomEvent('lifekit:update-available'));
              window.__lifekitApplyUpdate = () => {
                installing.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              };
            }
          });
        });
      })
      .catch(() => {
        // Registration failures are non-fatal: the app still runs online.
      });
  });
}
