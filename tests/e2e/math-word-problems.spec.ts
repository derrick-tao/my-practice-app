// Seam 1: the Word problems practice type, the 📖 Stories button on the Math card (ticket 53). Stories are random, so
// the driver reads each story on screen and works out its answer itself (words-driver.ts): a story whose stated answer
// is wrong, or that does not read naturally, fails the parse before it can fail anything else.
import type { Page } from '@playwright/test';
import { backupFile, chooseBackupFile, confirmImport, exportBackup, openBackupSection, type SessionJson } from './backup-driver.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { openParentArea, openParentSection, setUpLearner } from './parent-driver.ts';
import { seedRandom } from './practice-driver.ts';
import {
  ADDING_KINDS,
  expectedPictures,
  finalEquation,
  identityOf,
  STORY_KINDS,
  StoriesScreen,
  type Story,
} from './words-driver.ts';

const LESSON = 'Fixture Stories';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
}

async function start({ page, audio }: Fixtures, title = LESSON): Promise<StoriesScreen> {
  await setUpLearner(page);
  const stories = new StoriesScreen(page, audio);
  await stories.open(title);
  await audio.clear();
  return stories;
}

const countBy = <T>(items: T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {});

test.describe('a lesson with word problems on home', () => {
  test('shows a 📖 Stories button with 20 problems on the Math card', async ({ page }) => {
    await setUpLearner(page);

    const card = page.getByRole('group', { name: LESSON, exact: true });
    await expect(card.getByTestId('subject-tag')).toHaveText('Math');
    await expect(card.getByRole('link', { name: /Stories · 20 problems/ })).toBeVisible();
    await expect(card.getByRole('link', { name: /Stories/ })).toContainText('📖');
    // A math lesson without word-problems rules does not offer it.
    const facts = page.getByRole('group', { name: 'Fixture Math', exact: true });
    await expect(facts.getByRole('link', { name: /Stories/ })).toHaveCount(0);
  });
});

test.describe('a Stories session', () => {
  test('has 20 stories covering every kind evenly, with no repeats, each read and answered by the driver', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    await expect(stories.progress).toHaveText('0 / 20');

    const shown = await stories.playRound(); // every answer is the driver's own: ✅ on the first try or this fails

    expect(shown).toHaveLength(20);
    const counts = countBy(shown, (story) => story.kind);
    expect(Object.keys(counts).sort()).toEqual([...STORY_KINDS].sort());
    for (const count of Object.values(counts)) expect([1, 2]).toContain(count);
    expect(new Set(shown.map(identityOf)).size).toBe(20);
    for (const story of shown) {
      expect(Math.max(...story.shown, story.answer), story.text).toBeLessThanOrEqual(20);
      expect(Math.min(...story.shown, story.answer), story.text).toBeGreaterThanOrEqual(1);
    }
    await expect(stories.completion).toBeVisible();
    await expect(page.getByText('20 of 20 on the first try!')).toBeVisible();
  });

  test('follows the lesson rules: a lesson that only adds has only adding stories', async ({ page, audio }) => {
    const stories = await start({ page, audio }, 'Fixture Adding Stories');

    const shown = await stories.playRound();

    expect(shown).toHaveLength(20);
    expect(countBy(shown, (story) => story.kind)).toEqual(Object.fromEntries(ADDING_KINDS.map((kind) => [kind, 4])));
    expect(new Set(shown.map(identityOf)).size).toBe(20);
  });

  test('has stories that read naturally: a name, an object, no unknown wording', async ({ page, audio }) => {
    const stories = await start({ page, audio });

    const shown = await stories.playRound(); // parseStory rejects anything but the known story wordings

    const names = new Set(shown.flatMap((story) => [story.name, ...(story.friend ? [story.friend] : [])]));
    const objects = new Set(shown.map((story) => story.object));
    expect(names.size).toBeGreaterThan(2); // names and objects vary
    expect(objects.size).toBeGreaterThan(2);
    for (const story of shown) expect(story.text, 'no placeholder left').not.toMatch(/[{}$]|undefined|NaN|null/);
  });

  test('shows a number pad and the answer box, and no Undo or timer', async ({ page, audio }) => {
    const stories = await start({ page, audio });

    await stories.read();
    for (const digit of '0123456789') await expect(page.getByRole('button', { name: digit, exact: true })).toBeVisible();
    await expect(stories.answerBox).toHaveText('?');
    await expect(stories.undo).toHaveCount(0);
    await expect(page.getByTestId('timer')).toHaveCount(0);
  });
});

