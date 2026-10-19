// Finding and (re)opening the learner's session through the StorageAdapter.
import type { ListData, PracticeTypeId } from '../content/types.ts';
import { activeProfileOf } from '../profiles.ts';
import { DEFAULT_SETTINGS, type ProfileSettings, type StorageAdapter } from '../storage/types.ts';
import { createSession, DEFAULT_PROFILE_ID, reconcileWithList, type PracticeEnv, type Session } from './session.ts';

/** The active profile's id, or the implicit default profile of sessions saved before profiles existed (the app never gets here without a profile; the first one adopts those sessions, see profiles.ts). */
export async function currentProfileId(storage: StorageAdapter): Promise<string> {
  return (await storage.loadApp()).activeProfileId ?? DEFAULT_PROFILE_ID;
}

/** The active profile's settings (the defaults until a profile exists). */
export async function currentSettings(storage: StorageAdapter): Promise<ProfileSettings> {
  const app = await storage.loadApp();
  const profile = activeProfileOf(app);
  return { ...DEFAULT_SETTINGS, ...profile?.settings };
}

/** The profile's active session. There is at most one; if data ever holds several, the newest wins. */
export async function findActiveSession(storage: StorageAdapter): Promise<Session | undefined> {
  return activeSessionOf(storage, await currentProfileId(storage));
}

async function activeSessionOf(storage: StorageAdapter, profileId: string): Promise<Session | undefined> {
  return (await storage.listSessions(profileId, { status: 'active' })).at(-1);
}

export interface OpenedSession {
  session: Session;
  /** Continued from saved progress (so audio must not auto-play) rather than freshly started. */
  resumed: boolean;
}

/** Mark a session stopped: it stays in history, but is no longer the one to keep going with. */
export async function stopSession(storage: StorageAdapter, session: Session): Promise<void> {
  await storage.putSession({ ...session, status: 'stopped' });
}

/** Another list's session is active and the learner has not yet been through the "stop it?" check. */
export interface StopRequired {
  blockedBy: Session;
}

/**
 * Open the list for practice: continue its active session, or start a new one. The new session is
 * saved before it is returned, so nothing is on screen that is not on disk. Starting a list while a
 * session on a different list is active replaces it (the old one is kept in history as stopped), but
 * only once the caller has been through the confirmation and the parent gate (`stopActive`); until then
 * nothing is changed and `StopRequired` comes back.
 */
export async function openSession(
  storage: StorageAdapter,
  list: Pick<ListData, 'id' | 'subject' | 'items'>,
  options: { practiceType: PracticeTypeId; contentVersion: string; shuffle: boolean; stopActive?: boolean },
  env: PracticeEnv,
): Promise<OpenedSession | StopRequired> {
  const { stopActive = false, ...sessionOptions } = options;
  const profileId = await currentProfileId(storage);
  const active = await activeSessionOf(storage, profileId);
  if (active && active.listId === list.id && active.practiceType === options.practiceType) {
    // Reconcile with the list as it is now (the parent may have edited it since the session was saved).
    const settled = reconcileWithList(active, new Set(list.items.map((item) => item.target)), env);
    if (settled !== active) await storage.putSession(settled);
    return { session: settled, resumed: true };
  }
  if (active) {
    if (!stopActive) return { blockedBy: active };
    await stopSession(storage, active);
  }
  const session = createSession(list, { ...sessionOptions, profileId }, env);
  await storage.putSession(session);
  return { session, resumed: false };
}
