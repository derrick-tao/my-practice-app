// Seam 1 for ticket 15 (kid polish): the Kai font, sound effects, confetti, the volume hint, touch targets.
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { setSoundEffects, setUpLearner } from './parent-driver.ts';
import { allowAudioPlayback, PracticeScreen, rejectAudioPlayback } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** A learner is set up and the lesson is open on its first item. */
async function start({ page, audio, loadLesson }: Fixtures, lessonId: string): Promise<PracticeScreen> {
  await setUpLearner(page);
  const practice = new PracticeScreen(page, audio, await loadLesson(lessonId));
  await practice.open();
  await expect(practice.listen).toBeVisible();
  return practice;
}

test.describe('Kai font', () => {
  test('the revealed character is drawn with the self-hosted subset font', async ({ page, audio, loadLesson }) => {
    const fontResponses: Array<{ url: string; status: number }> = [];
    page.on('response', (response) => {
      if (response.url().includes('.woff2')) fontResponses.push({ url: response.url(), status: response.status() });
    });
    const practice = await start({ page, audio, loadLesson }, 'fixture-three');
    const target = await practice.reveal();

    await expect
      .poll(() =>
        page.evaluate((text) => {
          const faces = [...document.fonts].filter((face) => face.family.replace(/["']/g, '') === 'Practice Kai');
          return { statuses: faces.map((face) => face.status), covers: document.fonts.check('1em "Practice Kai"', text) };
        }, target),
      )
      .toEqual({ statuses: ['loaded'], covers: true });

    const family = await practice.target.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family.split(',')[0]!.replace(/["']/g, '').trim()).toBe('Practice Kai');
    // It falls back to a system font when the file cannot be used.
    expect(family.split(',').length).toBeGreaterThan(1);

    // Served by the app itself, from its own origin and base path.
    expect(fontResponses).toEqual([
      { url: new URL('content/fonts/practice-kai.woff2', page.url()).href, status: 200 },
    ]);
  });
});

/** Play the lesson through to the completion screen, all right the first time. */
async function finish(practice: PracticeScreen): Promise<void> {
  await practice.playRound(() => true);
  await expect(practice.completion).toBeVisible();
}

test.describe('confetti', () => {
  test('confetti falls on the completion screen', async ({ page, audio, loadLesson }) => {
    const practice = await start({ page, audio, loadLesson }, 'fixture-three');
    await finish(practice);

    const confetti = page.getByTestId('confetti');
    await expect(confetti).toBeAttached();
    expect(await confetti.locator('.confetti__piece').count()).toBeGreaterThanOrEqual(20);
    const animation = await confetti.locator('.confetti__piece').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('confetti-fall');
    await expect(page.getByTestId('completion-fade')).toHaveCount(0);
    // It is decoration: it never blocks the Home button and a screen reader skips it.
    await expect(confetti).toHaveAttribute('aria-hidden', 'true');
    await expect(practice.completion.getByRole('link', { name: 'Home' })).toBeVisible();
  });

  test('with reduced motion the confetti is replaced by a simple fade', async ({ page, audio, loadLesson }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const practice = await start({ page, audio, loadLesson }, 'fixture-three');
    await finish(practice);

    await expect(page.getByTestId('confetti')).toHaveCount(0);
    const fade = page.getByTestId('completion-fade');
    await expect(fade).toBeAttached();
    expect(await fade.evaluate((el) => getComputedStyle(el).animationName)).toBe('completion-fade');
    // Nothing moves: the only animation allowed is the opacity fade.
    expect(await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName))).toEqual([
      'completion-fade',
    ]);
  });
});

/** Every tappable control on the screen that is too small for a child's finger, or cut off at the sides. */
async function undersizedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const problems: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('main a[href], main button, main [role="button"]')) {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      if (style.visibility === 'hidden' || style.display === 'none' || box.width === 0 || box.height === 0) continue;
      if (el.closest('.sr-only')) continue;
      const name = (el.textContent ?? '').trim() || el.getAttribute('aria-label') || el.className;
      const primary = el.classList.contains('btn--primary');
      const minHeight = primary ? 96 : 64;
      if (box.width < 64 || box.height < minHeight) {
        problems.push(`${name}: ${Math.round(box.width)}x${Math.round(box.height)} (needs 64 wide, ${minHeight} tall)`);
      }
      if (box.left < 0 || box.right > viewportWidth) problems.push(`${name}: cut off at the sides`);
    }
    return problems;
  });
}

/**
 * Walk every kid-facing screen in turn (the listening screen, the revealed ✅/❌, the Undo chip, the break
 * prompt, a round summary, completion, home with Keep going, the stop-current-practice question) and
 * collect what `inspect` reports for each. An empty lesson per screen means nothing is wrong there.
 */
