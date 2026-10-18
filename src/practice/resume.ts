// Finding and (re)opening the learner's session through the StorageAdapter.
import type { ListData, PracticeTypeId } from '../content/types.ts';
import type { StorageAdapter } from '../storage/types.ts';
import { createSession, DEFAULT_PROFILE_ID, skipUnknownItems, type PracticeEnv, type Session } from './session.ts';

/** The active profile's id, or the implicit default profile of sessions saved before profiles existed (the app never gets here without a profile; the first one adopts those sessions, see profiles.ts). */
export async function currentProfileId(storage: StorageAdapter): Promise<string> {
  return (await storage.loadApp()).activeProfileId ?? DEFAULT_PROFILE_ID;
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

/**
 * Open the list for practice: continue its active session, or start a new one. The new session is
 * saved before it is returned, so nothing is on screen that is not on disk. Starting a list while a
 * session on a different list is active stops that one (kept in history); ticket 09 puts the parent
 * gate and a confirmation in front of this.
 */
export async function openSession(
  storage: StorageAdapter,
  list: Pick<ListData, 'id' | 'subject' | 'items'>,
  options: { practiceType: PracticeTypeId; contentVersion: string; shuffle: boolean },
  env: PracticeEnv,
): Promise<OpenedSession> {
  const profileId = await currentProfileId(storage);
  const active = await activeSessionOf(storage, profileId);
  if (active && active.listId === list.id && active.practiceType === options.practiceType) {
    // A list edited since the session was saved may have dropped the item it was on.
    const settled = skipUnknownItems(active, new Set(list.items.map((item) => item.target)), env);
    if (settled !== active) await storage.putSession(settled);
    return { session: settled, resumed: true };
  }
  if (active) await storage.putSession({ ...active, status: 'stopped' });
  const session = createSession(list, { ...options, profileId }, env);
  await storage.putSession(session);
  return { session, resumed: false };
}
