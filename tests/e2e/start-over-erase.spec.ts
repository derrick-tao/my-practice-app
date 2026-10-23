// Seam 1: starting over and erasing (ticket 09). Everything a child or grown-up does
// goes through the screens; the saved history is read through a backup export on a second tab, because
// the progress page (ticket 11) does not exist yet (see saved-sessions.ts).
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { openParentArea, openParentSection, setUpLearner } from './parent-driver.ts';
import { PracticeScreen } from './practice-driver.ts';
import { addOtherLearner, savedApp, savedSessions } from './saved-sessions.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** Set up Mia, start `lessonId`, mark `marks` items, and return to the home screen. */
async function practiceThenHome(
  { page, audio, loadLesson }: Fixtures,
  lessonId: string,
  marks: number,
): Promise<PracticeScreen> {
  await setUpLearner(page);
  const practice = new PracticeScreen(page, audio, await loadLesson(lessonId));
  await practice.open();
  await practice.markMany(marks);
  await expect(practice.check).toBeVisible(); // the last mark is saved once the next item is ready
  await practice.home.click();
  await expect(practice.keepGoing).toBeVisible();
  return practice;
}

const startOverButton = (page: Page) => page.getByRole('button', { name: 'Start over' });
const yes = (page: Page) => page.getByRole('button', { name: 'Yes', exact: true });
const no = (page: Page) => page.getByRole('button', { name: 'No', exact: true });

test.describe('start over', () => {
  test('asks first; No keeps the session exactly where it was', async ({ page, audio, loadLesson }) => {

    const practice = await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 2);

    await startOverButton(page).click();
    await expect(page.getByText('Start Write again from the beginning?')).toBeVisible();
    await no(page).click();

    await expect(page.getByText('Start Write again from the beginning?')).toHaveCount(0);
    await practice.keepGoing.click();
    await expect(practice.progressText()).toHaveText('2 / 3');
    expect((await savedSessions(page)).map((s) => s.status)).toEqual(['active']);
  });

  test('is not done by a single tap', async ({ page, audio, loadLesson }) => {

    const practice = await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 1);

    await startOverButton(page).click();

    await expect(practice.keepGoing).toBeVisible();
    expect((await savedSessions(page)).map((s) => s.status)).toEqual(['active']);
  });

  test('Yes starts a fresh session at item 1 of round 1; the old one is kept as stopped', async ({ page, audio, loadLesson }) => {

    const practice = await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 0);
    // Get to round 2 with one item done, so "fresh" is easy to tell from "resumed".
    await practice.keepGoing.click();
    await practice.playRound(() => false);
    await practice.retry.click();
    await practice.markNext(true);
    await expect(practice.roundBadge).toBeVisible();
    await practice.home.click();
    await audio.clear();

    await startOverButton(page).click();
    await yes(page).click();

    await expect(practice.progressText()).toHaveText('0 / 3');
    await expect(practice.roundBadge).toHaveCount(0);
    await expect(practice.check).toBeVisible();
    expect(await practice.lastHeardTarget()).toBeDefined(); // the first word plays, like any new start

    const sessions = await savedSessions(page);
    expect(sessions.map((s) => s.status)).toEqual(['stopped', 'active']);
    expect(sessions[0]!.rounds.map((r) => r.index)).toEqual([1, 2]); // the stopped attempt's history is intact
    expect(sessions[1]!.rounds).toHaveLength(1);
    expect(sessions[1]!.rounds[0]!.position).toBe(0);
  });

  test('after starting over, Keep going shows the new session', async ({ page, audio, loadLesson }) => {

    const practice = await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 2);

    await startOverButton(page).click();
    await yes(page).click();
    await expect(practice.progressText()).toHaveText('0 / 3');
    await practice.home.click();

    await expect(practice.keepGoing).toBeVisible();
    await practice.keepGoing.click();
    await expect(practice.progressText()).toHaveText('0 / 3');
  });
});

