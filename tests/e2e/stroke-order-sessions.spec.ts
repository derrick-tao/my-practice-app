// Seam 1: how a Draw (stroke order) session is handled like any other: break prompts, resuming from Home, the
// profile's shuffle setting, a lesson edited during practice, and backup. The drawing itself is covered in
// stroke-order.spec.ts; here the drawing is only ever driven through the practice driver (`drawCharacter`).
import type { Page } from '@playwright/test';
import type { ItemData, LessonData } from '../../src/content/types.ts';
import { chooseBackupFile, confirmImport, exportBackup, openBackupSection } from './backup-driver.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { publishLessonEdit } from './lesson-edits.ts';
import { openSettings, setUpLearner } from './parent-driver.ts';
import { PracticeScreen, seedRandom } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

interface Options {
  breakEvery?: 0 | 5 | 10 | 15;
  shuffle?: boolean;
}

/** A learner with the given settings (default: the app's defaults), opening the lesson's Draw list from Home. */
async function start({ page, audio, loadLesson }: Fixtures, lessonId: string, options: Options = {}) {
  await setUpLearner(page);
  if (options.breakEvery !== undefined || options.shuffle === false) {
    await openSettings(page);
    if (options.breakEvery !== undefined) {
      const choice = page.getByRole('radio', { name: options.breakEvery === 0 ? 'Off' : String(options.breakEvery), exact: true });
      await choice.click();
      await expect(choice).toBeChecked(); // shows the saved value
    }
    if (options.shuffle === false) {
      const shuffle = page.getByRole('switch', { name: 'Shuffle the first round' });
      await shuffle.click();
      await expect(shuffle).not.toBeChecked();
    }
    await page.getByRole('link', { name: 'Home' }).click();
  }
  const lesson = await loadLesson(lessonId);
  const practice = new PracticeScreen(page, audio, lesson, 'stroke-order');
  await practice.open();
  return { practice, lesson };
}

/** The lesson with a different stroke-order list. */
const withStrokeOrder = (lesson: LessonData, items: ItemData[]): LessonData => ({
  ...lesson,
  lists: { ...lesson.lists, 'stroke-order': items },
});

const without = (...targets: string[]) => (lesson: LessonData): LessonData =>
  withStrokeOrder(
    lesson,
    lesson.lists['stroke-order']!.filter((item) => !targets.includes(item.target)),
  );

const listed = (lesson: LessonData): ItemData[] => lesson.lists['stroke-order']!;

/** Draw the current character fully and tap Next. */
async function drawAndNext(practice: PracticeScreen): Promise<void> {
  await practice.drawCharacter();
  await practice.next.click();
}

/** Draw and Next `count` characters in a row (stops being meaningful at a break prompt or the end). */
async function drawMany(practice: PracticeScreen, count: number): Promise<void> {
  for (let i = 0; i < count; i++) await drawAndNext(practice);
}

/** Draw the current character fully and say which one it was, from the pinyin it then shows. */
async function drawAndIdentify(practice: PracticeScreen, lesson: LessonData): Promise<string> {
  await practice.drawCharacter();
  const pinyin = (await practice.page.locator('.reveal__pinyin').textContent())!;
  return listed(lesson).find((item) => item.pinyin === pinyin)!.target;
}

/** Draw every character through to the completion screen. Returns the targets in the order they were presented. */
async function drawEverything(practice: PracticeScreen, lesson: LessonData): Promise<string[]> {
  const order: string[] = [];
  for (;;) {
    await expect(practice.drawing.or(practice.completion)).toBeVisible();
    if (await practice.completion.isVisible()) break;
    order.push(await drawAndIdentify(practice, lesson));
    await practice.next.click();
  }
  return order;
}

/** What the child hears when asking for the current character again (a resumed session does not play by itself). */
async function heardNow(practice: PracticeScreen): Promise<string> {
  const before = await practice.itemAudioCount();
  await practice.listen.click();
  await practice.waitForItemAudio(before + 1);
  return (await practice.lastHeardTarget())!;
}

