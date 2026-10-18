// Ordered schema migrations, run on load (and on import): version N -> N+1. Version 1 is the first
// schema, so there are no steps yet. To change the stored shape: bump SCHEMA_VERSION in types.ts, add
// `{ from: N, up }` here that returns the data at version N+1 (stamping `app.schemaVersion`), and
// add a saved-data fixture for the old version to the Seam 1 resume tests.
import { NewerSchemaError, SCHEMA_VERSION, type StoredData } from './types.ts';

export interface Migration {
  /** Version this step upgrades from; it produces `from + 1`. */
  from: number;
  up(data: StoredData): StoredData;
}

export const MIGRATIONS: readonly Migration[] = [];

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
