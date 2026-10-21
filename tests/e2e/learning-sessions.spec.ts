// Seam 1: the learning setting. While it is on, a new Say session is a learning session: each phrase is shown with
// its pinyin and plays on arrival, and Next (offered once it has been heard) moves on. Nothing is graded. The
// session still takes breaks, respects Shuffle, saves and resumes, and keeps the kind it started as when the setting
// changes. Progress lists it apart from the graded attempts.
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { exportBackup, openBackupSection } from './backup-driver.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { openParentArea, openParentSection, openSettings, setLearning, setUpLearner } from './parent-driver.ts';
import { PracticeScreen, seedRandom } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** A learner with the learning setting on (and optionally a break cadence), opening fixture-five's Say list. */
async function start({ page, audio, loadLesson }: Fixtures, options: { breakEvery?: 5 | 10 | 15; shuffle?: boolean } = {}) {
  await setUpLearner(page);
  if (options.breakEvery !== undefined || options.shuffle === false) {
    await openSettings(page);
    if (options.breakEvery !== undefined) {
      const choice = page.getByRole('radiogroup', { name: 'Break every' }).getByRole('radio', { name: String(options.breakEvery), exact: true });
      await choice.click();
      await expect(choice).toBeChecked();
    }
    if (options.shuffle === false) {
      const shuffle = page.getByRole('switch', { name: 'Shuffle the first round' });
      await shuffle.click();
      await expect(shuffle).not.toBeChecked();
    }
    await page.getByRole('link', { name: 'Home' }).click();
  }
  await setLearning(page, true);
  const lesson = await loadLesson('fixture-five');
  const practice = new PracticeScreen(page, audio, lesson, 'phrase-recognition');
  await practice.open();
  return { practice, lesson };
}

const pinyin = (page: Page) => page.locator('.reveal__pinyin');

test.describe('learning setting: the session', () => {
  test('is off by default, and a graded Say session shows no pinyin and no Next', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    await openSettings(page);
    await expect(page.getByRole('switch', { name: 'Say: learning, no grading' })).not.toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-five'), 'phrase-recognition');
    await practice.open();

    await expect(practice.check).toBeVisible();
    await expect(practice.next).toHaveCount(0);
    await expect(pinyin(page)).toHaveCount(0);
  });

  test('shows the phrase with its pinyin and plays it on arrival; Next comes once it is heard, and has Listen and Slow beside it', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });

    await expect(page).toHaveURL(/#\/chinese\/phrase-recognition\/fixture-five$/);
    await expect(practice.progressText()).toHaveText('0 / 6');
    await expect(practice.target).toBeVisible();
    await expect(pinyin(page)).toBeVisible();
    await expect(practice.listen).toBeVisible();
    await expect(practice.slow).toBeVisible();
    await expect.poll(() => practice.itemAudioCount()).toBe(1);
    expect(await practice.lastHeardTarget()).toBe(await practice.target.textContent());
    await expect(practice.next).toBeVisible();
    // Nothing graded.
    await expect(practice.check).toHaveCount(0);
    await expect(practice.gotIt).toHaveCount(0);
    await expect(practice.notYet).toHaveCount(0);
    await expect(practice.undo).toHaveCount(0);
    await expect(practice.roundBadge).toHaveCount(0);
    expect((await audio.played(lesson)).map((p) => p.practiceType)).toEqual(['phrase-recognition']);
  });

  test('Listen and Slow replay the phrase; Next plays the next phrase at once and makes no sound of its own', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await expect.poll(() => practice.itemAudioCount()).toBe(1);

    await practice.slow.click();
    await practice.waitForItemAudio(2);
    expect((await audio.played(practice.lesson)).at(-1)?.rendition).toBe('slow');
    await practice.listen.click();
    await practice.waitForItemAudio(3);

    await practice.next.click();
    await expect(practice.progressText()).toHaveText('1 / 6');
    await practice.waitForItemAudio(4); // the next phrase, without waiting for a chime
    await expect(practice.next).toBeVisible();
  });

  test('goes through every phrase to a 🎉 completion with the count and no score', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    for (let i = 0; i < 6; i++) {
      await expect(practice.next).toBeVisible();
      await practice.next.click();
    }

    await expect(practice.completion).toBeVisible();
    await expect(practice.completion).toContainText('You did it!');
    await expect(practice.completion).toContainText('6 phrases learned');
    await expect(practice.completion).not.toContainText('first try');
    await expect(practice.completion).not.toContainText('Rounds');
    // Nothing left to resume.
    await page.goto('./');
    await expect(practice.keepGoing).toHaveCount(0);
  });

  test('a break is offered after the 5th Next tap and Keep going carries on', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson }, { breakEvery: 5 });
    for (let i = 0; i < 4; i++) {
      await expect(practice.next).toBeVisible();
      await practice.next.click();
    }
    await expect(practice.breakPrompt).toHaveCount(0);
    await practice.next.click();

    await expect(practice.breakPrompt).toBeVisible();
    await expect(practice.progressText()).toHaveText('5 / 6');
    await practice.keepOn.click();
    await expect(practice.breakPrompt).toHaveCount(0);
    await expect(practice.next).toBeVisible();
  });

  test('Shuffle is respected: with it off the phrases come in the list order', async ({ page, audio, loadLesson }) => {
    await seedRandom(page, 7);
    const { practice, lesson } = await start({ page, audio, loadLesson }, { shuffle: false });
    const listed = lesson.lists['phrase-recognition']!.map((item) => item.target);
    const seen: string[] = [];
    for (let i = 0; i < listed.length; i++) {
      await expect(practice.next).toBeVisible();
      seen.push((await practice.target.textContent())!);
      await practice.next.click();
    }
    expect(seen).toEqual(listed);
  });
});

