// Seam 1: saved data written by the previous schema (v1: "lists") keeps working after the app moved to
// lessons and practice types (schema v2). Two ways old data reaches the app: it is already on the device
// (seeded straight into storage, the only way to leave an older shape behind), or it comes in through a
// backup file made by the older app. Both must end up the same: assignments and the practice in progress
// intact, with Keep going resuming at the exact place. Schema 3 added the stroke order timing settings and schema 4 the
// learning setting: a learner saved before them (schema v2) gets the defaults and keeps their other settings.
// Schema 5 added the Math subject (sessions with generated problems and their tries): everything saved before
// it (a schema v4 device or backup) loads unchanged, and a math session saved at v5 comes back to its exact place.
// Schema 6 added the problems-per-practice setting: a learner saved before it (schema v5) gets 20, which is how big a
// math session always was, and the session in progress keeps its 20 spots.
import type { Page } from '@playwright/test';
import { expect, test, type AudioProbe } from './harness.ts';
import { chooseBackupFile, confirmImport, exportBackup, openBackupSection } from './backup-driver.ts';
import { openParentArea, openParentSection, openSettings, setUpLearner } from './parent-driver.ts';
import { PracticeScreen } from './practice-driver.ts';
import { FactsScreen } from './math-driver.ts';
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

/** The math session in the v5 fixtures: 4 problems done, the fifth (2 + 5) answered wrong once and waiting for the second try. */
async function expectMathResumes({ page, audio }: Fixtures): Promise<void> {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
  const facts = new FactsScreen(page, audio);
  const card = facts.keepGoing.filter({ hasText: 'Fixture Math' });
  await expect(card.getByTestId('progress-text')).toHaveText('4 / 20');
  await card.click();

  await expect(facts.progress).toHaveText('4 / 20');
  await expect(facts.problem).toContainText('2 + 5 =');
  await expect(facts.feedback).toContainText('Try again');
  await facts.submit(7);
  await expect(facts.feedback).toContainText('got it!');
  await facts.next.click();
  await expect(facts.progress).toHaveText('5 / 20');
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

  test('after the move the saved data is at the current schema, and every save stamps when the session was last worked on', async ({
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
    expect(before.schemaVersion).toBe(6);
    expect(before.data.app.schemaVersion).toBe(6);
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

test.describe('saved data from before the stroke order timing settings', () => {
  /** The schema-v2 learner fixture has shuffle off, a break every 15 and sounds off; the new settings show their defaults. */
  async function expectSettingsKept(page: Page): Promise<void> {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await openSettings(page);
    await expect(page.getByRole('switch', { name: 'Shuffle the first round' })).not.toBeChecked();
    await expect(page.getByRole('switch', { name: 'Sound effects' })).not.toBeChecked();
    await expect(page.getByRole('radiogroup', { name: 'Break every' }).getByRole('radio', { name: '15', exact: true })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Normal' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '0.5 s' })).toBeChecked();
    await expect(page.getByRole('switch', { name: 'Say: learning, no grading' })).not.toBeChecked();
  }

  test('a v2 device gets the default stroke speed and pause, and keeps its other settings', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: /grown-up/i })).toBeVisible(); // the empty device is prepared
    await seedSavedData(page, savedDataFixture('schema-v2-learner') as Seed);

    await expectSettingsKept(page);
  });

  test('a backup file made by the previous app imports with the same result, and re-exports at the current schema', async ({
    page,
  }) => {
    await setUpLearner(page, { name: 'Zoe', avatar: '🦁', lessons: ['fixture-five'] });
    await openBackupSection(page);
    await chooseBackupFile(page, JSON.stringify(savedDataFixture('schema-v2-export')));
    await confirmImport(page);

    await expectSettingsKept(page);
    await page.goto('./');
    await openBackupSection(page);
    const { backup } = await exportBackup(page);
    expect(backup.data.app.profiles[0]!.settings).toEqual({
      shuffle: false,
      breakEvery: 15,
      sounds: false,
      strokeSpeed: 'normal',
      strokePauseSeconds: 0.5,
      learning: false,
      problemCount: 20,
    });
  });
});

test.describe('saved data around the Math subject (schema 5)', () => {
  /** What the schema-v4 fixtures hold: the Chinese practice in progress, and no math. */
  async function expectV4Intact({ page, audio, loadLesson }: Fixtures): Promise<void> {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await openSettings(page);
    await expect(page.getByRole('switch', { name: 'Say: learning, no grading' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Fast' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '1 s', exact: true })).toBeChecked();
    await expect(page.getByRole('radiogroup', { name: 'Break every' }).getByRole('radio', { name: '10', exact: true })).toBeChecked();

    await page.goto('./');
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
    await expect(practice.keepGoing).toHaveCount(1);
    await expect(practice.keepGoing.getByTestId('round-badge')).toHaveAttribute('aria-label', 'Round 2');
    await expect(practice.keepGoing.getByTestId('progress-text')).toHaveText('1 / 2');
    await practice.keepGoing.click();
    await expect(practice.target).toHaveText('分');
    await expect(practice.gotIt).toBeVisible();
  }

  test('a v4 device keeps its settings and its practice in progress', async ({ page, audio, loadLesson }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: /grown-up/i })).toBeVisible(); // the empty device is prepared
    await seedSavedData(page, savedDataFixture('schema-v4-learner') as Seed);

    await expectV4Intact({ page, audio, loadLesson });
  });

  test('a v4 backup file imports unchanged and re-exports at the current schema', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page, { name: 'Zoe', avatar: '🦁', lessons: ['fixture-five'] });
    await openBackupSection(page);
    await chooseBackupFile(page, JSON.stringify(savedDataFixture('schema-v4-export')));
    await confirmImport(page);

    await expectV4Intact({ page, audio, loadLesson });
    await page.goto('./');
    await openBackupSection(page);
    const { backup } = await exportBackup(page);
    expect(backup.schemaVersion).toBe(6);
    expect(backup.data.app.schemaVersion).toBe(6);
    expect(backup.data.sessions.map((s) => s.id).sort()).toEqual(
      (savedDataFixture('schema-v4-export') as { data: { sessions: Array<{ id: string }> } }).data.sessions.map((s) => s.id).sort(),
    );
  });

  test('a v5 device with a math session in progress resumes at the exact problem and try', async ({ page, audio, loadLesson }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: /grown-up/i })).toBeVisible(); // the empty device is prepared
    await seedSavedData(page, savedDataFixture('schema-v5-math-learner') as Seed);

    await expectMathResumes({ page, audio, loadLesson });
  });

  test('a v5 backup with a math session imports and resumes at the exact problem and try', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page, { name: 'Zoe', avatar: '🦁', lessons: ['fixture-five'] });
    await openBackupSection(page);
    await chooseBackupFile(page, JSON.stringify(savedDataFixture('schema-v5-math-export')));
    await confirmImport(page);

    await expectMathResumes({ page, audio, loadLesson });
  });
});

