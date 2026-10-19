// Seam 1: saved data written by the previous schema (v1: "lists") keeps working after the app moved to
// lessons and practice types (schema v2). Two ways old data reaches the app: it is already on the device
// (seeded straight into storage, the only way to leave an older shape behind), or it comes in through a
// backup file made by the older app. Both must end up the same: assignments and the practice in progress
// intact, with Keep going resuming at the exact place.
import type { Page } from '@playwright/test';
import { expect, test, type AudioProbe } from './harness.ts';
import { chooseBackupFile, confirmImport, exportBackup, openBackupSection } from './backup-driver.ts';
import { openParentArea, openParentSection, setUpLearner } from './parent-driver.ts';
import { PracticeScreen } from './practice-driver.ts';
import { savedDataFixture, seedSavedData } from './saved-data.ts';
import type { LessonData } from '../../src/content/types.ts';

type Seed = Parameters<typeof seedSavedData>[1];

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** What every route into the app must show for the schema-v1 learner fixture. */
async function expectLearnerIntact({ page, audio, loadLesson }: Fixtures): Promise<void> {
  const lesson = await loadLesson('fixture-three');
  const practice = new PracticeScreen(page, audio, lesson);

  // Home: only the assigned lesson, and the practice in progress on it.
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
  await expect(practice.lessonCard()).toBeVisible();
  await expect(page.getByRole('link', { name: /Fixture Five/ })).toHaveCount(0);
  await expect(practice.keepGoing).toContainText('Fixture Three');
  await expect(practice.keepGoing.getByTestId('round-badge')).toHaveAttribute('aria-label', 'Round 2');
  await expect(practice.keepGoing.getByTestId('progress-text')).toHaveText('1 / 2');

  // Assign lessons: the same single lesson is switched on.
  await openParentArea(page);
  await openParentSection(page, /Assign lessons/);
  await expect(page.getByRole('switch', { name: /Fixture Three/ })).toBeChecked();
  await expect(page.getByRole('switch', { name: /Fixture Five/ })).not.toBeChecked();

  // Keep going resumes at the exact place: the second round's second word, already checked.
  await page.goto('./');
  await practice.keepGoing.click();
  await expect(practice.progressText()).toHaveText('1 / 2');
  await expect(practice.target).toHaveText('分');
  await expect(practice.gotIt).toBeVisible();
  expect(await audio.played(lesson)).toEqual([]);
  await practice.gotIt.click();
  await expect(practice.completion).toBeVisible();
  await expect(page.getByText('Rounds: 2')).toBeVisible();
}

test.describe('saved data from the previous schema', () => {
  test('a v1 device keeps its assignments and its practice in progress, and Keep going resumes at the exact place', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: /grown-up/i })).toBeVisible(); // the empty device is prepared
    await seedSavedData(page, savedDataFixture('schema-v1-learner') as Seed);

    await expectLearnerIntact({ page, audio, loadLesson });
  });

  test('a backup file made by the previous app imports with the same result', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page, { name: 'Zoe', avatar: '🦁', lessons: ['fixture-five'] });
    await openBackupSection(page);
    await chooseBackupFile(page, JSON.stringify(savedDataFixture('schema-v1-export')));
    await confirmImport(page);

    await expectLearnerIntact({ page, audio, loadLesson });
  });

  test('after the move the saved data is at schema 2, and every save stamps when the session was last worked on', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await page.clock.install({ time: new Date('2026-10-18T12:00:00.000Z') });
    await page.goto('./');
    await expect(page.getByRole('button', { name: /grown-up/i })).toBeVisible(); // the empty device is prepared
    await seedSavedData(page, savedDataFixture('schema-v1-learner') as Seed);
    await page.goto('./');

    // On load the old sessions were stamped with the latest time they are known to have been worked on.
    await openBackupSection(page);
    const before = (await exportBackup(page)).backup;
    expect(before.schemaVersion).toBe(2);
    expect(before.data.app.schemaVersion).toBe(2);
    const stamped = (id: string) => before.data.sessions.find((s) => s.id === id)!.updatedAt;
    const learner = savedDataFixture('schema-v1-learner') as { sessions: Array<{ id: string; status: string }> };
    const active = learner.sessions.find((s) => s.status === 'active')!.id;
    const completed = learner.sessions.find((s) => s.status === 'completed')!.id;
    const [stoppedAfterRound, stoppedWithoutTimes] = learner.sessions.filter((s) => s.status === 'stopped').map((s) => s.id) as [string, string];
    expect(stamped(active)).toBe('2026-10-01T09:02:30.000Z'); // the latest round start
    expect(stamped(completed)).toBe('2026-09-20T09:05:00.000Z'); // its completion
    expect(stamped(stoppedAfterRound)).toBe('2026-10-05T09:04:00.000Z'); // no completion of its own: the round's completion, later than its start
    expect(stamped(stoppedWithoutTimes)).toBe('2026-10-06T09:00:00.000Z'); // no round times either: its start

    // Practicing saves the session again, and the stamp moves to now.
    await page.goto('./');
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
    await practice.keepGoing.click();
    await practice.gotIt.click();
    await expect(practice.completion).toBeVisible();

    await page.goto('./');
    await openBackupSection(page);
    const after = (await exportBackup(page)).backup;
    const saved = (id: string) => after.data.sessions.find((s) => s.id === id)!;
    expect(saved(active).updatedAt).toMatch(/^2026-10-18T12:00:/);
    expect(saved(completed).updatedAt).toBe('2026-09-20T09:05:00.000Z'); // untouched sessions keep theirs
  });
});