test.describe('emoji pictures', () => {
  test('show a row of the object for each quantity of 10 or less, and digits only for larger numbers', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    let withPictures = 0;
    let withBigNumber = 0;
    let withBothRowAndBigNumber = 0;

    for (let i = 0; i < 20; i++) {
      const story = await stories.read();
      const rows = await stories.pictureRowTexts();
      expect(rows, story.text).toEqual(expectedPictures(story));
      if (rows.length > 0) withPictures++;
      if (story.shown.some((count) => count > 10)) withBigNumber++;
      if (rows.length > 0 && story.shown.some((count) => count > 10)) withBothRowAndBigNumber++;
      await stories.solveFirstTry();
    }

    expect(withPictures).toBeGreaterThan(0);
    expect(withBigNumber).toBeGreaterThan(0);
    expect(withBothRowAndBigNumber).toBeGreaterThan(0); // the large number stays digits while the small one is pictured
  });

  test('do not give the answer away: the unknown has no picture', async ({ page, audio }) => {
    const stories = await start({ page, audio });

    for (let i = 0; i < 20; i++) {
      const story = await stories.read();
      const rows = await stories.pictureRowTexts();
      // Every row is for a number written in the story; none is for the answer (unless the story also says that number).
      expect(rows.length, story.text).toBe(story.shown.filter((count) => count <= 10).length);
      if (!story.shown.includes(story.answer)) expect(rows, story.text).not.toContain(story.object.repeat(story.answer));
      await stories.solveFirstTry();
    }
  });

  test('stay while the second try is pending, and the answer shown after two misses adds no picture of it', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    const story = await stories.answerWrong();
    await expect(stories.feedback).toContainText('Try again');
    expect(await stories.pictureRowTexts()).toEqual(expectedPictures(story));

    await stories.submit(story.answer + 1);

    await expect(stories.strategy).toBeVisible();
    expect(await stories.pictureRowTexts()).toEqual(expectedPictures(story));
  });
});

test.describe('tries and the worked equation', () => {
  test('a wrong first try says Try again and keeps the same story; right on the second shows "got it!"', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    const story = await stories.answerWrong();

    await expect(stories.feedback).toContainText('Try again');
    await expect(stories.progress).toHaveText('0 / 20');
    expect((await stories.read()).text).toBe(story.text);
    expect(await audio.effects()).toEqual([]);

    await stories.submit(story.answer);
    await expect(stories.feedback).toContainText('got it!');
    await expect(stories.answerBox).toHaveText(String(story.answer));
    await expect(stories.strategy).toHaveCount(0);
    await stories.next.click();
    await expect(stories.progress).toHaveText('1 / 20');
  });

  test('after a second wrong try the answer is shown with a one-line equation that fits the story, for every kind', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    const seen = new Set<string>();

    const shown = await stories.playRound(
      () => 'missed',
      (story, strategy) => {
        seen.add(story.kind);
        const equation = finalEquation(strategy);
        expect(equation, `${story.text} -> ${strategy}`).toBeDefined();
        const { a, op, b, result } = equation!;
        // The equation uses exactly the story's two numbers and the answer.
        expect([a, b, result].sort((x, y) => x - y), strategy).toEqual([...story.shown, story.answer].sort((x, y) => x - y));
        // It adds in an adding story and takes away in the rest, the whole first when it takes away.
        expect(op, strategy).toBe(ADDING_KINDS.includes(story.kind) ? '+' : '−');
        if (op === '−') expect(a, strategy).toBeGreaterThan(result);
        // The unknown shows as "?" in the equation first when the story asks for the change or the start.
        const asksForPart = ['add-change', 'add-start', 'take-change', 'take-start'].includes(story.kind);
        expect(strategy.includes('?'), strategy).toBe(asksForPart);
        expect(strategy, strategy).toContain(String(story.answer));
      },
    );

    expect(shown).toHaveLength(20);
    expect([...seen].sort()).toEqual([...STORY_KINDS].sort());
    await expect(stories.summary).toBeVisible();
    await expect(page.getByTestId('wrong-count')).toHaveText('20');
  });

  test('the ❌ sound plays only after the second wrong try', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    const story = await stories.answerWrong();
    expect(await audio.effects()).toEqual([]);

    await stories.submit(story.answer + 1);

    await expect.poll(() => audio.effects()).toEqual(['gentle']);
  });
});

