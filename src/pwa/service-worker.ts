// Registers the service worker (production builds only) and tracks whether a newer version is waiting.
//
// A new worker installs in the background and then WAITS. Nothing here ever reloads the page by itself:
// the page only reloads after the child taps "New words are ready!" on the home screen (applyUpdate).
import { useEffect, useState } from 'preact/hooks';

let waiting: ServiceWorker | undefined;
let reloadRequested = false;
const listeners = new Set<() => void>();

function setWaiting(worker: ServiceWorker | undefined): void {
  waiting = worker;
  for (const listener of listeners) listener();
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const container = navigator.serviceWorker;

  container.addEventListener('controllerchange', () => {
    // Also fires when the very first worker takes over a page; only an explicit tap may reload.
    if (reloadRequested) location.reload();
  });

  const watch = (registration: ServiceWorkerRegistration): void => {
    // A waiting worker only counts as an update when an older one is already running the page.
    if (registration.waiting && container.controller) setWaiting(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && container.controller) setWaiting(installing);
      });
    });
    // A phone app can stay open for days: look for a new version whenever it comes back to the screen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update().catch(() => {});
    });
  };

  void container
    .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' })
    .then(watch, () => {
      // No service worker (private mode, unsupported): the app still works online.
    });
}

/** True while a newer version of the app is installed and waiting to take over. */
export function useUpdateReady(): boolean {
  const [ready, setReady] = useState(waiting !== undefined);
  useEffect(() => {
    const sync = (): void => setReady(waiting !== undefined);
    listeners.add(sync);
    sync();
    return () => void listeners.delete(sync);
  }, []);
  return ready;
}

/** Let the waiting version take over, then reload onto it (the reload happens on controllerchange). */
export function applyUpdate(): void {
  reloadRequested = true;
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}