async function inspectKidScreens(
  { page, audio, loadLesson }: Fixtures,
  inspect: (page: Page) => Promise<string[]>,
): Promise<Record<string, string[]>> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const practice = await start({ page, audio, loadLesson }, 'fixture-twelve');
  const screens: Record<string, string[]> = {};
  const record = async (name: string): Promise<void> => void (screens[name] = await inspect(page));

  await record('listening');
  await practice.reveal();
  await record('revealed: ✅ and ❌');
  await practice.gotIt.click();
  await expect(practice.undo).toBeVisible();
  await record('after a mark: Undo chip');

  // Ten marks in a row bring up the break prompt.
  await practice.markMany(9);
  await expect(practice.breakPrompt).toBeVisible();
  await record('break prompt');
  await practice.keepOn.click();

  // Finish the round with a miss: the round summary.
  await practice.playRound((_, index) => index !== 0);
  await expect(practice.summary).toBeVisible();
  await record('round summary');

  // The retry round ends the lesson: the completion screen.
  await practice.retry.click();
  await practice.playRound(() => true);
  await expect(practice.completion).toBeVisible();
  await record('completion');
  await practice.completion.getByRole('link', { name: 'Home' }).click();

  // A lesson in progress shows on home as Keep going.
  const three = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
  await three.lessonCard().click();
  await three.markNext(true);
  await three.home.click();
  await expect(three.keepGoing).toBeVisible();
  await record('home with Keep going');

  // Another lesson while one is active: the "Stop your current practice?" question.
  await page.getByRole('link', { name: /Fixture Five/ }).click();
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();
  await record('stop-current-practice question');
  return screens;
}

const allClear = (screens: Record<string, string[]>): Record<string, string[]> =>
  Object.fromEntries(Object.keys(screens).map((name) => [name, []]));

test.describe('touch targets', () => {
  test('every control on the kid screens is at least 64 pt, primary actions 96 pt, on this device and orientation', { tag: '@layout' }, async ({
    page,
    audio,
    loadLesson,
  }) => {
    const screens = await inspectKidScreens({ page, audio, loadLesson }, undersizedControls);
    expect(screens).toEqual(allClear(screens));
  });
});

/** Every control on the screen that a child who cannot read yet could not recognise by a picture. */
async function iconlessControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('main a[href], main button, main [role="button"]')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (!el.querySelector('[aria-hidden="true"]')) {
        problems.push(`${(el.textContent ?? '').trim() || el.className}: no icon`);
      }
    }
    return problems;
  });
}

test.describe('icon-led labels', () => {
  test('every control on the kid screens carries an icon beside its words', async ({ page, audio, loadLesson }) => {
    const screens = await inspectKidScreens({ page, audio, loadLesson }, iconlessControls);
    expect(screens).toEqual(allClear(screens));
  });
});

test.describe('volume hint', () => {
  test('two audio failures in a row show "Turn up the volume"; one does not, and a success clears it', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // a pulsing Listen button cannot be clicked
    await rejectAudioPlayback(page);
    const practice = await start({ page, audio, loadLesson }, 'fixture-three');
    const hint = page.getByText('No sound? Turn up the volume');

    // The auto-play on arrival failed: that is one failure.
    await expect(practice.listen).toHaveClass(/pulse/);
    await expect(hint).toHaveCount(0);

    // The child taps Listen and it fails again.
    await practice.listen.click();
    await expect(hint).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Turn up the volume' })).toBeVisible();

    // Sound works again: the hint goes away, and a single new failure does not bring it back.
    await allowAudioPlayback(page);
    await practice.listen.click();
    await expect(hint).toHaveCount(0);
    await page.evaluate(() => void (window.__rejectAudio = true));
    await practice.listen.click();
    await expect(hint).toHaveCount(0);
    await practice.slow.click();
    await expect(hint).toBeVisible();
  });
});

test.describe('sound effects', () => {
  test('a chime on a ✅, a gentle tone on a ❌, and a fanfare when the last word is right', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const practice = await start({ page, audio, loadLesson }, 'fixture-three');
    expect(await audio.effects()).toEqual([]);

    await practice.markNext(true);
    await expect.poll(() => audio.effects()).toEqual(['chime']);
    await practice.markNext(false);
    await expect.poll(() => audio.effects()).toEqual(['chime', 'gentle']);
    await practice.markNext(true);
    await expect.poll(() => audio.effects()).toEqual(['chime', 'gentle', 'chime']);
    await expect(practice.summary).toBeVisible();

    await practice.retry.click();
    await practice.markNext(true);
    await expect(practice.completion).toBeVisible();
    await expect.poll(() => audio.effects()).toEqual(['chime', 'gentle', 'chime', 'fanfare']);
  });

  test('with the sounds setting off, no effect is requested but the characters are still read out', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    await setSoundEffects(page, false);
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
    await practice.open();
    await expect(practice.listen).toBeVisible();

    await practice.markNext(true);
    await practice.markNext(false);
    await practice.markNext(true);
    await practice.retry.click();
    await practice.markNext(true);
    await expect(practice.completion).toBeVisible();

    expect(await audio.effects()).toEqual([]);
    expect((await audio.played(practice.lesson)).length).toBeGreaterThan(0);
  });
});