test.describe('retry rounds', () => {
  test('give new stories of the same kind for just the ❌ spots, again and again', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    const missedAt = new Set([2, 5, 11]);

    const first = await stories.playRound((_, index) => (missedAt.has(index) ? (index === 5 ? 'second' : 'missed') : 'first'));

    await expect(stories.summary).toBeVisible();
    await expect(page.getByTestId('wrong-count')).toHaveText('3');
    const missed = first.filter((_, index) => missedAt.has(index));
    await stories.retry.click();
    await expect(stories.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    await expect(stories.progress).toHaveText('0 / 3');

    const second = await stories.playRound(() => 'missed');

    expect(countBy(second, (story) => story.kind)).toEqual(countBy(missed, (story) => story.kind));
    const used = new Set(first.map(identityOf));
    for (const story of second) expect(used.has(identityOf(story)), story.text).toBe(false);
    for (const [index, story] of second.entries()) expect(story.text).not.toBe(missed[index]!.text);
    await expect(stories.summary).toBeVisible();
    await stories.retry.click();
    await expect(stories.roundBadge).toHaveAttribute('aria-label', 'Round 3');
    const third = await stories.playRound();
    expect(countBy(third, (story) => story.kind)).toEqual(countBy(missed, (story) => story.kind));
    for (const story of third) expect(used.has(identityOf(story)) || second.map(identityOf).includes(identityOf(story))).toBe(false);
    await expect(page.getByText('Rounds: 3')).toBeVisible();
  });
});

test.describe('many random draws', () => {
  for (const seed of [2, 3, 4, 5]) {
    test(`every story of a session is read and answered correctly (seed ${seed})`, async ({ page, audio }) => {
      await seedRandom(page, seed);
      const stories = await start({ page, audio });

      const shown = await stories.playRound();

      expect(shown).toHaveLength(20);
      expect(new Set(shown.map(identityOf)).size).toBe(20);
      expect(Object.keys(countBy(shown, (story) => story.kind))).toHaveLength(STORY_KINDS.length);
      await expect(page.getByText('20 of 20 on the first try!')).toBeVisible();
    });
  }
});