// Drawing a character stroke by stroke takes about a second per stroke, so a session of several characters is long.
test.describe.configure({ timeout: 90_000 });

test.describe('stroke order: break prompt', () => {
  test('is offered after the 5th Next tap and not before; Keep going carries on, and the count starts again', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-eleven-strokes', { breakEvery: 5 });
    await drawMany(practice, 4);
    await expect(practice.breakPrompt).toHaveCount(0);
    await expect(practice.drawing).toBeVisible();

    await drawAndNext(practice); // the 5th
    await expect(practice.breakPrompt).toBeVisible();
    await expect(practice.breakPrompt).toContainText('Great job! Take a break?');
    await expect(practice.keepOn).toBeVisible();
    await expect(practice.takeBreak).toBeVisible();
    await expect(practice.drawing).toHaveCount(0);
    await expect(practice.progressText()).toHaveText('5 / 11');
    // Nothing to take back: Next sets no Undo, not even on the prompt.
    await expect(practice.undo).toHaveCount(0);

    // The prompt is saved: it is still there when the app is reopened.
    await practice.reopenViaKeepGoing();
    await expect(practice.breakPrompt).toBeVisible();

    await practice.keepOn.click();
    await expect(practice.breakPrompt).toHaveCount(0);
    await expect(practice.progressText()).toHaveText('5 / 11');
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    await expect(practice.next).toHaveCount(0);

    await drawMany(practice, 4); // 4 more since the prompt: not yet
    await expect(practice.breakPrompt).toHaveCount(0);
    await drawAndNext(practice); // the 5th since the prompt
    await expect(practice.breakPrompt).toBeVisible();
    await expect(practice.progressText()).toHaveText('10 / 11');
  });

  test('Break goes home; Keep going there resumes at the next character, and the count starts again', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-eleven-strokes', { breakEvery: 5 });
    await drawMany(practice, 5);
    await expect(practice.breakPrompt).toBeVisible();

    await practice.takeBreak.click();

    await expect(page).toHaveURL(/#\/$/);
    await expect(practice.keepGoing).toBeVisible();
    await practice.keepGoing.click();
    await expect(practice.breakPrompt).toHaveCount(0);
    await expect(practice.progressText()).toHaveText('5 / 11');
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');

    await drawMany(practice, 4);
    await expect(practice.breakPrompt).toHaveCount(0);
    await drawAndNext(practice);
    await expect(practice.breakPrompt).toBeVisible();
  });

  test('with breaks off it never appears', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-eleven-strokes', { breakEvery: 0 });
    await drawMany(practice, 10); // past the default cadence of 10
    await expect(practice.progressText()).toHaveText('10 / 11');
    await expect(practice.breakPrompt).toHaveCount(0);
    await expect(practice.drawing).toBeVisible();
  });
});

const CLOCK_START = new Date('2026-10-19T09:00:00.000Z');

