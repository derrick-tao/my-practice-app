// Ordered schema migrations, run on load (and on import): version N -> N+1. To change the stored shape:
// bump SCHEMA_VERSION in types.ts, add `{ from: N, up }` here that returns the data at version N+1
// (stamping `app.schemaVersion`), and add a saved-data fixture for the old version to the Seam 1 specs
// (tests/fixtures/saved-data, used by tests/e2e/saved-data-migration.spec.ts).
//
//   1 -> 2  lists became lessons: `assignedListIds` -> `assignedLessonIds`, a session's `listId` ->
//           `lessonId`, a round's phase `listening` -> `prompt`, and every session gets `updatedAt`.
import { NewerSchemaError, SCHEMA_VERSION, type StoredData } from './types.ts';

export interface Migration {
  /** Version this step upgrades from; it produces `from + 1`. */
  from: number;
  up(data: StoredData): StoredData;
}

/** Saved data as schema version 1 wrote it: the fields this migration renames, plus everything else untouched. */
type V1Profile = { assignedListIds?: string[]; [field: string]: unknown };
type V1Round = { phase?: string; startedAt?: string; completedAt?: string; [field: string]: unknown };
type V1Session = {
  listId?: string;
  startedAt: string;
  completedAt?: string;
  rounds?: V1Round[];
  [field: string]: unknown;
};

/** The latest moment the session is known to have been worked on: its completion, else its rounds, else its start. */
function latestKnownTime(session: V1Session): string {
  if (session.completedAt) return session.completedAt;
  const times = (session.rounds ?? [])
    .flatMap((round) => [round.startedAt, round.completedAt])
    .filter((time): time is string => !!time);
  return times.reduce((latest, time) => (time > latest ? time : latest), session.startedAt);
}

function listsBecameLessons(data: StoredData): StoredData {
  const profiles = (data.app.profiles as unknown as V1Profile[]).map(({ assignedListIds, ...profile }) => ({
    ...profile,
    assignedLessonIds: assignedListIds ?? [],
  }));
  const sessions = (data.sessions as unknown as V1Session[]).map(({ listId, ...session }) => ({
    ...session,
    lessonId: listId,
    updatedAt: latestKnownTime(session),
    rounds: (session.rounds ?? []).map((round) => ({
      ...round,
      phase: round.phase === 'listening' ? 'prompt' : round.phase,
    })),
  }));
  return {
    app: { ...data.app, schemaVersion: 2, profiles: profiles as unknown as StoredData['app']['profiles'] },
    sessions: sessions as unknown as StoredData['sessions'],
  };
}

export const MIGRATIONS: readonly Migration[] = [{ from: 1, up: listsBecameLessons }];

/**
 * Bring stored data up to SCHEMA_VERSION. Returns the same object when it is already current. Refuses data
 * from a newer schema (NewerSchemaError) and data from an older schema that has no migration path.
 */
export function migrate(data: StoredData): StoredData {
  let current = data;
  if (current.app.schemaVersion > SCHEMA_VERSION) throw new NewerSchemaError(current.app.schemaVersion);
  while (current.app.schemaVersion < SCHEMA_VERSION) {
    const version = current.app.schemaVersion;
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) throw new Error(`No migration from schema version ${version}.`);
    current = step.up(current);
    if (current.app.schemaVersion !== version + 1) {
      throw new Error(`Migration from schema version ${version} did not produce version ${version + 1}.`);
    }
  }
  return current;
}
