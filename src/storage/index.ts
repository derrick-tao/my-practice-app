// The app's single StorageAdapter instance. UI and practice code import `getStorage()` from here and
// nothing else under src/storage (only this folder talks to IndexedDB).
import { createIdbStorage } from './idb.ts';
import type { StorageAdapter } from './types.ts';

export type { StorageAdapter } from './types.ts';
export { NewerSchemaError } from './types.ts';

declare global {
  interface Window {
    /** Test builds only (`--mode e2e`): while true, every storage write fails (Seam 1 "Saving" scenario). */
    __failStorageWrites?: boolean;
  }
}

/**
 * Test builds only: lets Seam 1 force write failures. `import.meta.env.MODE` is replaced at build time,
 * so the production bundle drops this branch (and the hook name) entirely.
 */
function withWriteFailureHook(adapter: StorageAdapter): StorageAdapter {
  const guard = (): void => {
    if (window.__failStorageWrites) throw new Error('Simulated storage write failure');
  };
  return {
    ...adapter,
    saveApp: (app) => (guard(), adapter.saveApp(app)),
    putSession: (session) => (guard(), adapter.putSession(session)),
    deleteSessionsByProfile: (profileId) => (guard(), adapter.deleteSessionsByProfile(profileId)),
    importAll: (data) => (guard(), adapter.importAll(data)),
    setPersistence: (status) => (guard(), adapter.setPersistence(status)),
  };
}

let instance: StorageAdapter | undefined;

export function getStorage(): StorageAdapter {
  if (!instance) {
    const idb = createIdbStorage();
    instance = import.meta.env.MODE === 'e2e' ? withWriteFailureHook(idb) : idb;
  }
  return instance;
}

/**
 * First run only: ask the browser to keep our storage from being evicted, and keep the answer so the
 * parent area can show it later (ticket 13). Never throws: this is best effort.
 */
export async function requestPersistenceOnFirstRun(storage: StorageAdapter = getStorage()): Promise<void> {
  try {
    if (await storage.getPersistence()) return;
    const granted = (await navigator.storage?.persist?.()) ?? false;
    await storage.setPersistence({ requestedAt: new Date().toISOString(), granted });
  } catch {
    // Not available (e.g. private browsing): nothing to retain, and we will simply ask again next time.
  }
}
