// The backup file: everything a grown-up can take off the device and bring back later. Pure and
// storage-free (the StorageAdapter reads and replaces the data; this only wraps, checks and describes it).
//
//   {
//     "appId": "my-practice-app",       which app wrote it
//     "kind": "backup",                 what sort of file it is (room for other kinds later)
//     "schemaVersion": 1,               the schema of `data` (same number as data.app.schemaVersion)
//     "exportedAt": "2026-10-18T12:00:00.000Z",
//     "data": { "app": <AppRecord>, "sessions": [<Session>, ...] }
//   }
//
// `data` is exactly what the StorageAdapter exports and imports, passed through untouched, so a field
// added to the app record or a session in a later ticket travels in a backup with no change here.
// Device-specific facts (the persistent-storage answer) are not part of the data.
import { SCHEMA_VERSION, type StoredData } from '../storage/types.ts';

export const BACKUP_APP_ID = 'my-practice-app';
export const BACKUP_KIND = 'backup';

export interface BackupFile {
  appId: typeof BACKUP_APP_ID;
  kind: typeof BACKUP_KIND;
  schemaVersion: number;
  /** ISO-8601. */
  exportedAt: string;
  data: StoredData;
}

export function createBackup(data: StoredData, exportedAt: Date): BackupFile {
  return {
    appId: BACKUP_APP_ID,
    kind: BACKUP_KIND,
    schemaVersion: data.app.schemaVersion,
    exportedAt: exportedAt.toISOString(),
    data,
  };
}

/** `my-practice-app-backup-2026-10-18.json`: the export date as the grown-up's own calendar shows it. */
export function backupFileName(exportedAt: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const date = `${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}`;
  return `${BACKUP_APP_ID}-backup-${date}.json`;
}

export type BackupCheck =
  | { ok: true; backup: BackupFile }
  | { ok: false; reason: 'malformed' | 'newer'; message: string };

const MALFORMED = "That file isn't a backup made by this app, so nothing was changed.";
const NEWER =
  'That backup was made by a newer version of this app, so nothing was changed. Update the app, then try again.';

const malformed = (): BackupCheck => ({ ok: false, reason: 'malformed', message: MALFORMED });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isDate = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value));

/** Is `text` a backup this app can restore? Rejects anything else, naming the reason in plain words. */
export function checkBackup(text: string): BackupCheck {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return malformed();
  }
  if (!isObject(file) || file.appId !== BACKUP_APP_ID || file.kind !== BACKUP_KIND) return malformed();
  const { schemaVersion, exportedAt, data } = file;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) return malformed();
  if (!isDate(exportedAt)) return malformed();
  // A newer app may have changed the shape of `data`, so decide on the version before looking inside.
  if (schemaVersion > SCHEMA_VERSION) return { ok: false, reason: 'newer', message: NEWER };

  if (!isObject(data) || !isObject(data.app) || !Array.isArray(data.sessions)) return malformed();
  const { app, sessions } = data;
  if (app.schemaVersion !== schemaVersion) return malformed();
  if (!Array.isArray(app.profiles) || !(app.activeProfileId === null || isString(app.activeProfileId))) return malformed();
  if (!isObject(app.parent)) return malformed();
  if (!app.profiles.every((p) => isObject(p) && isString(p.id) && isString(p.name))) return malformed();
  const sessionsOk = sessions.every(
    (s) =>
      isObject(s) &&
      isString(s.id) &&
      isString(s.profileId) &&
      isString(s.listId) &&
      isDate(s.startedAt) &&
      Array.isArray(s.rounds),
  );
  if (!sessionsOk) return malformed();

  return { ok: true, backup: file as unknown as BackupFile };
}

export interface BackupSummary {
  learners: number;
  attempts: number;
  /** ISO-8601 of the most recent practice in the backup; undefined when there is none. */
  lastUsed?: string;
  /** ISO-8601: when the backup was made. */
  exportedAt: string;
}

/** What the grown-up sees before confirming: how much is in the file and how recent it is. */
export function summarizeBackup(backup: BackupFile): BackupSummary {
  const { app, sessions } = backup.data;
  const times = sessions
    .flatMap((s) => [s.startedAt, s.completedAt, ...s.rounds.flatMap((r) => [r.startedAt, r.completedAt])])
    .filter((t): t is string => isDate(t))
    .map((t) => Date.parse(t));
  return {
    learners: app.profiles.length,
    attempts: sessions.length,
    lastUsed: times.length > 0 ? new Date(Math.max(...times)).toISOString() : undefined,
    exportedAt: backup.exportedAt,
  };
}

/**
 * The data to put on the device: the backup's, with the last-backup time taken from the file (the
 * backup the grown-up just restored is the most recent one they have).
 */
export function dataToRestore(backup: BackupFile): StoredData {
  const { app, sessions } = backup.data;
  return { app: { ...app, parent: { ...app.parent, lastBackupAt: backup.exportedAt } }, sessions };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A backup older than this earns a reminder. */
export const NUDGE_AFTER_DAYS = 7;

export interface BackupAge {
  /** Whole days since the last backup, never negative; undefined when there has never been one. */
  days?: number;
  /** Time to back up again: no backup yet, or the last one is more than a week old. */
  nudge: boolean;
}

export function backupAge(lastBackupAt: string | undefined, now: Date): BackupAge {
  if (!lastBackupAt || !isDate(lastBackupAt)) return { nudge: true };
  const elapsed = now.getTime() - Date.parse(lastBackupAt);
  return { days: Math.max(0, Math.floor(elapsed / DAY_MS)), nudge: elapsed > NUDGE_AFTER_DAYS * DAY_MS };
}

export function describeBackupAge(age: BackupAge): string {
  if (age.days === undefined) return 'never';
  if (age.days === 0) return 'today';
  return age.days === 1 ? '1 day ago' : `${age.days} days ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