// #30: the ✅/❌ sound is heard before the next item's audio, not on top of it.
test.describe("the next item's audio waits for the sound effect", () => {
  /** Lengths of public/sounds/chime.wav and gentle.wav. */
  const CHIME_MS = 700;
  const GENTLE_MS = 750;

  /** Like `start`, with the page clock installed first; it is paused once the first item's audio has played. */
  async function startWithClock(fixtures: Fixtures, sounds = true): Promise<PracticeScreen> {
    await fixtures.page.clock.install();
    await setUpLearner(fixtures.page);
    if (!sounds) await setSoundEffects(fixtures.page, false);
    const practice = new PracticeScreen(fixtures.page, fixtures.audio, await fixtures.loadLesson('fixture-three'));
    await practice.open();
    await expect(practice.check).toBeVisible();
    await fixtures.page.clock.pauseAt(Date.now() + 1_000);
    return practice;
  }

  for (const [correct, effect, length] of [
    [true, 'chime', CHIME_MS],
    [false, 'gentle', GENTLE_MS],
  ] as const) {
    test(`after ${correct ? '✅' : '❌'} the next item's audio is requested only once the ${effect} has ended`, async ({
      page,
      audio,
      loadLesson,
    }) => {
      const practice = await startWithClock({ page, audio, loadLesson });
      await practice.markNext(correct);
      await expect.poll(() => audio.effects()).toEqual([effect]);

      await page.clock.runFor(length - 10);
      expect(await practice.itemAudioCount()).toBe(1);
      await page.clock.runFor(200);
      await expect.poll(() => audio.played(practice.lesson)).toEqual([
        expect.anything(),
        expect.objectContaining({ rendition: 'normal' }),
      ]);
      await expect(practice.check).toBeVisible();
    });
  }

  test("with the sounds setting off, the next item's audio is requested right after the mark", async ({
    page,
    audio,
    loadLesson,
  }) => {
    const practice = await startWithClock({ page, audio, loadLesson }, false);
    await practice.markNext(true);
    // The clock is paused: nothing waits for a timer.
    await practice.waitForItemAudio(2);
    expect(await audio.effects()).toEqual([]);
  });

  test("tapping Undo before the next item's audio plays means it never plays", async ({ page, audio, loadLesson }) => {
    const practice = await startWithClock({ page, audio, loadLesson });
    await practice.markNext(true);
    await practice.undo.click();
    await expect(practice.gotIt).toBeVisible(); // back on the marked item
    await page.clock.runFor(2_000);
    expect(await practice.itemAudioCount()).toBe(1);
  });

  test("tapping Home before the next item's audio plays means it never plays", async ({ page, audio, loadLesson }) => {
    const practice = await startWithClock({ page, audio, loadLesson });
    await practice.markNext(true);
    await practice.home.click();
    await expect(page.getByRole('heading', { name: /Hi/ })).toBeVisible();
    await page.clock.runFor(2_000);
    expect(await practice.itemAudioCount()).toBe(1);
  });

  test("tapping Listen while the next item's audio waits plays it once, not twice", async ({ page, audio, loadLesson }) => {
    const practice = await startWithClock({ page, audio, loadLesson });
    await practice.markNext(true);
    await practice.listen.click();
    await practice.waitForItemAudio(2);
    await page.clock.runFor(2_000);
    expect(await practice.itemAudioCount()).toBe(2);
  });

  test("if the browser rejects the next item's audio, the Listen button pulses", async ({ page, audio, loadLesson }) => {
    await rejectAudioPlayback(page);
    await page.addInitScript(() => void (window.__rejectAudio = false)); // allowed until the mark below
    const practice = await startWithClock({ page, audio, loadLesson });
    // From here on play() is refused, as iOS would if the held-back play no longer counted as the tap's.
    await page.evaluate(() => void (window.__rejectAudio = true));
    await practice.markNext(true);
    await page.clock.runFor(CHIME_MS - 10);
    await expect(practice.listen).not.toHaveClass(/pulse/);
    await page.clock.runFor(200);
    await expect(practice.listen).toHaveClass(/pulse/);
  });
});
