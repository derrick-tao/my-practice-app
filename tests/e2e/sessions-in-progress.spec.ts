// Seam 1: a session in progress for every list (ticket 23). A learner can have one session per lesson and
// practice type, all at once: opening a list never stops another one, and each one shows as Keep going on
// its practice type's button on the lesson's card. Everything goes through the screens; the saved history is
// read through a backup export on a second tab (see saved-sessions.ts).
import type { Locator, Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { restoreSessions, type SessionJson } from './backup-driver.ts';
import { publishLessonEdit } from './lesson-edits.ts';
import { addLearner, openParentArea, openParentSection, openProfiles, setUpLearner } from './parent-driver.ts';
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

/** Every Keep going button on home. */
const keepGoingButtons = (page: Page): Locator => page.getByRole('link', { name: /Keep going/ });
/** One practice type's Keep going button on a lesson's card (`label` is the child's name for the type, e.g. Write). */
const keepGoingFor = (page: Page, title: string, label: string): Locator =>
  lessonGroup(page, title).getByRole('link', { name: new RegExp(`^${label} · Keep going`) });
/** The 🔄 beside one practice type's Keep going button. */
const startOverFor = (page: Page, title: string, label: string): Locator =>
  lessonGroup(page, title).getByRole('button', { name: `Start over ${label}` });

test.describe('a session in progress for every list', () => {
  test('dictation half done on lesson A, then dictation on lesson B: no gate, each card shows Keep going with its place, each resumes at its exact place', async ({
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

    await expect(keepGoingButtons(page)).toHaveCount(2);
    await expect(keepGoingFor(page, 'Fixture Five', 'Write').getByTestId('progress-text')).toHaveText('1 / 5');
    await expect(keepGoingFor(page, 'Fixture Three', 'Write').getByTestId('progress-text')).toHaveText('2 / 3');

    await keepGoingFor(page, 'Fixture Three', 'Write').click();
    await expect(three.progressText()).toHaveText('2 / 3');
    await three.home.click();
    await keepGoingFor(page, 'Fixture Five', 'Write').click();
    await expect(five.progressText()).toHaveText('1 / 5');

    expect((await savedSessions(page)).map((s) => [s.lessonId, s.status])).toEqual([
      ['fixture-three', 'active'],
      ['fixture-five', 'active'],
    ]);
  });

  test('dictation half done, then phrase recognition of the same lesson: no gate, both buttons of the one card say Keep going, each resumes at its exact place', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    const lesson = await loadLesson('fixture-five');
    const write = await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 2);

    const say = new PracticeScreen(page, audio, lesson, 'phrase-recognition');
    await expect(keepGoingFor(page, 'Fixture Five', 'Say')).toHaveCount(0); // not started: the plain button
    await say.lessonCard().click();
    await expect(page.getByText('Stop your current practice?')).toHaveCount(0);
    await expect(say.progressText()).toHaveText('0 / 6');
    await say.markMany(1);
    await expect(say.check).toBeVisible();
    await say.home.click();

    await expect(lessonGroup(page, 'Fixture Five')).toHaveCount(1); // one card for the lesson, not one per session
    await expect(keepGoingButtons(page)).toHaveCount(2);
    await expect(keepGoingFor(page, 'Fixture Five', 'Say')).toContainText('🗣️ Say');
    await expect(keepGoingFor(page, 'Fixture Five', 'Say').getByTestId('progress-text')).toHaveText('1 / 6');
    await expect(keepGoingFor(page, 'Fixture Five', 'Write').getByTestId('progress-text')).toHaveText('2 / 5');

    await keepGoingFor(page, 'Fixture Five', 'Write').click();
    await expect(write.progressText()).toHaveText('2 / 5');
    await write.home.click();
    await keepGoingFor(page, 'Fixture Five', 'Say').click();
    await expect(say.progressText()).toHaveText('1 / 6');

    expect((await savedSessions(page)).map((s) => [s.practiceType, s.status])).toEqual([
      ['dictation', 'active'],
      ['phrase-recognition', 'active'],
    ]);
  });

  test('the 🔄 questions name their practice, sit flat inside the card (no card in a card), and two open at once are each labelled by their own question', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    const lesson = await loadLesson('fixture-five');
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 1);
    const say = new PracticeScreen(page, audio, lesson, 'phrase-recognition');
    await say.lessonCard().click();
    await say.markMany(1);
    await expect(say.check).toBeVisible();
    await say.home.click();

    await startOverFor(page, 'Fixture Five', 'Write').click();
    await startOverFor(page, 'Fixture Five', 'Say').click();
    const panels = lessonGroup(page, 'Fixture Five').locator('.confirm');
    await expect(panels).toHaveCount(2);
    await expect(page.getByText('Start Write again from the beginning?')).toBeVisible();
    await expect(page.getByText('Start Say again from the beginning?')).toBeVisible();
    await expect(panels.first()).toHaveCSS('border-top-width', '0px');
    await expect(lessonGroup(page, 'Fixture Five').getByRole('region', { name: 'Start Say again from the beginning?' })).toHaveCount(1);
    await expect(lessonGroup(page, 'Fixture Five').getByRole('region', { name: 'Start Write again from the beginning?' })).toHaveCount(1);
  });

  test('🔄 appears only beside Keep going buttons, asks first, and No leaves the session alone', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 2);

    await expect(lessonGroup(page, 'Fixture Five').getByRole('button')).toHaveCount(1); // Say has nothing in progress
    await startOverFor(page, 'Fixture Five', 'Write').click();
    await expect(page.getByText('Start Write again from the beginning?')).toBeVisible();
    await page.getByRole('button', { name: 'No', exact: true }).click();

    await expect(page.getByText('Start Write again from the beginning?')).toHaveCount(0);
    await expect(keepGoingFor(page, 'Fixture Five', 'Write').getByTestId('progress-text')).toHaveText('2 / 5');
    expect((await savedSessions(page)).map((s) => s.status)).toEqual(['active']);
  });

  test('🔄 Yes on one button leaves the other sessions untouched; the stopped one shows as stopped on the progress page', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    const three = await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 2);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 3);
    const say = new PracticeScreen(page, audio, await loadLesson('fixture-five'), 'phrase-recognition');
    await say.lessonCard().click();
    await say.markMany(1);
    await expect(say.check).toBeVisible();
    await say.home.click();

    await startOverFor(page, 'Fixture Five', 'Write').click();
    await expect(page.getByText('Start Write again from the beginning?')).toBeVisible();
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    const five = new PracticeScreen(page, audio, await loadLesson('fixture-five'));
    await expect(five.progressText()).toHaveText('0 / 5');
    await five.home.click();

    await expect(keepGoingButtons(page)).toHaveCount(3);
    await expect(keepGoingFor(page, 'Fixture Five', 'Write').getByTestId('progress-text')).toHaveText('0 / 5');
    await expect(keepGoingFor(page, 'Fixture Five', 'Say').getByTestId('progress-text')).toHaveText('1 / 6');
    await expect(keepGoingFor(page, 'Fixture Three', 'Write').getByTestId('progress-text')).toHaveText('2 / 3');
    await keepGoingFor(page, 'Fixture Three', 'Write').click();
    await expect(three.progressText()).toHaveText('2 / 3');

    expect((await savedSessions(page)).map((s) => [s.lessonId, s.practiceType, s.status])).toEqual([
      ['fixture-three', 'dictation', 'active'],
      ['fixture-five', 'dictation', 'stopped'],
      ['fixture-five', 'phrase-recognition', 'active'],
      ['fixture-five', 'dictation', 'active'],
    ]);

    await three.home.click();
    await openParentArea(page);
    await openParentSection(page, 'Progress');
    await page.getByRole('link', { name: /Fixture Five/ }).click();
    const attempts = page.getByTestId('attempt');
    await expect(attempts).toHaveCount(3);
    await expect(attempts.filter({ hasText: 'Stopped' })).toHaveCount(1);
    await expect(attempts.filter({ hasText: 'In progress' })).toHaveCount(2);
  });

  test('a failed save of 🔄 Yes says so and stops nothing; retrying starts over', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-five', 2);

    await startOverFor(page, 'Fixture Five', 'Write').click();
    await page.evaluate(() => void (window.__failStorageWrites = true));
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText("Couldn't save");
    expect((await savedSessions(page)).map((s) => s.status)).toEqual(['active']);

    await page.evaluate(() => void (window.__failStorageWrites = false));
    await page.getByRole('button', { name: /tap to retry/ }).click();
    await expect(new PracticeScreen(page, audio, await loadLesson('fixture-five')).progressText()).toHaveText('0 / 5');
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

  test('each learner sees only their own Keep going buttons', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼', lessons: ['fixture-three'] });
    await practiceThenHome({ page, audio, loadLesson }, 'fixture-three', 1);
    await openProfiles(page);
    await addLearner(page, { name: 'Leo', avatar: '🦊', lessons: ['fixture-three'] });
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(keepGoingButtons(page)).toHaveCount(1);

    const profiles = page.getByRole('group', { name: 'Who is practicing?' });
    await profiles.getByRole('button', { name: 'Leo' }).click();
    await expect(page.getByRole('heading', { name: 'Hi 🦊 Leo!' })).toBeVisible();
    await expect(lessonGroup(page, 'Fixture Three')).toBeVisible();
    await expect(keepGoingButtons(page)).toHaveCount(0);
    await expect(startOverFor(page, 'Fixture Three', 'Write')).toHaveCount(0);

    await profiles.getByRole('button', { name: 'Mia' }).click();
    await expect(keepGoingFor(page, 'Fixture Three', 'Write').getByTestId('progress-text')).toHaveText('1 / 3');
  });

  test('a session left alone for a very long time still says Keep going', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    const lesson = await loadLesson('fixture-five');
    const ids = lesson.lists.dictation!.map((item) => item.target);
    const startedAt = '2020-01-02T09:00:00.000Z';
    await restoreSessions(page, [
      {
        id: 'ancient',
        profileId: 'replaced-on-restore',
        subject: 'chinese',
        practiceType: 'dictation',
        lessonId: 'fixture-five',
        contentVersion: 'saved-before',
        status: 'active',
        startedAt,
        updatedAt: startedAt,
        rounds: [
          {
            index: 1,
            itemIds: ids,
            position: 2,
            phase: 'prompt',
            heardCurrent: false,
            marks: Object.fromEntries(ids.slice(0, 2).map((id) => [id, 'correct'])),
            startedAt,
          },
        ],
        undo: null,
        marksSinceBreak: 0,
      },
    ]);

    await expect(keepGoingFor(page, 'Fixture Five', 'Write').getByTestId('progress-text')).toHaveText('2 / 5');
    await keepGoingFor(page, 'Fixture Five', 'Write').click();
    await expect(new PracticeScreen(page, audio, lesson).progressText()).toHaveText('2 / 5');
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

    await expect(keepGoingButtons(page)).toHaveCount(1);
    await expect(keepGoingButtons(page).getByTestId('progress-text')).toHaveText('3 / 5');
    await keepGoingButtons(page).click();
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
    // Only Write is offered now, but the phrase session in progress can still be opened (to be stopped).
    await expect(keepGoingButtons(page)).toHaveCount(2);

    await keepGoingFor(page, 'Fixture Five', 'Say').click();

    await expect(page.getByText('This lesson changed — pick a lesson')).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(keepGoingButtons(page)).toHaveCount(1);
    await expect(keepGoingFor(page, 'Fixture Five', 'Write').getByTestId('progress-text')).toHaveText('2 / 5');
    expect((await savedSessions(page)).map((s) => [s.practiceType, s.status])).toEqual([
      ['dictation', 'active'],
      ['phrase-recognition', 'stopped'],
    ]);
    await keepGoingFor(page, 'Fixture Five', 'Write').click();
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

    await keepGoingFor(page, 'Fixture Five', 'Write').click();

    await expect(page.getByText('This lesson changed — pick a lesson')).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(keepGoingButtons(page)).toHaveCount(1);
    await expect(keepGoingFor(page, 'Fixture Three', 'Write').getByTestId('progress-text')).toHaveText('2 / 3');
    expect((await savedSessions(page)).map((s) => [s.lessonId, s.status])).toEqual([
      ['fixture-three', 'active'],
      ['fixture-five', 'stopped'],
    ]);
  });
});