test.describe('stroke order: leaving and coming back', () => {
  test('Home has a Keep going card for Draw; opening it returns to the same character, redrawn from its first stroke', async ({
    page,
    audio,
    loadLesson,
  }) => {
    // The clock runs in real time until it is frozen on the resumed character below. Unshuffled, the third character
    // is 二, two strokes: it is left once its first stroke is drawn.
    await page.clock.install({ time: CLOCK_START });
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-eleven-strokes', { shuffle: false });
    await drawMany(practice, 2);
    await expect(practice.progressText()).toHaveText('2 / 11');
    await expect.poll(() => practice.itemAudioCount()).toBe(3);
    const third = (await practice.lastHeardTarget())!;
    expect(third).toBe('二');
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', /^[12]$/);

    await practice.home.click();

    await expect(page.getByRole('group', { name: 'Keep going: Fixture Eleven Strokes, Draw' })).toBeVisible();
    // The resumed character auto-plays from its first stroke; freeze the clock just after that stroke begins.
    await practice.keepGoing.click();
    await expect(page).toHaveURL(/#\/chinese\/stroke-order\/fixture-eleven-strokes$/);
    await expect(practice.progressText()).toHaveText('2 / 11');
    await expect(practice.drawing).toHaveAttribute('data-strokes-total', '2');
    await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 150));
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    await expect(practice.replay).toBeVisible();
    await page.clock.resume();
    // A resumed session waits for a tap before playing (iOS gesture rules); the tap plays the same character.
    expect(await practice.itemAudioCount()).toBe(3);
    expect(await heardNow(practice)).toBe(third);
    // Drawing it again and moving on carries the session on from there.
    expect(await drawAndIdentify(practice, lesson)).toBe(third);
    await practice.next.click();
    await expect(practice.progressText()).toHaveText('3 / 11');
  });

  test('a reload part way through a character comes back to it too', async ({ page, audio, loadLesson }) => {
    await page.clock.install({ time: CLOCK_START }); // runs in real time until frozen on the reloaded character
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-eleven-strokes');
    await drawAndNext(practice);
    await expect.poll(() => practice.itemAudioCount()).toBe(2);
    const second = (await practice.lastHeardTarget())!;

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('1 / 11');
    await expect(practice.drawing).toHaveAttribute('data-strokes-total', /^\d+$/);
    await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 150)); // just into the first stroke
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    await page.clock.resume();
    expect(await heardNow(practice)).toBe(second);
  });
});

test.describe('stroke order: the shuffle setting', () => {
  test('shuffles the list, and the same seed gives the same order every time', async ({ page, audio, loadLesson }) => {
    await seedRandom(page, 7);
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-strokes');
    const listOrder = listed(lesson).map((item) => item.target);

    const order = await drawEverything(practice, lesson);

    expect([...order].sort()).toEqual([...listOrder].sort());
    expect(order).not.toEqual(listOrder);

    // Finishing leaves nothing to resume: the lesson's card starts a new session, shuffled from the same seed.
    await page.goto('./');
    await practice.lessonCard().click();
    await expect(practice.progressText()).toHaveText('0 / 3');
    expect(await drawEverything(practice, lesson)).toEqual(order);
  });

  test('with shuffle off the list keeps its order', async ({ page, audio, loadLesson }) => {
    await seedRandom(page, 7);
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-strokes', { shuffle: false });
    expect(await drawEverything(practice, lesson)).toEqual(listed(lesson).map((item) => item.target));
  });
});

