// Seam 1: phrase recognition practice (ticket 25). The child reads a phrase, says it aloud, taps Check to hear
// it and see its pinyin, then marks it. Rounds, retries, Undo, breaks and resume work as in dictation; the
// differences are that nothing plays before Check and that a mark never plays the next phrase.
import type { Page } from '@playwright/test';
import type { ItemData, LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { openSettings, setUpLearner } from './parent-driver.ts';
import { allowAudioPlayback, lessonGroup, PracticeScreen, rejectAudioPlayback } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

const PHRASES = ['猫', '三只猫', '书包', '收拾房间', '四只仓鼠', '一只狗'];

async function start(
  { page, audio, loadLesson }: Fixtures,
  options: { breakEvery?: 5 | 10 | 15 } = {},
): Promise<{ practice: PracticeScreen; lesson: LessonData; phrase: (target: string) => ItemData }> {
  await setUpLearner(page);
  if (options.breakEvery !== undefined) {
    await openSettings(page);
    const choice = page.getByRole('radiogroup', { name: 'Break every' }).getByRole('radio', { name: String(options.breakEvery), exact: true });
    await choice.click();
    await expect(choice).toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();
  }
  const lesson = await loadLesson('fixture-five');
  const practice = new PracticeScreen(page, audio, lesson, 'phrase-recognition');
  await practice.open();
  const phrase = (target: string): ItemData => lesson.lists['phrase-recognition']!.find((item) => item.target === target)!;
  return { practice, lesson, phrase };
}

/** Audio is requested straight from a tap or a timer; a negative check gives a late request time to show up. */
const settle = (page: Page): Promise<void> => page.waitForTimeout(1500);

test.describe('phrase recognition: the prompt phase', () => {
  test('shows the phrase large with no pinyin, no audio requested and Check available at once', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });

    await expect(page).toHaveURL(/#\/chinese\/phrase-recognition\/fixture-five$/);
    await expect(practice.progressText()).toHaveText('0 / 6');
    await expect(practice.check).toBeVisible();
    await expect(practice.phrase).toBeVisible();
    const shown = (await practice.phrase.textContent())!;
    expect(PHRASES).toContain(shown);
    // Nothing that gives the reading away: no pinyin, no sound, nothing to listen to yet.
    await expect(page.getByTestId('target')).toHaveCount(0);
    await expect(page.locator('.reveal__pinyin')).not.toBeVisible();
    await expect(practice.listen).toHaveCount(0);
    await expect(practice.slow).toHaveCount(0);
    await settle(page);
    expect(await audio.played(lesson)).toEqual([]);
  });

  test('the phrase is set in the handwriting font', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await expect(practice.phrase).toBeVisible();
    const family = await practice.phrase.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toContain('Practice Kai');
  });
});

test.describe('phrase recognition: Check and the revealed phase', () => {
  test('Check requests the normal audio and shows the pinyin; Slow requests the slow rendition', async ({ page, audio, loadLesson }) => {
    const { practice, lesson, phrase } = await start({ page, audio, loadLesson });
    const shown = (await practice.phrase.textContent())!;

    await practice.check.click();

    await expect(practice.target).toHaveText(shown);
    await expect(page.getByText(phrase(shown).pinyin, { exact: true })).toBeVisible();
    await expect(practice.listen).toBeVisible();
    await expect(practice.slow).toBeVisible();
    await expect(practice.gotIt).toBeVisible();
    await expect(practice.notYet).toBeVisible();
    await expect(practice.check).toHaveCount(0);
    await expect.poll(() => audio.played(lesson)).toEqual([
      { ref: phrase(shown).audio.normal, target: shown, practiceType: 'phrase-recognition', rendition: 'normal' },
    ]);

    await practice.slow.click();
    await expect.poll(async () => (await audio.played(lesson)).at(-1)).toEqual({
      ref: phrase(shown).audio.slow,
      target: shown,
      practiceType: 'phrase-recognition',
      rendition: 'slow',
    });
    await practice.listen.click();
    await expect.poll(async () => (await audio.played(lesson)).at(-1)?.rendition).toBe('normal');
  });

  test('the phrase stays where it is when Check shows the pinyin', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    const before = await practice.phrase.boundingBox();

    await practice.check.click();

    await expect(page.locator('.reveal__pinyin')).toBeVisible();
    expect(await practice.target.boundingBox()).toEqual(before);
  });

  test('when the browser rejects the audio, Listen pulses, and tapping it plays', async ({ page, audio, loadLesson }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await rejectAudioPlayback(page);
    const { practice, lesson } = await start({ page, audio, loadLesson });

    await practice.check.click();

    await expect(practice.target).toBeVisible();
    await expect(practice.listen).toHaveClass(/pulse/);
    expect(await audio.played(lesson)).toEqual([]);

    await allowAudioPlayback(page);
    await practice.listen.click();
    await expect.poll(() => audio.played(lesson)).toHaveLength(1);
    await expect(practice.listen).not.toHaveClass(/pulse/);
  });

  test('a mark moves to the next phrase prompt without requesting any audio for it', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });
    const first = await practice.markNext(true);

    await expect(practice.progressText()).toHaveText('1 / 6');
    await expect(practice.phrase).toBeVisible();
    expect(await practice.phrase.textContent()).not.toBe(first);
    await expect(practice.check).toBeVisible();
    await settle(page);
    // Only the first phrase's Check was ever requested.
    expect(await audio.played(lesson)).toHaveLength(1);
    expect(await practice.lastHeardTarget()).toBe(first);
    await expect(practice.listen).toHaveCount(0);
    await expect(page.locator('.reveal__pinyin')).not.toBeVisible();
  });

  test('the ✅ and ❌ sounds still play on a mark', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await practice.markNext(true);
    await practice.markNext(false);
    await expect.poll(() => audio.effects()).toEqual(['chime', 'gentle']);
  });
});