test.describe('lessons in the order they were last used', () => {
  /** The titles of the lesson cards on home, top to bottom. */
  const cardTitles = (page: Page): Promise<(string | null)[]> =>
    page.getByRole('group').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label')));

  /** A dictation session of a fixture lesson, one item done, last worked on at `updatedAt`. */
  const saved = async (
    loadLesson: Fixtures['loadLesson'],
    lessonId: string,
    id: string,
    startedAt: string,
    updatedAt: string,
  ): Promise<SessionJson> => {
    const ids = (await loadLesson(lessonId)).lists.dictation!.map((item) => item.target);
    return {
      id,
      profileId: 'replaced-on-restore',
      subject: 'chinese',
      practiceType: 'dictation',
      lessonId,
      contentVersion: 'saved-before',
      status: 'active',
      startedAt,
      updatedAt,
      rounds: [
        { index: 1, itemIds: ids, position: 1, phase: 'prompt', heardCurrent: false, marks: { [ids[0]!]: 'correct' }, startedAt },
      ],
      undo: null,
      marksSinceBreak: 0,
    };
  };
  test('lessons with practice in progress come first, most recently used first, a session never worked on since it started counting from its start; the rest keep their usual order', async ({
    page,
    loadLesson,
  }) => {
    await setUpLearner(page, { lessons: ['fixture-three', 'fixture-five', 'fixture-twelve', 'fixture-strokes'] });
    const usual = await cardTitles(page);
    expect([...usual].sort()).toEqual(['Fixture Five', 'Fixture Strokes', 'Fixture Three', 'Fixture Twelve']);

    await restoreSessions(page, [
      // Worked on 3 Oct, though started 1 Oct.
      await saved(loadLesson, 'fixture-twelve', 'twelve', '2026-10-01T09:00:00.000Z', '2026-10-03T09:00:00.000Z'),
      // Not worked on since it was started on 4 Oct (its last-used time is its start), so it is the most recent.
      await saved(loadLesson, 'fixture-three', 'three', '2026-10-04T09:00:00.000Z', '2026-10-04T09:00:00.000Z'),
    ]);

    await expect(lessonGroup(page, 'Fixture Five')).toBeVisible();
    const rest = usual.filter((title) => title !== 'Fixture Three' && title !== 'Fixture Twelve');
    expect(await cardTitles(page)).toEqual(['Fixture Three', 'Fixture Twelve', ...rest]);
  });

  test('working on an older session moves its lesson to the top', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page, { lessons: ['fixture-three', 'fixture-five', 'fixture-twelve', 'fixture-strokes'] });
    await restoreSessions(page, [
      await saved(loadLesson, 'fixture-twelve', 'twelve', '2026-10-01T09:00:00.000Z', '2026-10-03T09:00:00.000Z'),
      await saved(loadLesson, 'fixture-three', 'three', '2026-10-04T09:00:00.000Z', '2026-10-04T09:00:00.000Z'),
    ]);
    await expect(lessonGroup(page, 'Fixture Five')).toBeVisible();
    expect((await cardTitles(page)).slice(0, 2)).toEqual(['Fixture Three', 'Fixture Twelve']);

    // Keep going on the older one and back home: it is now the one used last.
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-twelve'));
    await practice.lessonCard().click();
    await expect(practice.progressText()).toHaveText('1 / 12');
    await practice.home.click();

    await expect(lessonGroup(page, 'Fixture Five')).toBeVisible();
    expect((await cardTitles(page)).slice(0, 2)).toEqual(['Fixture Twelve', 'Fixture Three']);
  });
});
