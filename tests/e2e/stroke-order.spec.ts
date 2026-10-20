// Seam 1: stroke order practice (🖌️ Draw). The child hears a character, watches it drawn one stroke at a time
// over a faint outline, then taps Next. Nothing is graded: no marks, no Undo, no retry rounds. These tests step
// the drawing by hand (Next stroke); what is asserted is what the child sees, never the drawing library's SVG.
import type { Page } from '@playwright/test';
import type { ItemData, LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { setSoundEffects, setUpLearner } from './parent-driver.ts';
import { lessonGroup, PracticeScreen, rejectAudioPlayback } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** The fixture's characters by the pinyin shown once each is drawn, with their stroke counts. */
const STROKES_BY_PINYIN: Record<string, number> = { yī: 1, rén: 2, dà: 3 };

async function start({ page, audio, loadLesson }: Fixtures, options: { sounds?: boolean } = {}) {
  await setUpLearner(page);
  if (options.sounds === false) await setSoundEffects(page, false);
  const lesson = await loadLesson('fixture-strokes');
  const practice = new PracticeScreen(page, audio, lesson, 'stroke-order');
  await practice.open();
  const item = (target: string): ItemData => lesson.lists['stroke-order']!.find((i) => i.target === target)!;
  return { practice, lesson, item };
}

/** Draw the current character fully and say which one it was (from the pinyin it then shows). */
async function drawAndIdentify(practice: PracticeScreen): Promise<{ pinyin: string; taps: number }> {
  const taps = await practice.drawCharacter();
  const pinyin = (await practice.page.locator('.reveal__pinyin').textContent())!;
  return { pinyin, taps };
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
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    await expect(practice.drawing).toHaveAttribute('data-strokes-total', /^[123]$/);
    await expect(practice.nextStroke).toBeVisible();
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
    await expect(practice.nextStroke).toBeVisible();

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

    for (let drawn = 1; drawn <= total!; drawn++) {
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
      const { pinyin, taps } = await drawAndIdentify(practice);
      expect(taps).toBe(STROKES_BY_PINYIN[pinyin]);
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