test.describe('danger zone', () => {
  async function openDangerZone(page: Page): Promise<void> {
    await openParentArea(page);
    await openParentSection(page, 'Danger zone');
  }

  const eraseOne = (page: Page) => page.getByRole('button', { name: 'Erase all progress' });
  const eraseEverything = (page: Page) => page.getByRole('button', { name: 'Erase everything on this device' });
  const yesContinue = (page: Page) => page.getByRole('button', { name: 'Yes, continue' });
  const cancel = (page: Page) => page.getByRole('button', { name: 'Cancel' });

  test('erasing one learner takes two confirmations, deletes only their sessions, and keeps the profile', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const practice = await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 2);
    const otherId = await addOtherLearner(page);
    expect(await savedSessions(page)).toHaveLength(2);

    await openDangerZone(page);
    await eraseOne(page).click();
    await expect(page.getByText("Erase all of Mia's progress?")).toBeVisible();
    expect(await savedSessions(page)).toHaveLength(2); // one tap deletes nothing
    await yesContinue(page).click();
    await expect(page.getByText(/Really erase/)).toBeVisible();
    expect(await savedSessions(page)).toHaveLength(2); // nor do two taps in a row of "continue"
    await page.getByRole('button', { name: 'Yes, erase' }).click();
    await expect(page.getByText("Mia's progress was erased.")).toBeVisible();

    expect((await savedSessions(page)).map((s) => s.profileId)).toEqual([otherId]);
    expect((await savedApp(page)).profiles.map((p) => p.name)).toEqual(['Mia', 'Leo']);

    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await expect(practice.keepGoing).toHaveCount(0);
    await expect(practice.lessonCard()).toBeVisible();
  });

  test('Cancel at either step erases nothing', async ({ page, audio, loadLesson }) => {
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 1);

    await openDangerZone(page);
    await eraseOne(page).click();
    await cancel(page).click();
    await eraseOne(page).click();
    await yesContinue(page).click();
    await cancel(page).click();

    await expect(eraseOne(page)).toBeVisible();
    await expect(page.getByText("Mia's progress was erased.")).toHaveCount(0);
    expect(await savedSessions(page)).toHaveLength(1);
  });

  test('erase everything needs two confirmations and typing ERASE, then returns to first run', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const practice = await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 2);
    await addOtherLearner(page);

    await openDangerZone(page);
    await eraseEverything(page).click();
    await yesContinue(page).click();
    const typed = page.getByRole('textbox', { name: /ERASE/ });
    const erase = page.getByRole('button', { name: 'Erase it all' });
    await expect(erase).toBeDisabled();
    await typed.fill('erase');
    await expect(erase).toBeDisabled();
    await typed.fill('ERASE');
    await expect(erase).toBeEnabled();
    expect(await savedSessions(page)).toHaveLength(2); // nothing is gone until the last tap
    await erase.click();

    await expect(page.getByRole('button', { name: /grown-up/i })).toBeVisible(); // first run

    await setUpLearner(page); // the backup section needs a learner to look at what is left
    expect(await savedSessions(page)).toEqual([]);
    expect((await savedApp(page)).profiles).toHaveLength(1);
    await expect(practice.keepGoing).toHaveCount(0);
    await expect(practice.lessonCard()).toBeVisible();
  });

  test('a failed erase says so, changes nothing, and works when tried again', async ({ page, audio, loadLesson }) => {
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 1);
    await openDangerZone(page);
    await eraseOne(page).click();
    await yesContinue(page).click();

    await page.evaluate(() => void (window.__failStorageWrites = true));
    await page.getByRole('button', { name: 'Yes, erase' }).click();
    await expect(page.getByRole('alert')).toContainText("Couldn't erase");
    expect(await savedSessions(page)).toHaveLength(1);

    await page.evaluate(() => void (window.__failStorageWrites = false));
    await page.getByRole('button', { name: 'Yes, erase' }).click();
    await expect(page.getByText("Mia's progress was erased.")).toBeVisible();
    expect(await savedSessions(page)).toEqual([]);
  });

  test('Cancel in the erase-everything steps erases nothing', async ({ page, audio, loadLesson }) => {
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 1);

    await openDangerZone(page);
    await eraseEverything(page).click();
    await yesContinue(page).click();
    await cancel(page).click();

    expect(await savedSessions(page)).toHaveLength(1);
    expect((await savedApp(page)).profiles).toHaveLength(1);
    await expect(eraseEverything(page)).toBeVisible();
  });
});
