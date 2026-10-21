// The backup file: everything a grown-up can take off the device and bring back later. Pure and
// storage-free (the StorageAdapter reads and replaces the data; this only wraps, checks and describes it).
//
//   {
//     "appId": "my-practice-app",       which app wrote it
//     "kind": "backup",                 what sort of file it is (room for other kinds later)
//     "schemaVersion": 5,             the schema of `data` (same number as data.app.schemaVersion)
//     "exportedAt": "2026-10-18T12:00:00.000Z",
//     "data": { "app": <AppRecord>, "sessions": [<Session>, ...] }
//   }
//
// `data` is exactly what the StorageAdapter exports and imports, passed through untouched, so a field
// added to the app record or a session in a later ticket travels in a backup with no change here.
// Device-specific facts (the persistent-storage answer) are not part of the data.
//
// A file written by an older schema is accepted: checkBackup migrates its data to the current schema
// (src/storage/migrations.ts) before checking it, so everything after that sees one shape.
import { isPracticeTypeId, isRulesType, type PracticeTypeId } from '../content/types.ts';
import { MAX_STEPS, MAX_TRIES } from '../math/problem.ts';
import { isOperation, MAX_WITHIN, MIN_WITHIN } from '../math/rules.ts';
import { migrate } from '../storage/migrations.ts';
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

const isNonNegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isMark = (value: unknown): boolean => value === 'correct' || value === 'wrong';
const isOptionalDate = (value: unknown): boolean => value === undefined || isDate(value);

// The shapes below are checked down to the fields the app reads without looking, so a restored file can
// never leave the app holding a profile or attempt it would crash on (an attempt with no rounds, say).

function isProfile(value: unknown): boolean {
  if (!isObject(value) || !isString(value.id) || !isString(value.name) || !isString(value.avatar)) return false;
  const { settings, assignedLessonIds } = value;
  return (
    isObject(settings) &&
    typeof settings.shuffle === 'boolean' &&
    typeof settings.sounds === 'boolean' &&
    [0, 5, 10, 15].includes(settings.breakEvery as number) &&
    ['slow', 'normal', 'fast'].includes(settings.strokeSpeed as string) &&
    [0.5, 1, 2, 3].includes(settings.strokePauseSeconds as number) &&
    typeof settings.learning === 'boolean' &&
    Array.isArray(assignedLessonIds) &&
    assignedLessonIds.every(isString)
  );
}

/** A problem's numbers are whole numbers, and not always positive: true or false saves `7 = 8 - 1` as [7, 8, -1]. */
const isWholeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

const isProblem = (value: unknown): boolean =>
  isObject(value) &&
  isString(value.kind) &&
  Array.isArray(value.numbers) &&
  value.numbers.every(isWholeNumber) &&
  [value.name, value.friend, value.object].every((text) => text === undefined || isString(text));

const isTry = (value: unknown): boolean =>
  isObject(value) &&
  isString(value.answer) &&
  typeof value.correct === 'boolean' &&
  (value.step === undefined || (isNonNegativeInteger(value.step) && value.step < MAX_STEPS));

/** A math round's problems (one per spot) and tries (at most two per step of a spot), when it has them. */
function hasValidMathFields(round: Record<string, unknown>): boolean {
  const { problems, tries } = round;
  return (
    (problems === undefined || (isObject(problems) && Object.values(problems).every(isProblem))) &&
    (tries === undefined ||
      (isObject(tries) && Object.values(tries).every((spot) => Array.isArray(spot) && spot.length <= MAX_TRIES * MAX_STEPS && spot.every(isTry))))
  );
}

const isRules = (value: unknown): boolean =>
  isObject(value) &&
  isNonNegativeInteger(value.within) &&
  value.within >= MIN_WITHIN &&
  value.within <= MAX_WITHIN &&
  Array.isArray(value.operations) &&
  value.operations.length > 0 &&
  value.operations.every(isOperation);

function isRound(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { itemIds, marks } = value;
  return (
    isNonNegativeInteger(value.index) &&
    Array.isArray(itemIds) &&
    itemIds.every(isString) &&
    isNonNegativeInteger(value.position) &&
    value.position <= itemIds.length &&
    (value.phase === 'prompt' || value.phase === 'revealed') &&
    typeof value.heardCurrent === 'boolean' &&
    isObject(marks) &&
    Object.values(marks).every(isMark) &&
    isDate(value.startedAt) &&
    isOptionalDate(value.completedAt) &&
    hasValidMathFields(value)
  );
}

function isUndoEntry(value: unknown): boolean {
  return (
    value === null ||
    (isObject(value) &&
      isNonNegativeInteger(value.roundIndex) &&
      isString(value.itemId) &&
      isNonNegativeInteger(value.position) &&
      (value.previousMark === undefined || isMark(value.previousMark)))
  );
}

/** A math session names its rules, and every spot of every round has the problem to show there. */
function isMathSession(value: Record<string, unknown>): boolean {
  return (
    isRules(value.mathRules) &&
    (value.rounds as Array<Record<string, unknown>>).every((round) => {
      const problems = round.problems;
      return isObject(problems) && (round.itemIds as string[]).every((id) => id in problems);
    })
  );
}

function isSession(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isString(value.id) &&
    isString(value.profileId) &&
    isString(value.subject) &&
    isString(value.lessonId) &&
    isString(value.contentVersion) &&
    isString(value.practiceType) &&
    isPracticeTypeId(value.practiceType) &&
    (value.status === 'active' || value.status === 'completed' || value.status === 'stopped') &&
    isDate(value.startedAt) &&
    isOptionalDate(value.completedAt) &&
    isDate(value.updatedAt) &&
    Array.isArray(value.rounds) &&
    value.rounds.length > 0 &&
    value.rounds.every(isRound) &&
    isUndoEntry(value.undo) &&
    isNonNegativeInteger(value.marksSinceBreak) &&
    (value.learning === undefined || value.learning === true) &&
    (value.mathRules === undefined || isRules(value.mathRules)) &&
    (!isRulesType(value.practiceType as PracticeTypeId) || isMathSession(value))
  );
}

/**
 * Is `text` a backup this app can restore? Rejects anything else, naming the reason in plain words. A backup
 * from an older schema comes back migrated to the current one (so `backup.schemaVersion` is the current version).
 */
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

  let current: StoredData;
  try {
    current = migrate({ app, sessions } as unknown as StoredData);
  } catch {
    return malformed();
  }
  if (!current.app.profiles.every(isProfile)) return malformed();
  if (!current.sessions.every(isSession)) return malformed();

  return { ok: true, backup: { ...(file as unknown as BackupFile), schemaVersion: SCHEMA_VERSION, data: current } };
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