test.describe('learning setting: leaving and coming back', () => {
  test('a learning session resumes where it was, and keeps going as a learning session after the setting is turned off', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await expect(practice.next).toBeVisible();
    await practice.next.click();
    await expect(practice.progressText()).toHaveText('1 / 6');
    await expect(practice.next).toBeVisible();
    const current = await practice.target.textContent();

    await practice.home.click();
    await setLearning(page, false);
    await practice.keepGoing.click();

    await expect(practice.progressText()).toHaveText('1 / 6');
    await expect(practice.target).toHaveText(current!);
    await expect(pinyin(page)).toBeVisible();
    await expect(practice.check).toHaveCount(0);
    // Resumed: the phrase waits for a tap on Listen, and Next is offered once it has been heard.
    await practice.listen.click();
    await expect(practice.next).toBeVisible();
  });

  test('a graded session keeps being graded after the setting is turned on', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-five'), 'phrase-recognition');
    await practice.open();
    await practice.markNext(true);
    await practice.home.click();
    await setLearning(page, true);

    await practice.keepGoing.click();

    await expect(practice.progressText()).toHaveText('1 / 6');
    await expect(practice.check).toBeVisible();
    await expect(practice.next).toHaveCount(0);
  });
});

test.describe('learning setting: backup and Progress', () => {
  test('a learning session is saved as one, and Progress lists it apart from the attempts, with no score', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson });
    for (let i = 0; i < 2; i++) {
      await expect(practice.next).toBeVisible();
      await practice.next.click();
    }

    await page.goto('./');
    await openBackupSection(page);
    const { backup } = await exportBackup(page);
    expect(backup.data.app.profiles[0]!.settings.learning).toBe(true);
    expect(backup.data.sessions).toEqual([
      expect.objectContaining({ practiceType: 'phrase-recognition', learning: true, status: 'active', marksSinceBreak: 2 }),
    ]);

    await page.goto('./');
    await openParentArea(page);
    await openParentSection(page, 'Progress');
    await page.getByRole('link', { name: /Fixture Five/ }).click();

    const say = page.getByTestId('progress-part-phrase-recognition');
    const learning = say.getByTestId('learning-sessions');
    await expect(say.getByRole('heading', { level: 4, name: /Learning/ })).toBeVisible();
    await expect(learning.getByTestId('attempt')).toHaveCount(1);
    await expect(learning.getByTestId('attempt')).toContainText('Learning');
    await expect(learning.getByTestId('attempt')).toContainText('In progress');
    await expect(learning.getByTestId('attempt')).toContainText('Phrases learned: 2 of 6');
    await expect(say).toContainText('Attempts: 0');
    // Counted in none of the graded numbers.
    await expect(say).toContainText('Best first try: none yet');
    await expect(say).toContainText('No attempts yet');
    await expect(say.getByTestId('attempt')).toHaveCount(1); // the learning row only
    await expect(say.getByTestId('tricky')).toHaveCount(0);

    await learning.getByTestId('attempt').click();
    await expect(page.getByRole('heading', { level: 2, name: /Say · .*Learning/ })).toBeVisible();
    await expect(page.getByTestId('round')).toContainText('Phrases learned: 2 of 6');
    await expect(page.getByRole('main')).not.toContainText('First try');
  });
});