test.describe('reloading resumes the exact story', () => {
  /** Reload as if the random source had been seeded differently: only saved data may decide what the story says. */
  async function reloadWithOtherRandomness(page: Page): Promise<void> {
    await seedRandom(page, 987);
    await page.reload();
  }

  test('after a wrong first try: the same story, name and object, with Try again and the pictures', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    await stories.solveFirstTry();
    const story = await stories.answerWrong();
    const rows = await stories.pictureRowTexts();

    await reloadWithOtherRandomness(page);

    await expect(stories.progress).toHaveText('1 / 20');
    expect((await stories.read()).text).toBe(story.text);
    expect(await stories.pictureRowTexts()).toEqual(rows);
    await expect(stories.feedback).toContainText('Try again');
    await stories.submit(story.answer);
    await expect(stories.feedback).toContainText('got it!');
  });

  test('on a fresh story, with every story still to come the same', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    await stories.solveFirstTry();
    await stories.solveFirstTry();
    const story = await stories.read();

    await reloadWithOtherRandomness(page);

    await expect(stories.progress).toHaveText('2 / 20');
    const rest = await stories.playRound();
    expect(rest).toHaveLength(18);
    expect(rest[0]!.text).toBe(story.text);
  });

  test('after the answer was shown: the same story, answer and equation, via Keep going', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    const story = await stories.answerWrong();
    await stories.submit(story.answer + 1);
    const equation = (await stories.strategy.textContent())!;
    await seedRandom(page, 987);

    await stories.reopenViaKeepGoing();

    expect((await stories.read()).text).toBe(story.text);
    await expect(stories.feedback).toHaveText(`The answer is ${story.answer}`);
    await expect(stories.strategy).toHaveText(equation);
    await stories.next.click();
    await expect(stories.progress).toHaveText('1 / 20');
  });

  test('in a retry round: the same new stories after a reload', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    await stories.playRound((_, index) => (index < 2 ? 'missed' : 'first'));
    await stories.retry.click();
    const retried = await stories.read();
    await expect(stories.progress).toHaveText('0 / 2');

    await reloadWithOtherRandomness(page);

    await expect(stories.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    expect((await stories.read()).text).toBe(retried.text);
  });

  test('shows on home as practice in progress, with its place', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    await stories.solveFirstTry();
    await stories.solveFirstTry();

    await page.goto('./');

    await expect(stories.keepGoing).toContainText(LESSON);
    await expect(stories.keepGoing).toContainText('Stories');
    await expect(stories.keepGoing.getByTestId('progress-text')).toHaveText('2 / 20');
  });
});

test.describe('backup', () => {
  test('a story in progress is saved with its name and object, and restores as the same story', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    await stories.solveFirstTry();
    const story = await stories.answerWrong();
    await page.goto('./');
    await openBackupSection(page);
    const { backup } = await exportBackup(page);
    const session = backup.data.sessions.find((s) => s.practiceType === 'word-problems')!;
    const problem = (session.rounds as Array<{ problems: Record<string, { name: string; object: string }> }>)[0]!.problems['2']!;
    expect(story.text).toContain(problem.name);
    expect(story.text).toContain(problem.object);

    await chooseBackupFile(page, backupFile(backup.data, backup.exportedAt));
    await confirmImport(page);
    await page.goto('./');
    await stories.keepGoing.click();

    expect((await stories.read()).text).toBe(story.text);
    await expect(stories.feedback).toContainText('Try again');
  });

  test('a story whose name is not text is rejected', async ({ page, audio }) => {
    const stories = await start({ page, audio });
    await stories.solveFirstTry();
    await page.goto('./');
    await openBackupSection(page);
    const { backup } = await exportBackup(page);
    const broken: SessionJson[] = backup.data.sessions.map((s) => {
      const rounds = s.rounds as Array<{ problems: Record<string, Record<string, unknown>> }>;
      rounds[0]!.problems['1']!.name = 42;
      return s;
    });

    await chooseBackupFile(page, backupFile({ ...backup.data, sessions: broken }, backup.exportedAt));

    await expect(page.getByRole('alert')).toContainText("isn't a backup made by this app");
  });
});

test.describe('the parent area', () => {
  test('the lesson preview lists Stories with its rules, and the problems', async ({ page }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await openParentSection(page, 'Lesson preview');
    await page.getByRole('link', { name: /Fixture Adding Stories/ }).click();

    const header = page.getByTestId('preview-header');
    await expect(header).toContainText('Stories');
    await expect(header).toContainText('20 problems');
    const section = page.getByTestId('preview-section').filter({ has: page.getByRole('heading', { name: /Stories/ }) });
    await expect(section).toContainText('New problems every time: within 20 · adding');
  });
});