test.describe('stroke order: a lesson edited during practice', () => {
  test('removing characters still to come: they never appear in this session', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-strokes');
    await expect.poll(() => practice.itemAudioCount()).toBe(1);
    const current = (await practice.lastHeardTarget())!;
    const removed = listed(lesson).find((item) => item.target !== current)!;
    await publishLessonEdit(page, 'fixture-strokes', without(removed.target));

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('0 / 2');
    expect(await heardNow(practice)).toBe(current);
    const order = await drawEverything(practice, lesson);
    expect(order[0]).toBe(current);
    expect(order).not.toContain(removed.target);
    await expect(practice.completion).toContainText('2 characters drawn');
  });

  test('removing the current character: resuming lands on one that is left, and the rest follow', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-strokes');
    await expect.poll(() => practice.itemAudioCount()).toBe(1);
    const removed = (await practice.lastHeardTarget())!;
    await publishLessonEdit(page, 'fixture-strokes', without(removed));

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('0 / 2');
    const heard = await heardNow(practice);
    expect(heard).not.toBe(removed);
    const order = await drawEverything(practice, lesson);
    expect(order[0]).toBe(heard);
    expect([...order].sort()).toEqual(
      listed(lesson)
        .map((item) => item.target)
        .filter((t) => t !== removed)
        .sort(),
    );
    await expect(practice.completion).toContainText('2 characters drawn');
  });

  test('removing every character still to come finishes the session with what was drawn', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-strokes');
    const first = await drawAndIdentify(practice, lesson);
    await practice.next.click();
    await expect(practice.progressText()).toHaveText('1 / 3');
    await publishLessonEdit(page, 'fixture-strokes', (l) => withStrokeOrder(l, listed(l).filter((item) => item.target === first)));

    await practice.reopenViaKeepGoing();

    await expect(practice.completion).toBeVisible();
    await expect(practice.completion).toContainText('1 character drawn');
    await expect(practice.drawing).toHaveCount(0);
  });

  test('removing every character of the session stops it with the lesson-changed notice', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-strokes');
    await expect.poll(() => practice.itemAudioCount()).toBe(1); // the session has begun
    await expect(practice.drawing).toBeVisible();
    // The parent replaced all three characters with another one.
    await publishLessonEdit(page, 'fixture-strokes', (l) => withStrokeOrder(l, [{ ...listed(l)[0]!, target: '山' }]));

    await practice.reopenViaKeepGoing();

    await expect(page.getByTestId('lesson-changed')).toContainText('This lesson changed');
    await expect(practice.drawing).toHaveCount(0);
    await expect(practice.next).toHaveCount(0);
  });

  test('the break count survives an edit: Next taps on characters since removed still count towards the next break', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-eleven-strokes', { breakEvery: 5 });
    const drawn: string[] = [];
    for (let i = 0; i < 3; i++) {
      drawn.push(await drawAndIdentify(practice, lesson));
      await practice.next.click();
    }
    await expect.poll(() => practice.itemAudioCount()).toBe(4);
    const current = (await practice.lastHeardTarget())!;
    const unseen = listed(lesson).map((item) => item.target).find((t) => !drawn.includes(t) && t !== current)!;
    await publishLessonEdit(page, 'fixture-eleven-strokes', without(drawn[2]!, unseen));

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('3 / 10');
    await expect(practice.breakPrompt).toHaveCount(0);
    await drawMany(practice, 2);
    // 3 + 2 Next taps since the last break: the prompt comes on time.
    await expect(practice.breakPrompt).toBeVisible();
    await practice.keepOn.click();
    await expect(practice.drawing).toBeVisible();
  });
});

test.describe('stroke order: backup', () => {
  test('a Draw session in progress is in the backup, and restoring it brings the session back where it was', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-strokes');
    await drawAndNext(practice);
    await expect(practice.progressText()).toHaveText('1 / 3');

    await page.goto('./');
    await openBackupSection(page);
    const { backup, text } = await exportBackup(page);
    const [saved] = backup.data.sessions;
    expect(saved).toMatchObject({ practiceType: 'stroke-order', lessonId: 'fixture-strokes', status: 'active', marksSinceBreak: 1 });
    const [round] = saved!.rounds as Array<{ itemIds: string[]; position: number }>;
    expect(round!.position).toBe(1);

    // Carry on to the end: nothing is left to resume.
    await page.goto('./');
    await practice.keepGoing.click();
    await drawEverything(practice, lesson);
    await page.goto('./');
    await expect(practice.keepGoing).toHaveCount(0);

    await openBackupSection(page);
    await chooseBackupFile(page, text);
    await confirmImport(page);
    await page.goto('./');
    await practice.keepGoing.click();

    await expect(practice.progressText()).toHaveText('1 / 3');
    await expect(practice.drawing).toHaveAttribute('data-strokes-drawn', '0');
    // The rest of the session is the saved one, in the saved order.
    const rest: string[] = [];
    for (let i = 1; i < round!.itemIds.length; i++) {
      rest.push(await drawAndIdentify(practice, lesson));
      await practice.next.click();
    }
    expect(rest).toEqual(round!.itemIds.slice(1));
    await expect(practice.completion).toContainText('3 characters drawn');
  });
});
