// Seam 1: a session in progress for every list (ticket 23). A learner can have one session per lesson and
// practice type, all at once: opening a list never stops another one, and home has a Keep going card
// for each, the most recently used first. Everything goes through the screens; the saved history is read
// through a backup export on a second tab (see saved-sessions.ts).
import type { Locator, Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { restoreSessions, type SessionJson } from './backup-driver.ts';
import { publishLessonEdit } from './lesson-edits.ts';
import { openParentArea, openParentSection, setUpLearner } from './parent-driver.ts';
import { lessonGroup, PracticeScreen } from './practice-driver.ts';
import { savedSessions } from './saved-sessions.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** Open a lesson from its home card and mark `marks` items, then go home (the last mark saved once the next item is ready). */
async function practiceThenHome(
  { page, audio, loadLesson }: Fixtures,
  lessonId: string,
  marks: number,
): Promise<PracticeScreen> {
  const practice = new PracticeScreen(page, audio, await loadLesson(lessonId));
  await practice.lessonCard().click();
  await practice.markMany(marks);
  await expect(practice.check).toBeVisible();
  await practice.home.click();
  return practice;
}

/** The Keep going cards on home, in the order shown. */
const cards = (page: Page): Locator => page.getByRole('group', { name: /^Keep going/ });
/** The Keep going card for one lesson's list. */
const cardFor = (page: Page, title: string): Locator => page.getByRole('group', { name: new RegExp(`^Keep going: ${title}`) });

test.describe('a session in progress for every list', () => {
  test('dictation half done on lesson A, then dictation on lesson B: no gate, two cards with B first, each resumes at its exact place', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    const three = await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 2);

    const five = new PracticeScreen(page, audio, await loadLesson('fixture-five'));
    await five.lessonCard().click();
    await expect(page.getByText('Stop your current practice?')).toHaveCount(0);
    await expect(five.progressText()).toHaveText('0 / 5');
    await five.markMany(1);
    await expect(five.check).toBeVisible();
    await five.home.click();

    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).nth(0)).toContainText('Fixture Five');
    await expect(cards(page).nth(1)).toContainText('Fixture Three');
    await expect(cards(page).nth(0)).toContainText('✏️ Write');
    await expect(cards(page).nth(0).getByTestId('progress-text')).toHaveText('1 / 5');
    await expect(cards(page).nth(1).getByTestId('progress-text')).toHaveText('2 / 3');

    await cardFor(page, 'Fixture Three').getByRole('link').click();
    await expect(three.progressText()).toHaveText('2 / 3');
    await three.home.click();
    await cardFor(page, 'Fixture Five').getByRole('link').click();
    await expect(five.progressText()).toHaveText('1 / 5');

    expect((await savedSessions(page)).map((s) => [s.lessonId, s.status])).toEqual([
      ['fixture-three', 'active'],
      ['fixture-five', 'active'],
    ]);
  });

  test('dictation half done, then phrase recognition of the same lesson: no gate, two cards with the phrase one first, each resumes at its exact place', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    const lesson = await loadLesson('fixture-five');
    const write = await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 2);

    const say = new PracticeScreen(page, audio, lesson, 'phrase-recognition');
    await say.lessonCard().click();
    await expect(page.getByText('Stop your current practice?')).toHaveCount(0);
    await expect(say.progressText()).toHaveText('0 / 6');
    await say.markMany(1);
    await expect(say.check).toBeVisible();
    await say.home.click();

    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).nth(0)).toHaveAccessibleName('Keep going: Fixture Five, Say');
    await expect(cards(page).nth(1)).toHaveAccessibleName('Keep going: Fixture Five, Write');
    await expect(cards(page).nth(0)).toContainText('🗣️ Say');
    await expect(cards(page).nth(0).getByTestId('progress-text')).toHaveText('1 / 6');
    await expect(cards(page).nth(1).getByTestId('progress-text')).toHaveText('2 / 5');

    await page.getByRole('group', { name: 'Keep going: Fixture Five, Write' }).getByRole('link').click();
    await expect(write.progressText()).toHaveText('2 / 5');
    await write.home.click();
    await page.getByRole('group', { name: 'Keep going: Fixture Five, Say' }).getByRole('link').click();
    await expect(say.progressText()).toHaveText('1 / 6');

    expect((await savedSessions(page)).map((s) => [s.practiceType, s.status])).toEqual([
      ['dictation', 'active'],
      ['phrase-recognition', 'active'],
    ]);
  });

  test('Start over on one card leaves the other session untouched; the stopped one shows as stopped on the progress page', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    const three = await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 2);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 3);

    await cardFor(page, 'Fixture Five').getByRole('button', { name: 'Start over' }).click();
    await expect(page.getByText('Start again from the beginning?')).toBeVisible();
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    const five = new PracticeScreen(page, audio, await loadLesson('fixture-five'));
    await expect(five.progressText()).toHaveText('0 / 5');
    await five.home.click();

    await expect(cards(page)).toHaveCount(2);
    await expect(cardFor(page, 'Fixture Five').getByTestId('progress-text')).toHaveText('0 / 5');
    await expect(cardFor(page, 'Fixture Three').getByTestId('progress-text')).toHaveText('2 / 3');
    await cardFor(page, 'Fixture Three').getByRole('link').click();
    await expect(three.progressText()).toHaveText('2 / 3');

    expect((await savedSessions(page)).map((s) => [s.lessonId, s.status])).toEqual([
      ['fixture-three', 'active'],
      ['fixture-five', 'stopped'],
      ['fixture-five', 'active'],
    ]);

    await three.home.click();
    await openParentArea(page);
    await openParentSection(page, 'Progress');
    await page.getByRole('link', { name: /Fixture Five/ }).click();
    const attempts = page.getByTestId('attempt');
    await expect(attempts).toHaveCount(2);
    await expect(attempts.filter({ hasText: 'Stopped' })).toHaveCount(1);
    await expect(attempts.filter({ hasText: 'In progress' })).toHaveCount(1);
  });

  test('resuming the older session moves its card to the top', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 1);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 1);
    await expect(cards(page).nth(0)).toContainText('Fixture Five');

    await cardFor(page, 'Fixture Three').getByRole('link').click();
    await new PracticeScreen(page, audio, await loadLesson('fixture-three')).home.click();

    await expect(cards(page).nth(0)).toContainText('Fixture Three');
    await expect(cards(page).nth(1)).toContainText('Fixture Five');
  });

  test('opening a list from its home card continues its session and stops no other', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 2);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 1);

    const three = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
    await three.lessonCard().click();

    await expect(three.progressText()).toHaveText('2 / 3');
    expect((await savedSessions(page)).map((s) => [s.lessonId, s.status])).toEqual([
      ['fixture-three', 'active'],
      ['fixture-five', 'active'],
    ]);
  });

  test('if saved data holds several sessions for one list, the most recently used wins, however early it was started', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    const lesson = await loadLesson('fixture-five');
    const ids = lesson.lists.dictation!.map((item) => item.target);
    const saved = (id: string, startedAt: string, updatedAt: string, position: number): SessionJson => ({
      id,
      profileId: 'replaced-on-restore',
      subject: 'chinese',
      practiceType: 'dictation',
      lessonId: 'fixture-five',
      contentVersion: 'saved-before',
      status: 'active',
      startedAt,
      updatedAt,
      rounds: [
        {
          index: 1,
          itemIds: ids,
          position,
          phase: 'prompt',
          heardCurrent: false,
          marks: Object.fromEntries(ids.slice(0, position).map((id) => [id, 'correct'])),
          startedAt,
        },
      ],
      undo: null,
      marksSinceBreak: 0,
    });
    await restoreSessions(page, [
      // Started first but worked on last: this is the one to keep going with.
      saved('started-first', '2026-10-01T12:00:00.000Z', '2026-10-03T12:00:00.000Z', 3),
      saved('started-last', '2026-10-02T12:00:00.000Z', '2026-10-02T13:00:00.000Z', 1),
    ]);

    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).getByTestId('progress-text')).toHaveText('3 / 5');
    await cards(page).getByRole('link').click();
    await expect(new PracticeScreen(page, audio, lesson).progressText()).toHaveText('3 / 5');
  });

  test('a lesson that loses its phrase list stops the phrase session only; the same lesson\'s dictation session is left alone', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    const lesson = await loadLesson('fixture-five');
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 2);
    const say = new PracticeScreen(page, audio, lesson, 'phrase-recognition');
    await say.lessonCard().click();
    await say.markMany(1);
    await expect(say.check).toBeVisible();
    await say.home.click();
    await publishLessonEdit(page, 'fixture-five', (l) => ({ ...l, lists: { dictation: l.lists.dictation! } }));
    await page.reload();
    await expect(lessonGroup(page, 'Fixture Five').getByRole('link')).toHaveCount(1); // only Write is offered now

    await cardFor(page, 'Fixture Five, Say').getByRole('link').click();

    await expect(page.getByText('This lesson changed — pick a lesson')).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).nth(0)).toHaveAccessibleName('Keep going: Fixture Five, Write');
    await expect(cards(page).getByTestId('progress-text')).toHaveText('2 / 5');
    expect((await savedSessions(page)).map((s) => [s.practiceType, s.status])).toEqual([
      ['dictation', 'active'],
      ['phrase-recognition', 'stopped'],
    ]);
    await cards(page).getByRole('link').click();
    await expect(new PracticeScreen(page, audio, lesson).progressText()).toHaveText('2 / 5');
  });

  test('a lesson that no longer has the practice type stops that session only; the other lessons keep theirs', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 2);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 1);
    await publishLessonEdit(page, 'fixture-five', (lesson) => ({ ...lesson, lists: {} }));
    await page.reload();

    await cardFor(page, 'Fixture Five').getByRole('link').click();

    await expect(page.getByText('This lesson changed — pick a lesson')).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).nth(0)).toContainText('Fixture Three');
    await expect(cards(page).getByTestId('progress-text')).toHaveText('2 / 3');
    expect((await savedSessions(page)).map((s) => [s.lessonId, s.status])).toEqual([
      ['fixture-three', 'active'],
      ['fixture-five', 'stopped'],
    ]);
  });
});
