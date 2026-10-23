// Finding and (re)opening the learner's sessions through the StorageAdapter.
import { isListType, isRulesType, type LessonData, type PracticeTypeId } from '../content/types.ts';
import { activeProfileOf } from '../profiles.ts';
import { DEFAULT_SETTINGS, type ProfileSettings, type StorageAdapter } from '../storage/types.ts';
import type { ProblemCount } from '../math/rules.ts';
import { createMathSession, settleSavedTries } from './math-session.ts';
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

/** When the session was last worked on (`updatedAt`; its start for a session saved without one). */
const lastUsedAt = (session: Session): string => session.updatedAt || session.startedAt;

/** The more recently used of two sessions (the later in the list when tied). */
const moreRecentlyUsed = (a: Session, b: Session): Session => (lastUsedAt(a) > lastUsedAt(b) ? a : b);

/**
 * The profile's sessions in progress, most recently used (`updatedAt`) first. There is at most one per
 * lesson and practice type; if data ever holds several for the same list, the most recently used wins.
 */
export async function findSessionsInProgress(storage: StorageAdapter): Promise<Session[]> {
  const active = await storage.listSessions(await currentProfileId(storage), { status: 'active' });
  const newestPerList = new Map<string, Session>();
  for (const session of active) {
    const key = `${session.lessonId}/${session.practiceType}`;
    const best = newestPerList.get(key);
    newestPerList.set(key, best ? moreRecentlyUsed(best, session) : session);
  }
  return [...newestPerList.values()].sort((a, b) => lastUsedAt(b).localeCompare(lastUsedAt(a)));
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

/** Stop every session in progress of one lesson for a profile (any practice type), keeping them all in history. Other lessons and profiles are untouched. */
export async function stopLessonSessions(storage: StorageAdapter, profileId: string, lessonId: string): Promise<void> {
  for (const session of await storage.listSessions(profileId, { lessonId, status: 'active' })) await stopSession(storage, session);
}

/**
 * Open a lesson's list for one practice type: continue its session in progress, or start a new one. Other
 * lists' sessions are never touched. Whatever is returned is saved first, so nothing is on screen that is
 * not on disk (and a continued session is saved again, which makes it the most recently used).
 * `learning` and `problemCount` (the profile's learning and problems-per-practice settings) only decide what a NEW session is; a continued one stays as it started.
 *
 * A lesson that no longer offers the practice type counts as having lost every item: its saved session
 * (reconciled per list, like any edit) is stopped. With no saved session either there is nothing to open
 * and `undefined` comes back.
 */
export async function openSession(
  storage: StorageAdapter,
  lesson: Pick<LessonData, 'id' | 'subject' | 'lists' | 'rules'>,
  options: { practiceType: PracticeTypeId; contentVersion: string; shuffle: boolean; learning: boolean; problemCount: ProblemCount },
  env: PracticeEnv,
): Promise<OpenedSession | undefined> {
  const profileId = await currentProfileId(storage);
  const saved = (
    await storage.listSessions(profileId, { lessonId: lesson.id, practiceType: options.practiceType, status: 'active' })
  ).reduce<Session | undefined>((best, session) => (best ? moreRecentlyUsed(best, session) : session), undefined);
  if (isRulesType(options.practiceType)) {
    // A math session holds generated problems, not a list: there is nothing to reconcile with the lesson, and a
    // saved session carries the rules it started with. Only a lesson that dropped the practice type stops it.
    const offered = lesson.rules?.[options.practiceType] !== undefined;
    if (saved) {
      const kept = offered ? settleSavedTries(saved, env) : { ...saved, status: 'stopped' as const, undo: null };
      return { session: await storage.putSession(kept), resumed: true };
    }
    if (!offered) return undefined;
    const session = createMathSession(lesson, { ...options, practiceType: options.practiceType, profileId }, env);
    return { session: await storage.putSession(session), resumed: false };
  }
  const items = isListType(options.practiceType) ? lesson.lists[options.practiceType] : undefined;
  if (saved) {
    // Reconcile with the lesson as it is now (the parent may have edited it since the session was saved).
    const settled = reconcileWithList(saved, new Set((items ?? []).map((item) => item.target)), env);
    return { session: await storage.putSession(settled), resumed: true };
  }
  if (!items) return undefined;
  const session = createSession(lesson, { ...options, profileId }, env);
  return { session: await storage.putSession(session), resumed: false };
}
