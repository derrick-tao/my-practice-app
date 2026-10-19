// The IndexedDB implementation of StorageAdapter. Layout (version 1 of the database):
//   store `meta`     out-of-line keys: 'app' -> AppRecord, 'device' -> PersistenceStatus
//   store `sessions` keyPath `id`, index `profileId`
// Every write resolves only after its transaction completes, so a resolved write is on disk.
import type { Session } from '../practice/session.ts';
import { migrate } from './migrations.ts';
import {
  defaultAppRecord,
  SCHEMA_VERSION,
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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
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

/**
 * Data saved before the app stamped a version has no app record. It was written by the first schema,
 * so it is migrated from there rather than assumed to be current.
 */
const UNSTAMPED_SCHEMA_VERSION = 1;

export function createIdbStorage(): StorageAdapter {
  let opened: Promise<IDBDatabase> | undefined;
  let prepared: Promise<IDBDatabase> | undefined;
  // A failed open is not cached, so the next call (a retry) tries again.
  const rawDatabase = (): Promise<IDBDatabase> => {
    opened ??= openDatabase().catch((error: unknown) => {
      opened = undefined;
      throw error;
    });
    return opened;
  };
  /**
   * The database once it is up to date: the app record exists (so the schema version is always on the
   * device) and stored data is migrated. The check runs once per adapter; every operation but
   * importAll goes through here, so none can see unmigrated data or write over data from a newer app.
   */
  const database = (): Promise<IDBDatabase> => {
    prepared ??= rawDatabase()
      .then(async (db) => (await prepare(db), db))
      .catch((error: unknown) => {
        prepared = undefined;
        throw error;
      });
    return prepared;
  };

  async function readAll(db: IDBDatabase): Promise<{ app: AppRecord | undefined; sessions: Session[] }> {
    const tx = db.transaction([META, SESSIONS], 'readonly');
    const [app, sessions] = await Promise.all([
      request<AppRecord | undefined>(tx.objectStore(META).get(APP_KEY)),
      request<Session[]>(tx.objectStore(SESSIONS).getAll()),
    ]);
    return { app, sessions };
  }

  async function replaceAll(db: IDBDatabase, data: StoredData): Promise<void> {
    const tx = db.transaction([META, SESSIONS], 'readwrite');
    const done = finished(tx);
    tx.objectStore(META).put(data.app, APP_KEY);
    const sessions = tx.objectStore(SESSIONS);
    sessions.clear();
    for (const session of data.sessions) sessions.put(session);
    await done;
  }

  async function prepare(db: IDBDatabase): Promise<void> {
    const { app, sessions } = await readAll(db);
    const stored: StoredData = {
      app: app ?? { ...defaultAppRecord(), schemaVersion: sessions.length > 0 ? UNSTAMPED_SCHEMA_VERSION : SCHEMA_VERSION },
      sessions,
    };
    const migrated = migrate(stored);
    if (!app || migrated !== stored) await replaceAll(db, migrated);
  }

  return {
    async loadApp() {
      const db = await database();
      return (await request<AppRecord | undefined>(db.transaction(META, 'readonly').objectStore(META).get(APP_KEY)))!;
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
            (filter.lessonId === undefined || s.lessonId === filter.lessonId) &&
            (filter.practiceType === undefined || s.practiceType === filter.practiceType) &&
            (filter.status === undefined || s.status === filter.status),
        )
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    },

    async putSession(session) {
      const db = await database();
      const tx = db.transaction(SESSIONS, 'readwrite');
      const done = finished(tx);
      const stamped = { ...session, updatedAt: new Date().toISOString() };
      tx.objectStore(SESSIONS).put(stamped);
      await done;
      return stamped;
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

    async exportAll() {
      const { app, sessions } = await readAll(await database());
      return { app: app!, sessions };
    },

    async importAll(data) {
      await replaceAll(await rawDatabase(), migrate(data));
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
