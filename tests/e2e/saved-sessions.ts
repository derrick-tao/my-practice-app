// Seam 1 helpers that read (and, for "another learner", add to) what is saved on the device directly.
// There is no screen for these yet: the progress page is ticket 11 and the backup file is ticket 13.
// Once 13 lands, replace them with an export/import round trip (see ticket 05's comments).
import type { Page } from '@playwright/test';

export interface SavedSession {
  id: string;
  profileId: string;
  listId: string;
  status: 'active' | 'completed' | 'stopped';
  startedAt: string;
  rounds: Array<{ index: number; position: number; itemIds: string[] }>;
}

interface SavedApp {
  profiles: Array<{ id: string; name: string }>;
  activeProfileId: string | null;
}

/** Every saved session on the device, oldest first. */
export async function savedSessions(page: Page): Promise<SavedSession[]> {
  const sessions = await page.evaluate(
    () =>
      new Promise<SavedSession[]>((resolve, reject) => {
        const open = indexedDB.open('my-practice-app', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('sessions', 'readonly').objectStore('sessions').getAll();
          get.onsuccess = () => (db.close(), resolve(get.result as SavedSession[]));
          get.onerror = () => reject(get.error);
        };
      }),
  );
  return sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** The saved app record (profiles and which one is active). */
export async function savedApp(page: Page): Promise<SavedApp> {
  return page.evaluate(
    () =>
      new Promise<SavedApp>((resolve, reject) => {
        const open = indexedDB.open('my-practice-app', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('meta', 'readonly').objectStore('meta').get('app');
          get.onsuccess = () => (db.close(), resolve(get.result as SavedApp));
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

export const OTHER_LEARNER = { id: 'other-learner-id', name: 'Leo' } as const;

/**
 * Add a second learner (not the active one) with one saved practice, as profiles from ticket 08 would
 * leave behind. Call it once the first learner is set up, then reload.
 */
export async function addOtherLearner(page: Page): Promise<void> {
  await page.evaluate(
    (other) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('my-practice-app', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['meta', 'sessions'], 'readwrite');
          const meta = tx.objectStore('meta');
          const get = meta.get('app');
          get.onsuccess = () => {
            const app = get.result;
            app.profiles.push({
              id: other.id,
              name: other.name,
              avatar: '🦊',
              createdAt: '2026-10-01T09:00:00.000Z',
              settings: { shuffle: true, breakEvery: 10, sounds: true },
              assignedListIds: ['fixture-three'],
            });
            meta.put(app, 'app');
            tx.objectStore('sessions').put({
              id: 'other-learner-session',
              profileId: other.id,
              subject: 'chinese',
              practiceType: 'dictation',
              listId: 'fixture-three',
              contentVersion: 'saved-before',
              status: 'completed',
              startedAt: '2026-10-01T09:00:00.000Z',
              completedAt: '2026-10-01T09:01:00.000Z',
              rounds: [
                {
                  index: 1,
                  itemIds: ['点', '分', '找'],
                  position: 3,
                  phase: 'listening',
                  heardCurrent: false,
                  marks: { 点: 'correct', 分: 'correct', 找: 'correct' },
                  startedAt: '2026-10-01T09:00:00.000Z',
                  completedAt: '2026-10-01T09:01:00.000Z',
                },
              ],
              undo: null,
              marksSinceBreak: 0,
            });
          };
          tx.oncomplete = () => (db.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
      }),
    OTHER_LEARNER,
  );
}
