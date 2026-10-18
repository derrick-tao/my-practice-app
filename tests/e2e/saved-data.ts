// Seam 1 helpers for the two places where a test has to touch what is saved on the device directly:
//  - seeding a "saved-data fixture" (what an earlier visit left behind), which pins the persisted
//    format: if the format changes, the fixture must still load, through a migration;
//  - reading back the persistent-storage result, which has no screen until the parent area (ticket 13).
// Everything else about saving is observed through the screens (reload, Keep going, retry banner).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export function savedDataFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/saved-data/${name}.json`, import.meta.url), 'utf8'));
}

interface SavedData {
  app: unknown;
  sessions: Array<{ id: string }>;
}

/** Replace what is saved on the device (the page must already be on the app's origin). */
export async function seedSavedData(page: Page, data: SavedData): Promise<void> {
  await page.evaluate(
    (saved) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('my-practice-app', 1);
        open.onupgradeneeded = () => {
          open.result.createObjectStore('meta');
          open.result.createObjectStore('sessions', { keyPath: 'id' }).createIndex('profileId', 'profileId');
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['meta', 'sessions'], 'readwrite');
          tx.objectStore('meta').put(saved.app, 'app');
          const sessions = tx.objectStore('sessions');
          sessions.clear();
          for (const session of saved.sessions) sessions.put(session);
          tx.oncomplete = () => (db.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
      }),
    data,
  );
}

/** The saved persistent-storage request result, if the app has recorded one. */
export async function savedPersistence(page: Page): Promise<{ granted: boolean } | undefined> {
  return page.evaluate(
    () =>
      new Promise<{ granted: boolean } | undefined>((resolve, reject) => {
        const open = indexedDB.open('my-practice-app', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('meta', 'readonly').objectStore('meta').get('device');
          get.onsuccess = () => (db.close(), resolve(get.result));
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

declare global {
  interface Window {
    /** Set by `stubPersistentStorage`: how many times the app asked for persistent storage on this page load. */
    __persistRequests?: number;
  }
}

/** Make `navigator.storage.persist()` answer `granted` and count the requests (per page load). */
export async function stubPersistentStorage(page: Page, granted: boolean): Promise<void> {
  await page.addInitScript((answer) => {
    window.__persistRequests = 0;
    StorageManager.prototype.persist = function persist(): Promise<boolean> {
      window.__persistRequests = (window.__persistRequests ?? 0) + 1;
      return Promise.resolve(answer);
    };
  }, granted);
}
