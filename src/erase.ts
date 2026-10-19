// Erasing learner data. Both are destructive and final; the UI puts confirmations in front of them
// (parent/sections/danger-zone.tsx).
import { defaultAppRecord, type StorageAdapter } from './storage/types.ts';

/** Delete one learner's sessions. The profile (name, avatar, settings, assigned lists) stays; other learners are untouched. */
export function eraseLearnerProgress(storage: StorageAdapter, profileId: string): Promise<void> {
  return storage.deleteSessionsByProfile(profileId);
}

/**
 * Remove every profile and every session, leaving what a brand-new device holds (the app returns to
 * first run). Device-local facts, such as the persistent-storage answer, are not learner data and stay.
 */
export function eraseEverything(storage: StorageAdapter): Promise<void> {
  return storage.importAll({ app: defaultAppRecord(), sessions: [] });
}
