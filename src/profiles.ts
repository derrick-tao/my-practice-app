// Learner profiles and their assigned lessons, on top of the StorageAdapter's app record. Names and
// avatars live only in the on-device app record (and backup files): nothing here touches the network.
import { DEFAULT_PROFILE_ID } from './practice/session.ts';
import { getStorage } from './storage/index.ts';
import type { AppRecord, Profile, ProfileSettings, StorageAdapter } from './storage/types.ts';
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
  assignedLessonIds: string[];
}

/** Pure: the app record with one more profile. The first profile becomes the active one. */
export function addProfile(app: AppRecord, input: NewProfile, id: string, now: string): AppRecord {
  const profile: Profile = {
    id,
    name: input.name.trim(),
    avatar: input.avatar,
    createdAt: now,
    settings: { ...DEFAULT_SETTINGS },
    assignedLessonIds: [...input.assignedLessonIds],
  };
  return { ...app, profiles: [...app.profiles, profile], activeProfileId: app.activeProfileId ?? id };
}

/** Pure: assign or unassign one lesson for one profile. */
export function setLessonAssigned(app: AppRecord, profileId: string, lessonId: string, assigned: boolean): AppRecord {
  return {
    ...app,
    profiles: app.profiles.map((p) => {
      if (p.id !== profileId) return p;
      const rest = p.assignedLessonIds.filter((id) => id !== lessonId);
      return { ...p, assignedLessonIds: assigned ? [...rest, lessonId] : rest };
    }),
  };
}

/** Pure: rename a profile and/or change its avatar. */
export function editProfile(app: AppRecord, profileId: string, input: { name: string; avatar: string }): AppRecord {
  return {
    ...app,
    profiles: app.profiles.map((p) =>
      p.id === profileId ? { ...p, name: input.name.trim(), avatar: input.avatar } : p,
    ),
  };
}

/** Pure: make a profile the one the child practices as (unknown ids change nothing). */
export function setActiveProfile(app: AppRecord, profileId: string): AppRecord {
  return app.profiles.some((p) => p.id === profileId) ? { ...app, activeProfileId: profileId } : app;
}

/** Pure: the app record without a profile. If it was the active one, the first remaining profile is. */
export function removeProfile(app: AppRecord, profileId: string): AppRecord {
  const profiles = app.profiles.filter((p) => p.id !== profileId);
  const stillActive = profiles.some((p) => p.id === app.activeProfileId);
  return { ...app, profiles, activeProfileId: stillActive ? app.activeProfileId : (profiles[0]?.id ?? null) };
}

/** Pure: change some of one profile's settings. */
export function setSettings(app: AppRecord, profileId: string, change: Partial<ProfileSettings>): AppRecord {
  return {
    ...app,
    profiles: app.profiles.map((p) => (p.id === profileId ? { ...p, settings: { ...p.settings, ...change } } : p)),
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
