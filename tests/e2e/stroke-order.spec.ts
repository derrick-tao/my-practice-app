// Seam 1: stroke order practice (🖌️ Draw). The child hears a character, watches it drawn one stroke at a time
// over a faint outline, then taps Next. Nothing is graded: no marks, no Undo, no retry rounds. The drawing plays by
// itself; most tests pause it and step by hand (Next stroke), and the auto-play tests drive the page clock. What is
// asserted is what the child sees, never the drawing library's SVG.
import type { Page } from '@playwright/test';
import type { ItemData, LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { setSoundEffects, setStrokeTiming, setUpLearner } from './parent-driver.ts';
import { lessonGroup, PracticeScreen, rejectAudioPlayback, seedRandom } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** The fixture's characters by the pinyin shown once each is drawn, with their stroke counts. */
const STROKES_BY_PINYIN: Record<string, number> = { yī: 1, rén: 2, dà: 3 };

interface StartOptions {
  sounds?: boolean;
  speed?: 'Slow' | 'Normal' | 'Fast';
  pauseSeconds?: 2 | 3 | 5 | 8;
}

async function start({ page, audio, loadLesson }: Fixtures, options: StartOptions = {}) {
  await setUpLearner(page);
  if (options.sounds === false) await setSoundEffects(page, false);
  if (options.speed !== undefined || options.pauseSeconds !== undefined) await setStrokeTiming(page, options);
  const lesson = await loadLesson('fixture-strokes');
  const practice = new PracticeScreen(page, audio, lesson, 'stroke-order');
  await practice.open();
  const item = (target: string): ItemData => lesson.lists['stroke-order']!.find((i) => i.target === target)!;
  return { practice, lesson, item };
}

/** Draw the current character fully and say which one it was (from the pinyin it then shows). */
async function drawAndIdentify(practice: PracticeScreen): Promise<{ pinyin: string; strokes: number }> {
  const strokes = await practice.drawCharacter();
  const pinyin = (await practice.page.locator('.reveal__pinyin').textContent())!;
  return { pinyin, strokes };
}

test.describe('stroke order: the Draw button', () => {
  test('shows only for the lesson that has a stroke-order list, between Write and Say', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    await page.goto('./');

    const strokes = lessonGroup(page, 'Fixture Strokes');
    await expect(strokes.getByRole('link')).toHaveText([/^✏️ Write · 1 character\b/, /^🖌️ Draw · 3 characters\b/, /^🗣️ Say · 1 phrase\b/]);
    for (const title of ['Fixture Three', 'Fixture Five', 'Fixture Twelve']) {
      await expect(lessonGroup(page, title).getByRole('link', { name: /Draw/ })).toHaveCount(0);
    }
  });

  test('opens the list at its own address', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await expect(page).toHaveURL(/#\/chinese\/stroke-order\/fixture-strokes$/);
    await expect(practice.progressText()).toHaveText('0 / 3');
  });
});

test.describe('stroke order: arriving at a character', () => {
  test('requests the character audio and shows the faint outline with no strokes drawn yet', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });

    await expect(practice.drawing).toBeVisible();
    await expect(practice.drawing).toHaveAttribute('data-strokes-total', /^[123]$/);
    await expect(practice.pause).toBeVisible();
    await expect.poll(() => audio.played(lesson)).toEqual([
      expect.objectContaining({ practiceType: 'stroke-order', rendition: 'normal' }),
    ]);
  });

  test('Listen and Slow request the audio again', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });
    await expect(practice.listen).toBeVisible();
    await practice.slow.click();
    await expect.poll(async () => (await audio.played(lesson)).at(-1)).toEqual(
      expect.objectContaining({ practiceType: 'stroke-order', rendition: 'slow' }),
    );
    await practice.listen.click();
    await expect.poll(async () => (await audio.played(lesson)).at(-1)?.rendition).toBe('normal');
  });

  test('has no ✅/❌, Check, Undo or round badge, and Next is hidden', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await expect(practice.pause).toBeVisible();

    await expect(practice.gotIt).toHaveCount(0);
    await expect(practice.notYet).toHaveCount(0);
    await expect(practice.check).toHaveCount(0);
    await expect(practice.undo).toHaveCount(0);
    await expect(practice.roundBadge).toHaveCount(0);
    await expect(practice.next).toHaveCount(0);
    await expect(page.locator('.reveal__pinyin')).toHaveCount(0);
  });

  test('when the browser rejects the arrival audio, Listen pulses', async ({ page, audio, loadLesson }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await rejectAudioPlayback(page);
    const { practice } = await start({ page, audio, loadLesson });
    await expect(practice.listen).toHaveClass(/pulse/);
  });
});