test.describe('saved data from before the problems-per-practice setting (schema 5)', () => {
  /** The schema-v5 fixtures: Mia's settings (no problem count) and her Chinese and math practice in progress. */
  async function expectV5Intact({ page, audio, loadLesson }: Fixtures): Promise<void> {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();

    // The setting shows its default, and her other settings are kept.
    await openSettings(page);
    await expect(page.getByRole('radiogroup', { name: 'Problems per practice' }).getByRole('radio', { name: '20', exact: true })).toBeChecked();
    await expect(page.getByRole('switch', { name: 'Shuffle the first round' })).not.toBeChecked();
    await expect(page.getByRole('radio', { name: 'Fast' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '1 s', exact: true })).toBeChecked();

    // Home: the math practice is in progress, so its Facts button is Keep going (the size shows as 4 / 20); the Chinese lesson is as it was, with its practice in progress.
    await page.goto('./');
    const mathCard = page.getByRole('group', { name: 'Fixture Math', exact: true });
    await expect(mathCard.getByRole('link', { name: /^Facts · Keep going/ })).toBeVisible();
    await expect(mathCard.getByRole('link', { name: /problems/ })).toHaveCount(0);
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
    await expect(practice.lessonCard()).toContainText('Keep going'); // in progress: no item count on its button
    await expect(practice.lessonCard()).not.toContainText('3 characters');
    await expect(practice.keepGoing.filter({ hasText: 'Fixture Three' }).getByTestId('progress-text')).toHaveText('1 / 2');
    await expectMathResumes({ page, audio, loadLesson });
  }

  test('a v5 device gets 20 problems per practice, keeps its other settings, and its practice resumes as it was', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: /grown-up/i })).toBeVisible(); // the empty device is prepared
    await seedSavedData(page, savedDataFixture('schema-v5-math-learner') as Seed);

    await expectV5Intact({ page, audio, loadLesson });
  });

  test('a v5 backup file imports unchanged, and exports at schema 6 with 20 problems per practice', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page, { name: 'Zoe', avatar: '🦁', lessons: ['fixture-five'] });
    await openBackupSection(page);
    await chooseBackupFile(page, JSON.stringify(savedDataFixture('schema-v5-math-export')));
    await confirmImport(page);

    await expectV5Intact({ page, audio, loadLesson });
    await page.goto('./');
    await openBackupSection(page);
    const { backup } = await exportBackup(page);
    expect(backup.schemaVersion).toBe(6);
    expect(backup.data.app.schemaVersion).toBe(6);
    expect(backup.data.app.profiles[0]!.settings).toEqual({
      shuffle: false,
      breakEvery: 10,
      sounds: true,
      strokeSpeed: 'fast',
      strokePauseSeconds: 1,
      learning: false,
      problemCount: 20,
    });
    const exported = backup.data.sessions.find((x) => x.lessonId === 'fixture-math')!;
    expect((exported.rounds as Array<{ itemIds: string[] }>)[0]!.itemIds).toHaveLength(20);
  });
});
