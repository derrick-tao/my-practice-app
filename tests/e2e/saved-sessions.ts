// Seam 1 helpers for specs that need to see what is saved on the device while a screen stays where it is
// (a confirmation half way, an error showing). There is no progress page for that yet (ticket 11), so the
// data is read the way a grown-up can: from a backup export, taken on a second tab of the same browser
// context so the page under test is not disturbed. "Another learner" is added through the Profiles screen
// and given a saved practice through backup import. Nothing here touches IndexedDB directly.
import type { Page } from '@playwright/test';
import { editSavedData, exportBackup, openBackupSection, type SavedData, type SessionJson } from './backup-driver.ts';
import { addLearner, openProfiles } from './parent-driver.ts';

export type SavedSession = SessionJson & { rounds: Array<{ index: number; position: number; itemIds: string[] }> };

interface SavedApp {
  profiles: Array<{ id: string; name: string }>;
  activeProfileId: string | null;
}

/** Everything saved on the device, read through Export on a second tab. Needs a set-up learner. */
async function savedData(page: Page): Promise<SavedData> {
  const reader = await page.context().newPage();
  try {
    await reader.goto('./');
    await openBackupSection(reader);
    return (await exportBackup(reader)).backup.data;
  } finally {
    await reader.close();
  }
}

/** Every saved session on the device, oldest first. */
export async function savedSessions(page: Page): Promise<SavedSession[]> {
  const { sessions } = await savedData(page);
  return [...(sessions as SavedSession[])].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** The saved app record (profiles and which one is active). */
export async function savedApp(page: Page): Promise<SavedApp> {
  return (await savedData(page)).app;
}

export const OTHER_LEARNER = { name: 'Leo', avatar: '🦊' } as const;

/**
 * Add a second learner (not the active one) with one saved practice. The learner is added on the Profiles
 * screen; the practice is put in through backup import. Starts on home, ends on a fresh load of home, and
 * returns the new learner's profile id.
 */
export async function addOtherLearner(page: Page): Promise<string> {
  await openProfiles(page);
  await addLearner(page, { ...OTHER_LEARNER, lessons: ['fixture-three'] });
  await page.getByRole('link', { name: 'Home' }).click();
  let otherId = '';
  await editSavedData(page, (saved) => {
    otherId = saved.app.profiles.find((p) => p.name === OTHER_LEARNER.name)!.id;
    const session: SessionJson = {
      id: 'other-learner-session',
      profileId: otherId,
      subject: 'chinese',
      practiceType: 'dictation',
      lessonId: 'fixture-three',
      contentVersion: 'saved-before',
      status: 'completed',
      startedAt: '2026-10-01T09:00:00.000Z',
      completedAt: '2026-10-01T09:01:00.000Z',
      updatedAt: '2026-10-01T09:01:00.000Z',
      rounds: [
        {
          index: 1,
          itemIds: ['点', '分', '找'],
          position: 3,
          phase: 'prompt',
          heardCurrent: false,
          marks: { 点: 'correct', 分: 'correct', 找: 'correct' },
          startedAt: '2026-10-01T09:00:00.000Z',
          completedAt: '2026-10-01T09:01:00.000Z',
        },
      ],
      undo: null,
      marksSinceBreak: 0,
    };
    return { ...saved, sessions: [...saved.sessions, session] };
  });
  return otherId;
}