test.describe('stroke order: drawing a character by hand', () => {
  test('each tap on Next stroke draws one stroke; Next, the pinyin and the clue appear only after the last', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson });
    await expect(practice.drawing).toHaveAttribute('data-strokes-total', /^[123]$/);
    const { total } = await practice.strokes();
    await practice.pause.click();
    // A stroke being drawn when the pause lands finishes first; the taps carry on from there.
    await expect(practice.nextStroke.or(practice.next)).toBeEnabled();

    for (let drawn = (await practice.strokes()).drawn + 1; drawn <= total!; drawn++) {
      await expect(practice.next).toHaveCount(0);
      await expect(page.locator('.reveal__pinyin')).toHaveCount(0);
      await practice.nextStroke.click();
      await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', String(drawn));
    }

    await expect(practice.next).toBeVisible();
    await expect(practice.nextStroke).toHaveCount(0);
    const pinyin = (await page.locator('.reveal__pinyin').textContent())!;
    expect(STROKES_BY_PINYIN[pinyin]).toBe(total);
    await expect(page.locator('.reveal__clue')).toBeVisible();
    // Still nothing to grade.
    await expect(practice.gotIt).toHaveCount(0);
    await expect(practice.undo).toHaveCount(0);
  });

  test('Next does not wait for the character audio to be heard', async ({ page, audio, loadLesson }) => {
    await rejectAudioPlayback(page);
    const { practice } = await start({ page, audio, loadLesson });
    await practice.drawCharacter();
    await practice.next.click();
    await expect(practice.progressText()).toHaveText('1 / 3');
  });

  test('if the stroke data cannot be loaded, Next is offered so the child is never stuck', async ({ page, audio, loadLesson }) => {
    await page.route('**/content/strokes/*.json', (route) => route.abort());
    const { practice } = await start({ page, audio, loadLesson });
    await expect(practice.next).toBeVisible();
    await practice.next.click();
    await expect(practice.progressText()).toHaveText('1 / 3');
  });
});

test.describe('stroke order: moving on and finishing', () => {
  test('Next plays the chime, requests the next character, and the star bar moves', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });
    await practice.drawCharacter();
    expect(await audio.effects()).toEqual([]);

    await practice.next.click();

    await expect(practice.progressText()).toHaveText('1 / 3');
    await expect.poll(() => audio.effects()).toEqual(['chime']);
    // The next character starts again from its first stroke, and its audio follows the chime.
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    await expect(practice.next).toHaveCount(0);
    await expect.poll(() => audio.played(lesson)).toHaveLength(2);
    await expect(practice.roundBadge).toHaveCount(0);
  });

  test('drawing every character completes the session: celebration, fanfare, "3 characters drawn"', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson });

    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { pinyin, strokes } = await drawAndIdentify(practice);
      expect(strokes).toBe(STROKES_BY_PINYIN[pinyin]);
      seen.push(pinyin);
      await practice.next.click();
    }

    expect(seen.sort()).toEqual(['dà', 'rén', 'yī']);
    await expect(practice.completion).toBeVisible();
    await expect(practice.completion).toContainText('You did it!');
    await expect(practice.completion).toContainText('3 characters drawn');
    await expect(practice.completion).not.toContainText('first try');
    await expect(practice.completion).not.toContainText('Rounds');
    await expect(practice.summary).toHaveCount(0);
    await expect.poll(() => audio.effects()).toEqual(['chime', 'chime', 'fanfare']);
    expect((await audio.played(lesson)).map((p) => p.practiceType)).toEqual(['stroke-order', 'stroke-order', 'stroke-order']);
  });

  test('with sounds off there is no chime or fanfare, but the character audio still plays', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, { sounds: false });
    for (let i = 0; i < 3; i++) {
      await practice.drawCharacter();
      await practice.next.click();
    }
    await expect(practice.completion).toContainText('3 characters drawn');
    expect(await audio.effects()).toEqual([]);
    expect(await audio.played(lesson)).toHaveLength(3);
  });
});