test.describe('phrase recognition: rounds and completion', () => {
  test('2 misses lead to a retry round of exactly those 2 with no audio, then completion shows first-try score and rounds', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });
    const missed = new Set(['三只猫', '书包']);

    const order = await practice.playRound((target) => !missed.has(target));
    expect([...order].sort()).toEqual([...PHRASES].sort());
    await expect(page.getByTestId('correct-count')).toHaveText('4');
    await expect(page.getByTestId('wrong-count')).toHaveText('2');
    await expect(practice.summary).toContainText("Let's practice 2 more!");
    await audio.clear();

    await practice.retry.click();
    await expect(practice.progressText()).toHaveText('0 / 2');
    await expect(practice.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    await settle(page);
    expect(await audio.played(lesson)).toEqual([]); // the retry round's first phrase does not play either

    const retried = await practice.playRound(() => true);
    expect([...retried].sort()).toEqual([...missed].sort());
    await expect(practice.completion).toBeVisible();
    await expect(page.getByText('4 of 6 on the first try!')).toBeVisible();
    await expect(page.getByText('Rounds: 2')).toBeVisible();
  });

  test('a round with no misses completes straight away', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await practice.playRound(() => true);
    await expect(practice.completion).toBeVisible();
    await expect(page.getByText('6 of 6 on the first try!')).toBeVisible();
    await expect(page.getByText('Rounds: 1')).toBeVisible();
  });
});

test.describe('phrase recognition: Undo, breaks and resume', () => {
  test('Undo shows the same phrase revealed again, without playing anything', async ({ page, audio, loadLesson }) => {
    const { practice, lesson, phrase } = await start({ page, audio, loadLesson });
    const first = await practice.markNext(false);
    await audio.clear();

    await practice.undo.click();

    await expect(practice.target).toHaveText(first);
    await expect(page.getByText(phrase(first).pinyin, { exact: true })).toBeVisible();
    await expect(practice.progressText()).toHaveText('0 / 6');
    await settle(page);
    expect(await audio.played(lesson)).toEqual([]);

    await practice.gotIt.click();
    await practice.playRound(() => true);
    await expect(practice.completion).toBeVisible(); // the ❌ was taken back
  });

  test('after the chosen number of marks a break prompt is offered; Break goes home and Keep going comes back to the next prompt', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, { breakEvery: 5 });
    await practice.markMany(5);
    await expect(practice.breakPrompt).toBeVisible();
    await expect(practice.check).toHaveCount(0);
    await practice.takeBreak.click();
    await expect(page).toHaveURL(/#\/$/);

    await audio.clear();
    await practice.keepGoing.click();
    await expect(practice.progressText()).toHaveText('5 / 6');
    await expect(practice.check).toBeVisible();
    await expect(practice.phrase).toBeVisible();
    await settle(page);
    expect(await audio.played(lesson)).toEqual([]);
  });

  test('after a reload in the prompt phase, Keep going restores the same phrase with Check and no audio', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });
    await practice.markMany(2);
    const shown = (await practice.phrase.textContent())!;

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('2 / 6');
    await expect(practice.phrase).toHaveText(shown);
    await expect(practice.check).toBeVisible();
    await settle(page);
    expect(await audio.played(lesson)).toEqual([]);
  });

  test('after a reload in the revealed phase, Keep going restores the phrase and pinyin; Listen plays only when tapped', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson, phrase } = await start({ page, audio, loadLesson });
    const shown = await practice.reveal();
    await audio.clear();

    await practice.reopenViaKeepGoing();

    await expect(practice.target).toHaveText(shown);
    await expect(page.getByText(phrase(shown).pinyin, { exact: true })).toBeVisible();
    await expect(practice.gotIt).toBeVisible();
    await settle(page);
    expect(await audio.played(lesson)).toEqual([]);
    await practice.listen.click();
    await expect.poll(() => audio.played(lesson)).toHaveLength(1);
  });

  test('after a reload at a round summary, Keep going restores the summary and the retry', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await practice.playRound((target) => target !== '书包');
    await expect(practice.summary).toBeVisible();

    await practice.reopenViaKeepGoing();

    await expect(practice.summary).toContainText("Let's practice 1 more!");
    expect(await practice.playRetryRound(() => true)).toEqual(['书包']);
    await expect(practice.completion).toBeVisible();
  });
});

