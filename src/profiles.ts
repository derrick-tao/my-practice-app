// Learner profiles and their assigned lists, on top of the StorageAdapter's app record. Names and
// avatars live only in the on-device app record (and backup files): nothing here touches the network.
import { DEFAULT_PROFILE_ID } from './practice/session.ts';
import { getStorage } from './storage/index.ts';
import type { AppRecord, Profile, StorageAdapter } from './storage/types.ts';
import { DEFAULT_SETTINGS } from './storage/types.ts';

/** Emoji a grown-up can pick as a learner's avatar. */
export const AVATARS = ['🐼', '🦊', '🐯', '🐰', '🐸', '🦁', '🐵', '🐶', '🐱', '🦄', '🐧', '🐙'] as const;

export const NAME_MAX_LENGTH = 30;

/** The profile the child is practicing as, if any profile exists yet. */
export function activeProfileOf(app: AppRecord): Profile | undefined {
  return app.profiles.find((p) => p.id === app.activeProfileId) ?? app.profiles[0];
}

export interface NewProfile {
  name: string;
  avatar: string;
  assignedListIds: string[];
}

/** Pure: the app record with one more profile. The first profile becomes the active one. */
export function addProfile(app: AppRecord, input: NewProfile, id: string, now: string): AppRecord {
  const profile: Profile = {
    id,
    name: input.name.trim(),
    avatar: input.avatar,
    createdAt: now,
    settings: { ...DEFAULT_SETTINGS },
    assignedListIds: [...input.assignedListIds],
  };
  return { ...app, profiles: [...app.profiles, profile], activeProfileId: app.activeProfileId ?? id };
}

/** Pure: assign or unassign one list for one profile. */
export function setListAssigned(app: AppRecord, profileId: string, listId: string, assigned: boolean): AppRecord {
  return {
    ...app,
    profiles: app.profiles.map((p) => {
      if (p.id !== profileId) return p;
      const rest = p.assignedListIds.filter((id) => id !== listId);
      return { ...p, assignedListIds: assigned ? [...rest, listId] : rest };
    }),
  };
}

/**
 * Practice saved before profiles existed belongs to the implicit default profile; it becomes the first
 * real profile's. Safe to run any time (it only acts while such sessions exist), so a crash between
 * creating the profile and moving its sessions is repaired on the next load.
 */
export async function adoptLegacySessions(storage: StorageAdapter, app: AppRecord): Promise<void> {
  const first = app.profiles[0];
  if (!first) return;
  for (const session of await storage.listSessions(DEFAULT_PROFILE_ID)) {
    await storage.putSession({ ...session, profileId: first.id });
  }
}

/** Load the app record. Legacy sessions are adopted by the first profile on the way. */
export async function loadAppRecord(storage: StorageAdapter = getStorage()): Promise<AppRecord> {
  const app = await storage.loadApp();
  try {
    await adoptLegacySessions(storage, app);
  } catch {
    // Not fatal: they stay where they are and are adopted the next time the app loads.
  }
  return app;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Change the app record: read the latest, apply `change`, save. Changes run one after another, so two
 * quick taps cannot overwrite each other. Resolves with what was saved; rejects if the save fails
 * (the record is then unchanged).
 */
export function updateApp(
  change: (app: AppRecord) => AppRecord,
  storage: StorageAdapter = getStorage(),
): Promise<AppRecord> {
  const run = async (): Promise<AppRecord> => {
    const next = change(await storage.loadApp());
    await storage.saveApp(next);
    await adoptLegacySessions(storage, next).catch(() => undefined);
    return next;
  };
  const result = queue.then(run);
  queue = result.catch(() => undefined);
  return result;
}