// The next character's audio follows the chime instead of playing over it, within the window iOS allows.
test.describe("stroke order: the next character's audio waits for the chime", () => {
  const CHIME_MS = 700;

  test('is requested only once the chime has ended', async ({ page, audio, loadLesson }) => {
    await page.clock.install();
    const { practice, lesson } = await start({ page, audio, loadLesson });
    await practice.drawCharacter();
    await page.clock.pauseAt(Date.now() + 1_000);

    await practice.next.click();
    await expect.poll(() => audio.effects()).toEqual(['chime']);

    await page.clock.runFor(CHIME_MS - 10);
    expect(await practice.itemAudioCount()).toBe(1);
    await page.clock.runFor(200);
    await expect.poll(() => audio.played(lesson)).toHaveLength(2);
  });
});

// Auto-play: a stroke about every 4 s (about 1 s drawing, then 3 s to copy it), driven by the page clock so no test
// waits for real. The clock is paused as soon as the character has loaded, a few milliseconds into its first stroke,
// so what happens next is up to the test.
test.describe('stroke order: auto-play', () => {
  const CLOCK_START = new Date('2026-10-19T09:00:00.000Z');
  const STEP_MS = 50;
  /** A stroke is drawn in about a second, then the drawing waits 3 s so the child can copy it. */
  const DRAW_MAX_MS = 1_300;
  const PAUSE_MS = 3_000;

  /** With the seeded shuffle's first character: 大, 3 strokes (then 一, then 人). */
  async function startOnClock(fixtures: Fixtures, options: StartOptions = {}) {
    await seedRandom(fixtures.page, 1);
    await fixtures.page.clock.install({ time: CLOCK_START });
    const started = await start(fixtures, options);
    await expect(started.practice.drawing).toHaveAttribute('data-strokes-total', '3');
    const now = await fixtures.page.evaluate(() => Date.now());
    await fixtures.page.clock.pauseAt(new Date(now + 150));
    await expect(started.practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    return started;
  }

  /** Run the clock in small steps until `n` strokes are drawn; says how long that took. */
  async function runUntilDrawn(page: Page, practice: PracticeScreen, n: number, limitMs: number): Promise<number> {
    for (let elapsed = 0; elapsed <= limitMs; elapsed += STEP_MS) {
      if ((await practice.strokes()).drawn === n) return elapsed;
      await page.clock.runFor(STEP_MS);
    }
    throw new Error(`${n} strokes not drawn within ${limitMs} ms (${(await practice.strokes()).drawn} drawn)`);
  }

  test('draws a stroke by itself, then the next after a 3 s pause, and offers Next right after the last', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await expect(practice.pause).toBeVisible();

    expect(await runUntilDrawn(page, practice, 1, DRAW_MAX_MS)).toBeGreaterThan(0);
    // Nothing more for the child to copy until the pause is over.
    await page.clock.runFor(PAUSE_MS - 200);
    expect(await practice.strokes()).toEqual({ drawn: 1, total: 3 });
    expect(await runUntilDrawn(page, practice, 2, 200 + DRAW_MAX_MS)).toBeGreaterThan(200);

    await page.clock.runFor(PAUSE_MS - 200);
    expect(await practice.strokes()).toEqual({ drawn: 2, total: 3 });
    await expect(practice.next).toHaveCount(0);
    await expect(page.locator('.reveal__pinyin')).toHaveCount(0);
    await runUntilDrawn(page, practice, 3, 200 + DRAW_MAX_MS);

    // The last stroke is followed by the pinyin, the clue and Next, not by another pause.
    await expect(practice.next).toBeVisible();
    await expect(page.locator('.reveal__pinyin')).toHaveText('dà');
    await expect(page.locator('.reveal__clue')).toBeVisible();
    await expect(practice.pause).toHaveCount(0);
  });

  test('the learner\'s pause setting sets how long the drawing waits after each stroke: 8 s', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson }, { pauseSeconds: 8 });
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);

    await page.clock.runFor(8_000 - 200); // well past the default 3 s
    expect(await practice.strokes()).toEqual({ drawn: 1, total: 3 });
    expect(await runUntilDrawn(page, practice, 2, 200 + DRAW_MAX_MS)).toBeGreaterThan(200);
  });

  test('the learner\'s pause setting sets how long the drawing waits after each stroke: 2 s', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson }, { pauseSeconds: 2 });
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);

    await page.clock.runFor(2_000 - 200);
    expect(await practice.strokes()).toEqual({ drawn: 1, total: 3 });
    // Stroke 2 is drawn well before the default 3 s pause plus a stroke would allow.
    expect(await runUntilDrawn(page, practice, 2, 200 + DRAW_MAX_MS)).toBeGreaterThan(200);
  });

  test('the learner\'s speed setting sets how long each stroke takes to draw', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson }, { speed: 'Slow' });
    // The default takes up to DRAW_MAX_MS; slow takes about twice that, so still nothing drawn by then.
    await page.clock.runFor(DRAW_MAX_MS);
    expect((await practice.strokes()).drawn).toBe(0);
    await runUntilDrawn(page, practice, 1, 3_000);
  });

  test('a fast speed setting draws a stroke in about half a second', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson }, { speed: 'Fast' });
    await runUntilDrawn(page, practice, 1, 500);
  });

  test('⏸ stops the drawing, before the next stroke begins', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);
    await page.clock.runFor(1_000); // in the pause after the first stroke

    await practice.pause.click();
    await expect(practice.play).toBeVisible();
    await expect(practice.pause).toHaveCount(0);
    await page.clock.runFor(30_000);

    expect(await practice.strokes()).toEqual({ drawn: 1, total: 3 });
    await expect(practice.next).toHaveCount(0);
  });

  test('⏸ while a stroke is being drawn lets that stroke finish, then stops', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await page.clock.runFor(100); // the first stroke is under way

    await practice.pause.click();
    await page.clock.runFor(30_000);

    expect(await practice.strokes()).toEqual({ drawn: 1, total: 3 });
  });

  test('while paused, each tap on Next stroke draws one stroke; ▶ is offered and Next stroke is not', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await expect(practice.nextStroke).toHaveCount(0);
    await practice.pause.click();
    await page.clock.runFor(DRAW_MAX_MS); // the stroke begun on arrival finishes
    expect((await practice.strokes()).drawn).toBe(1);

    await expect(practice.nextStroke).toBeEnabled();
    await practice.nextStroke.click();
    await expect(practice.nextStroke).toBeDisabled(); // one stroke at a time
    await runUntilDrawn(page, practice, 2, DRAW_MAX_MS);
    await page.clock.runFor(30_000);
    expect((await practice.strokes()).drawn).toBe(2); // and only the one

    await practice.nextStroke.click();
    await runUntilDrawn(page, practice, 3, DRAW_MAX_MS);
    await expect(practice.next).toBeVisible();
    await expect(practice.nextStroke).toHaveCount(0);
    await expect(practice.play).toHaveCount(0);
  });

  test('▶ resumes the auto-play from the current stroke, to the end', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);
    await practice.pause.click();
    await page.clock.runFor(10_000);
    expect((await practice.strokes()).drawn).toBe(1);

    await practice.play.click();
    await expect(practice.pause).toBeVisible();
    await expect(practice.nextStroke).toHaveCount(0);
    await runUntilDrawn(page, practice, 2, PAUSE_MS + DRAW_MAX_MS);
    await runUntilDrawn(page, practice, 3, PAUSE_MS + DRAW_MAX_MS);
    await expect(practice.next).toBeVisible();
  });

  test('▶ pressed while a stroke is being drawn lets it finish, then the normal pause follows', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await page.clock.runFor(100); // the first stroke is under way
    await practice.pause.click();
    await practice.play.click();

    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);
    await page.clock.runFor(PAUSE_MS - 200);
    expect((await practice.strokes()).drawn).toBe(1); // still copying stroke 1
    await runUntilDrawn(page, practice, 2, 200 + DRAW_MAX_MS);
  });

  test('▶ pressed between strokes starts the next one at once', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);
    await practice.pause.click();
    await page.clock.runFor(10_000);

    await practice.play.click();
    await runUntilDrawn(page, practice, 2, DRAW_MAX_MS); // no 3 s wait
  });

  test('↺ pressed while a stroke is being drawn restarts from the first, with nothing left over from the old run', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);
    await page.clock.runFor(PAUSE_MS + 100); // stroke 2 is under way
    expect((await practice.strokes()).drawn).toBe(1);

    await practice.replay.click();
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    // Stroke 2 of the old run would finish here; only stroke 1 of the new one may be counted.
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);
    await page.clock.runFor(PAUSE_MS - 200);
    expect(await practice.strokes()).toEqual({ drawn: 1, total: 3 });
    await runUntilDrawn(page, practice, 2, 200 + DRAW_MAX_MS);
  });

  test('↺ clears the strokes and replays from the first one, auto-playing', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await runUntilDrawn(page, practice, 2, 2 * DRAW_MAX_MS + PAUSE_MS);

    await practice.replay.click();
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    await expect(practice.pause).toBeVisible();
    // It plays again from stroke 1 on the same schedule.
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);
    await page.clock.runFor(PAUSE_MS - 200);
    expect((await practice.strokes()).drawn).toBe(1);
    await runUntilDrawn(page, practice, 2, 200 + DRAW_MAX_MS);
  });

  test('↺ works while paused, and after the last stroke (the pinyin, clue and Next go until it is drawn again)', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await practice.pause.click();
    await page.clock.runFor(DRAW_MAX_MS);
    await practice.nextStroke.click();
    await runUntilDrawn(page, practice, 2, DRAW_MAX_MS);

    await practice.replay.click();
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    await expect(practice.pause).toBeVisible(); // replaying means playing, even from a pause
    await runUntilDrawn(page, practice, 3, 3 * (PAUSE_MS + DRAW_MAX_MS));
    await expect(practice.next).toBeVisible();

    await practice.replay.click();
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    await expect(practice.next).toHaveCount(0);
    await expect(page.locator('.reveal__pinyin')).toHaveCount(0);
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS);
  });

  test('has no previous-stroke control', async ({ page, audio, loadLesson }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await practice.pause.click();
    await expect(page.getByRole('button', { name: /previous|back|undo/i })).toHaveCount(0);
  });

  test('the next character starts playing by itself, even after the last was stepped by hand', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await practice.pause.click();
    await page.clock.runFor(DRAW_MAX_MS);
    for (const drawn of [2, 3]) {
      await practice.nextStroke.click();
      await runUntilDrawn(page, practice, drawn, DRAW_MAX_MS);
    }
    await practice.next.click();

    await expect(practice.progressText()).toHaveText('1 / 3');
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    await expect(practice.pause).toBeVisible(); // not left paused
    await runUntilDrawn(page, practice, 1, 2 * DRAW_MAX_MS); // 一, one stroke
    await expect(practice.next).toBeVisible();
  });

  test('leaving the screen mid-drawing leaves nothing running on the next screen', async ({ page, audio, loadLesson }) => {
    // Not ours: the app's service-worker update check fails the same way on any screen once the clock runs on.
    const errors: string[] = [];
    page.on('pageerror', (error) => !/\.waiting/.test(error.message) && errors.push(error.message));
    const { practice } = await startOnClock({ page, audio, loadLesson });
    await runUntilDrawn(page, practice, 1, DRAW_MAX_MS); // waiting out the pause before stroke 2

    await practice.home.click();
    await expect(page.getByRole('heading', { name: /^Hi / })).toBeVisible();
    await page.clock.runFor(30_000);

    await expect(practice.drawing).toHaveCount(0);
    expect(errors).toEqual([]);
    await expect(page.getByRole('heading', { name: /^Hi / })).toBeVisible();
  });
});
