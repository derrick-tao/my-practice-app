// Seam 1: leaving the app also lets go of the sound effects (chime, gentle, fanfare), on the Chinese practice screen
// and the maths practice screen. While the page is hidden no effect plays or is made again, the failed-element retry
// included; after it is visible again the effects play, with fresh elements. With sounds off there are none to let go.
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { setSoundEffects, setUpLearner } from './parent-driver.ts';
import { PracticeScreen } from './practice-driver.ts';
import { TrueOrFalseScreen } from './true-or-false-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

const EFFECT_SOURCES = ['chime.wav', 'gentle.wav', 'fanfare.wav'];

/** Sound effect sources among `sources` (character audio lives under /content/). */
const effectSources = (sources: string[]): string[] => sources.filter((src) => src.includes('/sounds/'));

async function startPractice({ page, audio, loadLesson }: Fixtures, sounds = true): Promise<PracticeScreen> {
  // Listen pulses when auto-play is refused (as while hidden); reduced motion stops the animation so it can be tapped.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setUpLearner(page);
  if (!sounds) await setSoundEffects(page, false);
  const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
  await practice.open();
  await expect(practice.listen).toBeVisible();
  await audio.clear();
  return practice;
}

async function startMaths({ page, audio }: Pick<Fixtures, 'page' | 'audio'>, sounds = true): Promise<TrueOrFalseScreen> {
  await setUpLearner(page, { lessons: ['fixture-math-tf'] });
  if (!sounds) await setSoundEffects(page, false);
  const screen = new TrueOrFalseScreen(page, audio);
  await screen.open('Fixture True or False');
  await screen.read();
  await audio.clear();
  return screen;
}

/** A settle for negative checks: a late request or retry needs time to show up. */
const settle = (page: Page): Promise<void> => page.waitForTimeout(1000);

test.describe('sound effects are let go when the app is hidden or closed: practice', () => {
  test('hiding the page stops and lets go of the effect elements', async ({ page, audio, loadLesson }) => {
    await startPractice({ page, audio, loadLesson });

    await audio.hide();

    for (const name of EFFECT_SOURCES) {
      expect(effectSources(await audio.paused())).toContainEqual(expect.stringContaining(name));
      expect(effectSources(await audio.released())).toContainEqual(expect.stringContaining(name));
    }
  });

  test('closing the page does the same', async ({ page, audio, loadLesson }) => {
    await startPractice({ page, audio, loadLesson });

    await audio.close();

    for (const name of EFFECT_SOURCES) {
      expect(effectSources(await audio.released())).toContainEqual(expect.stringContaining(name));
    }
  });

  test('no effect plays while hidden, and the gentle and chime play again once visible', async ({ page, audio, loadLesson }) => {
    const practice = await startPractice({ page, audio, loadLesson });
    await audio.hide();
    await audio.clear();

    await practice.markNext(true);
    await settle(page);
    expect(await audio.effects()).toEqual([]);
    expect(await audio.released()).toEqual([]); // nothing was made again while hidden, so nothing needed letting go

    await audio.show();
    await practice.listen.click(); // nothing played by itself on return
    await practice.markNext(false);
    await expect.poll(() => audio.effects()).toEqual(['gentle']);
    await practice.markNext(true); // the next item reads itself out again, as the sound has finished
    await expect.poll(() => audio.effects()).toEqual(['gentle', 'chime']);
  });

  test('a play that fails after the page is hidden does not bring the effect back', async ({ page, audio, loadLesson }) => {
    // play() is recorded, then rejects a moment later, which would normally make a fresh element and try again.
    await page.addInitScript(() => {
      const recorded = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement): Promise<void> {
        const result = recorded.call(this);
        if (!this.src.includes('/sounds/')) return result;
        return result.then(() => new Promise<void>((_, reject) => setTimeout(() => reject(new DOMException('x', 'NotAllowedError')), 300)));
      };
    });
    const practice = await startPractice({ page, audio, loadLesson });
    await practice.markNext(true);
    await expect.poll(() => audio.effects()).toEqual(['chime']);
    await audio.hide();
    await audio.clear();

    await settle(page);

    expect(await audio.effects()).toEqual([]);
    await audio.show();
    await practice.listen.click();
    await practice.markNext(true);
    await expect.poll(() => audio.effects()).toEqual(['chime']);
  });

  test('with sounds off there are no effect elements to let go', async ({ page, audio, loadLesson }) => {
    const practice = await startPractice({ page, audio, loadLesson }, false);
    await practice.listen.click();

    await audio.hide();

    expect(effectSources(await audio.released())).toEqual([]);
    expect(await audio.released()).not.toEqual([]); // the character audio still is
    await audio.show();
    await practice.markNext(true);
    await settle(page);
    expect(await audio.effects()).toEqual([]);
  });
});

