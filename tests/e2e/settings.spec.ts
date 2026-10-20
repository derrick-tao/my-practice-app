// Seam 1: per-learner Settings (ticket 08): shuffle, break cadence, sounds, and the stroke order timing.
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { openSettings, passGate, setUpLearner } from './parent-driver.ts';
import { PracticeScreen, seedRandom } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** Set up a learner, change settings in the parent area, then open the lesson from home. */
async function startWith(
  { page, audio, loadLesson }: Fixtures,
  lessonId: string,
  change: (page: Page) => Promise<void>,
): Promise<{ practice: PracticeScreen; lesson: LessonData }> {
  await setUpLearner(page);
  await openSettings(page);
  await change(page);
  await page.getByRole('link', { name: 'Home' }).click();
  const lesson = await loadLesson(lessonId);
  const practice = new PracticeScreen(page, audio, lesson);
  await practice.open();
  return { practice, lesson };
}

test.describe('settings: shuffle', () => {
  test('with shuffle off, round 1 follows list order and retry rounds are still reordered', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await seedRandom(page, 7);
    const { practice, lesson } = await startWith({ page, audio, loadLesson }, 'fixture-five', async (p) => {
      await expect(p.getByRole('switch', { name: 'Shuffle the first round' })).toBeChecked();
      await p.getByRole('switch', { name: 'Shuffle the first round' }).click();
      await expect(p.getByRole('switch', { name: 'Shuffle the first round' })).not.toBeChecked();
    });
    const listOrder = lesson.lists.dictation!.map((x) => x.target);

    const first = await practice.playRound((_, i) => i < 2); // miss the last three
    expect(first).toEqual(listOrder);

    const missed = listOrder.slice(2);
    const retry = await practice.playRetryRound(() => true);
    expect([...retry].sort()).toEqual([...missed].sort());
    expect(retry).not.toEqual(missed);
  });
});

test.describe('settings: saved per learner', () => {
  test('start with the defaults and survive a reload: shuffle on, break every 10, sounds on', async ({ page }) => {
    await setUpLearner(page);
    await openSettings(page);
    const sounds = page.getByRole('switch', { name: 'Sound effects' });
    await expect(page.getByRole('switch', { name: 'Shuffle the first round' })).toBeChecked();
    await expect(sounds).toBeChecked();
    await expect(page.getByRole('radio', { name: '10', exact: true })).toBeChecked();

    await sounds.click();
    await expect(sounds).not.toBeChecked();
    await page.getByRole('radio', { name: '15', exact: true }).click();
    await expect(page.getByRole('radio', { name: '15', exact: true })).toBeChecked();

    await page.reload(); // the gate locks again on reload
    await passGate(page);
    await expect(page.getByRole('switch', { name: 'Sound effects' })).not.toBeChecked();
    await expect(page.getByRole('switch', { name: 'Shuffle the first round' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '15', exact: true })).toBeChecked();
  });

  test('the learning setting starts off, survives a reload, and is per learner', async ({ page }) => {
    await setUpLearner(page);
    await openSettings(page);
    const learning = page.getByRole('switch', { name: 'Say: learning, no grading' });
    await expect(learning).not.toBeChecked();

    await learning.click();
    await expect(learning).toBeChecked();

    await page.reload(); // the gate locks again on reload
    await passGate(page);
    await expect(page.getByRole('switch', { name: 'Say: learning, no grading' })).toBeChecked();
  });

  test('stroke speed and pause start at Normal and 0.5 s, and the choices survive a reload', async ({ page }) => {
    await setUpLearner(page);
    await openSettings(page);
    const speed = page.getByRole('radiogroup', { name: 'Stroke speed' });
    const pause = page.getByRole('radiogroup', { name: 'Pause after each stroke' });
    await expect(speed.getByRole('radio')).toHaveText(['Slow', 'Normal', 'Fast']);
    await expect(pause.getByRole('radio')).toHaveText(['0.5 s', '1 s', '2 s', '3 s']);
    await expect(speed.getByRole('radio', { name: 'Normal' })).toBeChecked();
    await expect(pause.getByRole('radio', { name: '0.5 s' })).toBeChecked();

    await speed.getByRole('radio', { name: 'Slow' }).click();
    await expect(speed.getByRole('radio', { name: 'Slow' })).toBeChecked();
    await expect(speed.getByRole('radio', { name: 'Normal' })).not.toBeChecked();
    await pause.getByRole('radio', { name: '3 s' }).click();
    await expect(pause.getByRole('radio', { name: '3 s' })).toBeChecked();
    await expect(pause.getByRole('radio', { name: '0.5 s' })).not.toBeChecked();

    await page.reload(); // the gate locks again on reload
    await passGate(page);
    await expect(page.getByRole('radio', { name: 'Slow' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '3 s' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '10', exact: true })).toBeChecked(); // the other choices stay as they were
  });

  test('sounds off mutes effects only: the character audio still plays', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await startWith({ page, audio, loadLesson }, 'fixture-three', async (p) => {
      await p.getByRole('switch', { name: 'Sound effects' }).click();
      await expect(p.getByRole('switch', { name: 'Sound effects' })).not.toBeChecked();
    });
    await expect(practice.check).toBeVisible();
    const played = await audio.played(lesson);
    expect(played.length).toBeGreaterThan(0);
    expect(played.every((p) => p.target !== undefined)).toBe(true);
  });
});
