// The StorageAdapter: the only way the UI and the practice flow reach learner data. v1 implements it
// with IndexedDB (idb.ts); a future implementation can talk to a database API. Everything it stores is
// plain JSON, so the same shapes serve the backup file (ticket 13) and a future API.
import type { Session } from '../practice/session.ts';

/** Bump when the stored shape changes, and add the step to migrations.ts. */
export const SCHEMA_VERSION = 3;

export interface ProfileSettings {
  shuffle: boolean;
  /** Offer a break every N marks; 0 is off. */
  breakEvery: 0 | 5 | 10 | 15;
  sounds: boolean;
  /** How fast stroke order practice draws each stroke. */
  strokeSpeed: 'slow' | 'normal' | 'fast';
  /** Seconds stroke order practice waits after each stroke, so the child can copy it. */
  strokePauseSeconds: 0.5 | 1 | 2 | 3;
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  shuffle: true,
  breakEvery: 10,
  sounds: true,
  strokeSpeed: 'normal',
  strokePauseSeconds: 3,
};

export interface Profile {
  /** UUID. */
  id: string;
  name: string;
  /** Emoji avatar. */
  avatar: string;
  /** ISO-8601. */
  createdAt: string;
  settings: ProfileSettings;
  assignedLessonIds: string[];
}

export interface ParentMetadata {
  /** ISO-8601 time of the last backup export (ticket 13). */
  lastBackupAt?: string;
}

export interface AppRecord {
  schemaVersion: number;
  profiles: Profile[];
  /** Null until the first profile is created (first-run set-up). */
  activeProfileId: string | null;
  parent: ParentMetadata;
}

export interface SessionFilter {
  lessonId?: string;
  practiceType?: Session['practiceType'];
  status?: Session['status'];
}

/** Everything a backup holds (ticket 13 wraps it with an app identifier, a kind marker and a timestamp). */
export interface StoredData {
  app: AppRecord;
  sessions: Session[];
}

/** Result of asking the browser not to evict our storage. Device-specific: never exported or imported. */
export interface PersistenceStatus {
  /** ISO-8601. */
  requestedAt: string;
  granted: boolean;
}

export interface StorageAdapter {
  /** The app record; a fresh default one when nothing has been saved yet. Runs migrations. */
  loadApp(): Promise<AppRecord>;
  saveApp(app: AppRecord): Promise<void>;

  getSession(id: string): Promise<Session | undefined>;
  /** A profile's sessions, oldest first, optionally narrowed to one lesson, practice type and/or status. */
  listSessions(profileId: string, filter?: SessionFilter): Promise<Session[]>;
  /** Insert or replace, stamping the saved copy's `updatedAt` with the save time. Resolves, with the session as saved, only once the write is durable. */
  putSession(session: Session): Promise<Session>;
  deleteSessionsByProfile(profileId: string): Promise<void>;

  /** Everything the backup holds. */
  exportAll(): Promise<StoredData>;
  /** Replace everything with `data` (migrated first). Throws NewerSchemaError for data from a newer app. */
  importAll(data: StoredData): Promise<void>;

  /** The persistent-storage request result, kept for display in the parent area (ticket 13). */
  getPersistence(): Promise<PersistenceStatus | undefined>;
  setPersistence(status: PersistenceStatus): Promise<void>;
}

/** Saved data (or a backup) comes from a newer version of the app than this one. */
export class NewerSchemaError extends Error {
  constructor(readonly found: number) {
    super(`Saved data has schema version ${found}, newer than this app supports (${SCHEMA_VERSION}).`);
    this.name = 'NewerSchemaError';
  }
}

export function defaultAppRecord(): AppRecord {
  return { schemaVersion: SCHEMA_VERSION, profiles: [], activeProfileId: null, parent: {} };
}