test.describe('sound effects are let go when the app is hidden or closed: maths', () => {
  test('hiding the page stops and lets go of the effect elements', async ({ page, audio }) => {
    await startMaths({ page, audio });

    await audio.hide();

    for (const name of EFFECT_SOURCES) {
      expect(effectSources(await audio.paused())).toContainEqual(expect.stringContaining(name));
      expect(effectSources(await audio.released())).toContainEqual(expect.stringContaining(name));
    }
  });

  test('closing the page does the same', async ({ page, audio }) => {
    await startMaths({ page, audio });

    await audio.close();

    for (const name of EFFECT_SOURCES) {
      expect(effectSources(await audio.released())).toContainEqual(expect.stringContaining(name));
    }
  });

  test('no effect plays while hidden, and effects play again once visible', async ({ page, audio }) => {
    const screen = await startMaths({ page, audio });
    await audio.hide();
    await audio.clear();

    await screen.solveFirstTry();
    await settle(page);
    expect(await audio.effects()).toEqual([]);
    expect(await audio.released()).toEqual([]);

    await audio.show();
    await screen.solveFirstTry();
    await expect.poll(() => audio.effects()).toEqual(['chime']);
    await screen.answerWrong();
    await expect.poll(() => audio.effects()).toEqual(['chime', 'gentle']);
  });

  test('with sounds off there are no effect elements to let go', async ({ page, audio }) => {
    const screen = await startMaths({ page, audio }, false);

    await audio.hide();
    await audio.show();
    await screen.solveFirstTry();
    await settle(page);

    expect(effectSources(await audio.released())).toEqual([]);
    expect(await audio.effects()).toEqual([]);
  });
});

test.describe('a sound effect is let go when it ends', () => {
  /** The effect plays to its end, which lets go of exactly its element (the others stay). */
  const finishedAndReleased = async (audio: AudioProbe, name: string): Promise<void> => {
    const before = (await audio.released()).length;
    const reloadsBefore = await audio.reloads();
    await audio.finish(`${name}.wav`);
    expect((await audio.released()).slice(before)).toEqual([expect.stringContaining(`${name}.wav`)]);
    expect(await audio.reloads()).toBe(reloadsBefore + 1);
  };

  test('the gentle and the chime are released after each play and play again, twice over', async ({ page, audio, loadLesson }) => {
    const practice = await startPractice({ page, audio, loadLesson });

    await practice.markNext(false);
    await expect.poll(() => audio.effects()).toEqual(['gentle']);
    await finishedAndReleased(audio, 'gentle');
    await audio.clear();
    await practice.markNext(true);
    await expect.poll(() => audio.effects()).toEqual(['chime']);
    await finishedAndReleased(audio, 'chime');

    await audio.clear();
    await practice.listen.click();
    await practice.markNext(false);
    await expect.poll(() => audio.effects()).toEqual(['gentle']);
    await finishedAndReleased(audio, 'gentle');
  });

  test('the fanfare is released after it ends', async ({ page, audio, loadLesson }) => {
    const practice = await startPractice({ page, audio, loadLesson });
    await practice.markMany(3, (i) => i !== 1);
    await practice.retry.click();
    await practice.markNext(true);
    await expect(practice.completion).toBeVisible();
    await expect.poll(async () => (await audio.effects()).filter((name) => name === 'fanfare')).toHaveLength(1);

    await finishedAndReleased(audio, 'fanfare');
  });

  test('maths effects are released after they end and play again', async ({ page, audio }) => {
    const screen = await startMaths({ page, audio });

    await screen.solveFirstTry();
    await expect.poll(() => audio.effects()).toEqual(['chime']);
    await finishedAndReleased(audio, 'chime');
    await audio.clear();
    await screen.solveFirstTry();
    await expect.poll(() => audio.effects()).toEqual(['chime']);
    await finishedAndReleased(audio, 'chime');
    await audio.clear();
    await screen.answerWrong();
    await expect.poll(() => audio.effects()).toEqual(['gentle']);
    await finishedAndReleased(audio, 'gentle');
  });

  test('an effect that ended is not brought back by hiding the page, and the others are still let go', async ({ page, audio, loadLesson }) => {
    const practice = await startPractice({ page, audio, loadLesson });
    await practice.markNext(true);
    await expect.poll(() => audio.effects()).toEqual(['chime']);
    await finishedAndReleased(audio, 'chime');

    await audio.clear();
    await audio.hide();

    expect(effectSources(await audio.released())).toHaveLength(2); // gentle and fanfare; the chime was already let go
    await audio.show();
    await practice.listen.click();
    await audio.clear();
    await practice.markNext(true);
    await expect.poll(() => audio.effects()).toEqual(['chime']);
  });

  test('character audio is kept when it ends: the next tap plays at once, again and again', async ({ page, audio, loadLesson }) => {
    const practice = await startPractice({ page, audio, loadLesson });

    await practice.listen.click();
    await expect.poll(async () => (await audio.played()).length).toBe(1);
    await audio.finish('/content/');
    expect(await audio.released()).toEqual([]);
    await practice.listen.click();
    await expect.poll(async () => (await audio.played()).length).toBe(2);
    await audio.finish('/content/');
    await practice.listen.click();
    await expect.poll(async () => (await audio.played()).length).toBe(3);
    expect(await audio.released()).toEqual([]);
  });
});
