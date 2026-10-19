// Seam 1: a lesson edited while a session is active (ticket 10). The parent publishes a change between two
// loads of the app (see lesson-edits.ts); opening the session again follows the spec's reconciliation rules.
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { publishLessonEdit, withDictation } from './lesson-edits.ts';
import { setUpLearner } from './parent-driver.ts';
import { PracticeScreen } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** Start practicing a fixture lesson from the home screen. The one place this file reaches home: the real first run. */
async function start(
  { page, audio, loadLesson }: Fixtures,
  lessonId: string,
): Promise<{ practice: PracticeScreen; lesson: LessonData }> {
  await setUpLearner(page);
  const lesson = await loadLesson(lessonId);
  const practice = new PracticeScreen(page, audio, lesson);
  await practice.open();
  return { practice, lesson };
}

const without = (...targets: string[]) => (lesson: LessonData): LessonData =>
  withDictation(
    lesson,
    lesson.lists.dictation!.filter((item) => !targets.includes(item.target)),
  );

/** Item 1's target (heard on arrival), once the screen is ready for Check. */
async function currentTarget(practice: PracticeScreen): Promise<string> {
  await expect(practice.check).toBeVisible();
  return (await practice.lastHeardTarget())!;
}

test.describe('a lesson edited during practice', () => {
  test('an edited clue and pinyin show on the current item\'s reveal after reopening', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-three');
    await currentTarget(practice);
    await publishLessonEdit(page, 'fixture-three', (lesson) =>
      withDictation(
        lesson,
        lesson.lists.dictation!.map((item) => ({ ...item, clue: `新${item.clue}`, pinyin: 'xīn' })),
      ),
    );

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('0 / 3');
    const revealed = await practice.reveal();
    expect(revealed).toBeTruthy();
    await expect(page.getByText(/^新/)).toBeVisible();
    await expect(page.getByText('xīn', { exact: true })).toBeVisible();
  });

  test('an edited audio file plays on the current item after reopening', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-three');
    const current = await currentTarget(practice);
    const other = lesson.lists.dictation!.find((item) => item.target !== current)!;
    await publishLessonEdit(page, 'fixture-three', (l) =>
      withDictation(
        l,
        l.lists.dictation!.map((item) =>
          item.target === current ? { ...item, audio: { normal: other.audio.normal, slow: other.audio.slow } } : item,
        ),
      ),
    );

    await practice.reopenViaKeepGoing();
    await audio.clear();
    await practice.listen.click();

    expect(await audio.played(lesson)).toEqual([expect.objectContaining({ target: other.target, rendition: 'normal' })]);
  });

  test('removing the current item: resuming lands on the next remaining item', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-five');
    const removed = await currentTarget(practice);
    await publishLessonEdit(page, 'fixture-five', without(removed));

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('0 / 4');
    await expect(practice.check).toHaveCount(0); // a different item: its audio has not been heard yet
    await practice.listen.click();
    const next = await practice.lastHeardTarget();
    expect(next).not.toBe(removed);
    expect(lesson.lists.dictation!.map((item) => item.target)).toContain(next);
    expect(await practice.reveal()).toBe(next);
    await practice.gotIt.click();
    const rest = await practice.playRound(() => true);
    expect([next, ...rest].sort()).toEqual(
      lesson.lists.dictation!
        .map((item) => item.target)
        .filter((t) => t !== removed)
        .sort(),
    );
    await expect(practice.completion).toBeVisible();
  });

  test('removing future items: they never appear in this session', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-five');
    const current = await currentTarget(practice);
    const removed = lesson.lists.dictation!
      .map((item) => item.target)
      .filter((t) => t !== current)
      .slice(0, 2);
    await publishLessonEdit(page, 'fixture-five', without(...removed));

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('0 / 3');
    const order = await practice.playRound(() => true);
    expect(order).toHaveLength(3);
    expect(order[0]).toBe(current);
    for (const target of removed) expect(order).not.toContain(target);
    await expect(practice.completion).toBeVisible();
  });

  test('removing the last remaining items of the round shows the round summary with the counts so far', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-five');
    const marked: string[] = [];
    marked.push(await practice.reveal());
    await practice.gotIt.click();
    await expect(practice.check).toBeVisible();
    marked.push(await practice.reveal());
    await practice.notYet.click();
    await expect(practice.check).toBeVisible();
    marked.push(await practice.reveal());
    await practice.gotIt.click();
    await expect(practice.check).toBeVisible();
    const remaining = lesson.lists.dictation!.map((item) => item.target).filter((t) => !marked.includes(t));
    expect(remaining).toHaveLength(2);
    await publishLessonEdit(page, 'fixture-five', without(...remaining));

    await practice.reopenViaKeepGoing();

    await expect(practice.summary).toBeVisible();
    await expect(page.getByTestId('correct-count')).toHaveText('2');
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
    await expect(practice.progressText()).toHaveText('3 / 3');
    const order = await practice.playRetryRound(() => true);
    expect(order).toEqual([marked[1]]);
    await expect(practice.completion).toBeVisible();
  });

  test('a missed word that was removed is not offered in the next round, and the round ends if nothing is left', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-five');
    const missed = new Set(['狗', '年']);
    await practice.playRound((target) => !missed.has(target));
    await expect(practice.summary).toBeVisible();
    await publishLessonEdit(page, 'fixture-five', without('狗'));

    await practice.reopenViaKeepGoing();

    await expect(practice.summary).toBeVisible();
    await expect(page.getByText("Let's practice 1 more!")).toBeVisible();
    expect(await practice.playRetryRound(() => true)).toEqual(['年']);
    await expect(practice.completion).toBeVisible();
  });

  test('when every missed word was removed, there is nothing to retry and the session is complete', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-five');
    await practice.playRound((target) => target !== '狗');
    await expect(practice.summary).toBeVisible();
    await publishLessonEdit(page, 'fixture-five', without('狗'));

    await practice.reopenViaKeepGoing();

    await expect(practice.completion).toBeVisible();
  });

  test('marks for removed items in finished rounds are kept: the first-try score still counts them', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-five');
    const round1 = await practice.playRound((_, index) => index !== 0); // the first one presented is missed
    const missed = round1[0]!;
    await expect(practice.summary).toBeVisible();
    await practice.retry.click();
    await expect(practice.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    const removed = round1[1]!;
    await publishLessonEdit(page, 'fixture-five', without(removed));

    await practice.reopenViaKeepGoing();

    expect(await practice.playRound(() => true)).toEqual([missed]);
    await expect(practice.completion).toBeVisible();
    await expect(page.getByText('4 of 5 on the first try!')).toBeVisible();
  });

  test('an added item is not in the active session, but is in the next one', async ({ page, audio, loadLesson }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-three');
    await currentTarget(practice);
    const added = { ...lesson.lists.dictation![0]!, target: '新', clue: undefined, pinyin: 'xīn' };
    await publishLessonEdit(page, 'fixture-three', (l) => withDictation(l, [...l.lists.dictation!, added]));

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('0 / 3');
    const order = await practice.playRound(() => true);
    expect(order).toHaveLength(3);
    expect(order).not.toContain('新');
    await expect(practice.completion).toBeVisible();

    await practice.completion.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByText('4 characters')).toBeVisible();
    await practice.lessonCard().click();
    await expect(practice.progressText()).toHaveText('0 / 4');
    expect(await practice.playRound(() => true)).toContain('新');
  });

  test('removing every item stops the session with a friendly message; the child can pick a lesson again', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-three');
    await currentTarget(practice);
    await publishLessonEdit(page, 'fixture-three', (l) =>
      withDictation(
        l,
        l.lists.dictation!.map((item, i) => ({ ...item, target: `换${i}` })),
      ),
    );

    await practice.reopenViaKeepGoing();

    await expect(page.getByText('This lesson changed — pick a lesson')).toBeVisible();
    await expect(practice.listen).toHaveCount(0);
    await practice.home.click();
    await expect(practice.keepGoing).toHaveCount(0); // the old session is stopped, not waiting to resume
    await practice.lessonCard().click();
    await expect(practice.progressText()).toHaveText(`0 / ${lesson.lists.dictation!.length}`);
    const order = await practice.playRound(() => true);
    expect(order.sort()).toEqual(['换0', '换1', '换2']);
  });

  test('Undo (ticket 06) composes with a lesson edit: it is dropped when its item was removed, kept when another item was', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-five');
    const [first, second] = await practice.markMany(2);
    const third = await currentTarget(practice);
    // The last mark was on `second`; the lesson loses it, so there is nothing to take back to.
    await publishLessonEdit(page, 'fixture-five', without(second!));

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('2 / 5'); // marks made stay as history, removed item or not
    await expect(practice.undo).toHaveCount(0);
    expect(await practice.reveal()).toBe(third);

    // Another edit removes an item that is not the undo target: Undo is still there and still works.
    await practice.gotIt.click();
    const fourth = await currentTarget(practice);
    await publishLessonEdit(page, 'fixture-five', without(second!, fourth));
    await practice.reopenViaKeepGoing();
    await expect(practice.undo).toBeVisible();
    await practice.undo.click();
    await expect(practice.target).toHaveText(third);
    await expect(practice.progressText()).toHaveText('2 / 4');
    expect(first).not.toBe(third);
  });

  test('the break count (ticket 06) survives a lesson edit: marks on removed items still count towards the next break', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-twelve'); // a break every 10 marks
    const marked = await practice.markMany(8);
    const current = await currentTarget(practice);
    const unseen = lesson.lists.dictation!.map((item) => item.target).find((t) => !marked.includes(t) && t !== current)!;
    await publishLessonEdit(page, 'fixture-twelve', without(marked[7]!, unseen));

    await practice.reopenViaKeepGoing();

    await expect(practice.undo).toHaveCount(0);
    await expect(practice.progressText()).toHaveText('8 / 11');
    await expect(practice.breakPrompt).toHaveCount(0);
    await practice.markMany(2);
    // 8 + 2 marks since the last break: the prompt comes on time, not 1 late or never.
    await expect(practice.breakPrompt).toBeVisible();
    await practice.keepOn.click();
    await expect(practice.check).toBeVisible();
  });
});
