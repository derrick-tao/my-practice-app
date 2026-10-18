// The IndexedDB implementation of StorageAdapter. Layout (version 1 of the database):
//   store `meta`     out-of-line keys: 'app' -> AppRecord, 'device' -> PersistenceStatus
//   store `sessions` keyPath `id`, index `profileId`
// Every write resolves only after its transaction completes, so a resolved write is on disk.
import type { Session } from '../practice/session.ts';
import { migrate } from './migrations.ts';
import {
  defaultAppRecord,
  type AppRecord,
  type PersistenceStatus,
  type SessionFilter,
  type StorageAdapter,
  type StoredData,
} from './types.ts';

export const DB_NAME = 'my-practice-app';
const DB_VERSION = 1;
const META = 'meta';
const SESSIONS = 'sessions';
const APP_KEY = 'app';
const DEVICE_KEY = 'device';

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });

const finished = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      db.createObjectStore(META);
      db.createObjectStore(SESSIONS, { keyPath: 'id' }).createIndex('profileId', 'profileId');
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('Could not open IndexedDB'));
    open.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
  });
}

export function createIdbStorage(factory: IDBFactory = indexedDB): StorageAdapter {
  let opened: Promise<IDBDatabase> | undefined;
  const database = (): Promise<IDBDatabase> => {
    // A failed open is not cached, so the next call (a retry) tries again.
    opened ??= openDatabase(factory).catch((error: unknown) => {
      opened = undefined;
      throw error;
    });
    return opened;
  };

  async function readAll(): Promise<{ app: AppRecord | undefined; sessions: Session[] }> {
    const db = await database();
    const tx = db.transaction([META, SESSIONS], 'readonly');
    const [app, sessions] = await Promise.all([
      request<AppRecord | undefined>(tx.objectStore(META).get(APP_KEY)),
      request<Session[]>(tx.objectStore(SESSIONS).getAll()),
    ]);
    return { app, sessions };
  }

  async function replaceAll(data: StoredData): Promise<void> {
    const db = await database();
    const tx = db.transaction([META, SESSIONS], 'readwrite');
    const done = finished(tx);
    tx.objectStore(META).put(data.app, APP_KEY);
    const sessions = tx.objectStore(SESSIONS);
    sessions.clear();
    for (const session of data.sessions) sessions.put(session);
    await done;
  }

  async function loadStored(): Promise<StoredData> {
    const { app, sessions } = await readAll();
    if (!app) return { app: defaultAppRecord(), sessions };
    const data = { app, sessions };
    const migrated = migrate(data);
    if (migrated !== data) await replaceAll(migrated);
    return migrated;
  }

  return {
    async loadApp() {
      return (await loadStored()).app;
    },

    async saveApp(app) {
      const db = await database();
      const tx = db.transaction(META, 'readwrite');
      const done = finished(tx);
      tx.objectStore(META).put(app, APP_KEY);
      await done;
    },

    async getSession(id) {
      const db = await database();
      return request<Session | undefined>(db.transaction(SESSIONS, 'readonly').objectStore(SESSIONS).get(id));
    },

    async listSessions(profileId, filter: SessionFilter = {}) {
      const db = await database();
      const all = await request<Session[]>(
        db.transaction(SESSIONS, 'readonly').objectStore(SESSIONS).index('profileId').getAll(profileId),
      );
      return all
        .filter(
          (s) =>
            (filter.listId === undefined || s.listId === filter.listId) &&
            (filter.status === undefined || s.status === filter.status),
        )
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    },

    async putSession(session) {
      const db = await database();
      const tx = db.transaction(SESSIONS, 'readwrite');
      const done = finished(tx);
      tx.objectStore(SESSIONS).put(session);
      await done;
    },

    async deleteSessionsByProfile(profileId) {
      const db = await database();
      const tx = db.transaction(SESSIONS, 'readwrite');
      const done = finished(tx);
      const store = tx.objectStore(SESSIONS);
      const keys = await request<IDBValidKey[]>(store.index('profileId').getAllKeys(profileId));
      for (const key of keys) store.delete(key);
      await done;
    },

    exportAll: loadStored,

    async importAll(data) {
      await replaceAll(migrate(data));
    },

    async getPersistence() {
      const db = await database();
      return request<PersistenceStatus | undefined>(db.transaction(META, 'readonly').objectStore(META).get(DEVICE_KEY));
    },

    async setPersistence(status) {
      const db = await database();
      const tx = db.transaction(META, 'readwrite');
      const done = finished(tx);
      tx.objectStore(META).put(status, DEVICE_KEY);
      await done;
    },
  };
}
