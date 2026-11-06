// Seam 1: leaving the app lets go of its audio (the iOS lock-screen Now Playing widget otherwise lingers).
// The stub cannot show the widget go away, only that every element was stopped and let go; nothing
// replays by itself on return, and the mounted screen keeps its place and its sound.
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { PracticeScreen } from './practice-driver.ts';
import { setUpLearner } from './parent-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** Dictation opens with the first item's audio requested by itself. */
async function start({ page, audio, loadLesson }: Fixtures): Promise<{ practice: PracticeScreen; lesson: LessonData }> {
  await setUpLearner(page);
  const lesson = await loadLesson('fixture-three');
  const practice = new PracticeScreen(page, audio, lesson);
  await practice.open();
  await practice.waitForItemAudio(1);
  return { practice, lesson };
}

/** Audio is requested straight from a tap or a timer; a negative check gives a late request time to show up. */
const settle = (page: Page): Promise<void> => page.waitForTimeout(1500);

test.describe('audio is let go when the app is hidden or closed: practice', () => {
  test('hiding the page stops and lets go of the character audio', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });
    const [first] = await audio.played(lesson);

    await audio.hide();

    expect(await audio.paused()).toContainEqual(expect.stringContaining(first!.ref));
    expect(await audio.released()).toContainEqual(expect.stringContaining(first!.ref));
    expect(await audio.reloads()).toBeGreaterThan(0);
    await expect(practice.listen).toBeVisible();
  });

  test('closing the page does the same', async ({ page, audio, loadLesson }) => {
    const { lesson, practice } = await start({ page, audio, loadLesson });
    const [first] = await audio.played(lesson);

    await audio.close();

    expect(await audio.paused()).toContainEqual(expect.stringContaining(first!.ref));
    expect(await audio.released()).toContainEqual(expect.stringContaining(first!.ref));
    expect(await audio.reloads()).toBeGreaterThan(0);
    await expect(practice.listen).toBeVisible();
  });

  test('on return nothing replays by itself, and tapping Listen plays the same item again', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    const heard = await practice.lastHeardTarget();

    await audio.hide();
    await settle(page);
    await audio.show();
    await settle(page);
    expect(await practice.itemAudioCount()).toBe(1);

    await practice.listen.click();
    await practice.waitForItemAudio(2);
    expect(await practice.lastHeardTarget()).toBe(heard);
    await expect(practice.progressText()).toHaveText('0 / 3');
  });

  test('a rapid hide then show leaves the sound working on the same item', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    const heard = await practice.lastHeardTarget();

    await audio.hide();
    await audio.show();
    await practice.slow.click();

    await practice.waitForItemAudio(2);
    expect(await practice.lastHeardTarget()).toBe(heard);
    expect((await audio.played(practice.lesson)).at(-1)!.rendition).toBe('slow');
    await practice.reveal();
    await practice.gotIt.click();
    await expect(practice.progressText()).toHaveText('1 / 3');
  });

  test('the next item does not auto-play while the page is hidden, and nothing plays on return until a tap', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await practice.reveal();
    await practice.gotIt.click();
    await audio.hide();

    await settle(page);
    expect(await practice.itemAudioCount()).toBe(1);

    await audio.show();
    await settle(page);
    expect(await practice.itemAudioCount()).toBe(1);
    await expect(practice.progressText()).toHaveText('1 / 3');

    await practice.listen.click();
    await practice.waitForItemAudio(2);
  });

  test('a hide and show before the auto-play is due still cancels it', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await practice.reveal();
    await practice.gotIt.click();
    await audio.hide();
    await audio.show();

    await settle(page);

    expect(await practice.itemAudioCount()).toBe(1);
    await practice.listen.click();
    await practice.waitForItemAudio(2);
  });
});