test.describe('phrase recognition: a phrase is its own item', () => {
  test('marking 猫 ❌ in dictation does not affect 猫 in phrase recognition', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    const lesson = await loadLesson('fixture-five');
    const dictation = new PracticeScreen(page, audio, lesson);
    await dictation.open();
    await dictation.playRound((target) => target !== '猫');
    await expect(dictation.summary).toContainText("Let's practice 1 more!");
    await dictation.home.click();

    const phrases = new PracticeScreen(page, audio, lesson, 'phrase-recognition');
    await phrases.lessonCard().click();
    await expect(phrases.progressText()).toHaveText('0 / 6');
    await phrases.playRound(() => true);
    // The ❌ on the dictation 猫 is not in the phrase list: every phrase is right first time.
    await expect(phrases.completion).toBeVisible();
    await expect(page.getByText('6 of 6 on the first try!')).toBeVisible();
    await phrases.home.click();

    // Dictation still has its own miss to practice again.
    await lessonGroup(page, 'Fixture Five').getByRole('link', { name: /^Write · Keep going/ }).click();
    await expect(dictation.summary).toContainText("Let's practice 1 more!");
  });

  test('marking 猫 ❌ in phrase recognition does not affect 猫 in dictation', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    const lesson = await loadLesson('fixture-five');
    const phrases = new PracticeScreen(page, audio, lesson, 'phrase-recognition');
    await phrases.lessonCard().click();
    await phrases.playRound((target) => target !== '猫');
    await expect(phrases.summary).toContainText("Let's practice 1 more!");
    await phrases.home.click();

    const dictation = new PracticeScreen(page, audio, lesson);
    await dictation.lessonCard().click();
    await dictation.playRound(() => true);
    await expect(dictation.completion).toBeVisible();
    await expect(page.getByText('5 of 5 on the first try!')).toBeVisible();
  });
});

test.describe('phrase recognition: layout', () => {
  test('a long phrase fits on one line, as large as fits, in the prompt and the revealed phase', { tag: '@layout' }, async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson });
    const viewport = page.viewportSize()!;
    const short = Math.min(viewport.width, viewport.height);

    // Walk to the longest fixture phrase.
    while ((await practice.phrase.textContent()) !== '收拾房间') await practice.markNext(true);

    const oneLine = async (locator: typeof practice.phrase): Promise<void> => {
      const box = (await locator.boundingBox())!;
      const fontSize = await locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.height).toBeLessThan(fontSize * 1.5); // one line, not two
      expect(fontSize).toBeGreaterThanOrEqual(short * 0.12); // still big
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    };
    await oneLine(practice.phrase);
    await practice.check.click();
    await expect(practice.target).toHaveText('收拾房间');
    await oneLine(practice.target);
    for (const control of [practice.listen, practice.slow, practice.gotIt, practice.notYet, practice.home]) {
      const box = (await control.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
  });

  test('a one-character phrase is as large as a dictation character', { tag: '@layout' }, async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    while ((await practice.phrase.textContent()) !== '猫') await practice.markNext(true);
    const viewport = page.viewportSize()!;
    const short = Math.min(viewport.width, viewport.height);
    const fontSize = await practice.phrase.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(short * 0.35);
    expect(fontSize).toBeLessThanOrEqual(short * 0.45);
  });
});
