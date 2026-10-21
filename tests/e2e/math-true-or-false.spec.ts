// Seam 1: the True or false practice type (ticket 51). The child reads an equation and taps True or False; the
// rest (20 problems, two tries, marks, retry rounds, save and resume) works as for Facts. The problems are random,
// so the driver reads each equation on screen and works out for itself whether it is true (true-or-false-driver.ts).
import type { Page } from '@playwright/test';
import { expect, test, type AudioProbe } from './harness.ts';
import { openSettings, setSoundEffects, setUpLearner } from './parent-driver.ts';
import { identityOf, isTrue, kindOf, TrueOrFalseScreen } from './true-or-false-driver.ts';

const LESSON = 'Fixture True or False';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
}

async function start({ page, audio }: Fixtures, title = LESSON, breakEvery?: 5 | 10 | 15): Promise<TrueOrFalseScreen> {
  await setUpLearner(page, { lessons: ['fixture-math-tf', 'fixture-math-tf-sub', 'fixture-math'] });
  if (breakEvery !== undefined) {
    await openSettings(page);
    const choice = page.getByRole('radiogroup', { name: 'Break every' }).getByRole('radio', { name: String(breakEvery), exact: true });
    await choice.click();
    await expect(choice).toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();
  }
  const screen = new TrueOrFalseScreen(page, audio);
  await screen.open(title);
  await audio.clear();
  return screen;
}

const countBy = <T>(items: T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {});

test.describe('the ⚖️ True? button on home', () => {
  test('a lesson with true-or-false rules offers it with 20 problems; a lesson without it does not', async ({ page }) => {
    await setUpLearner(page, { lessons: ['fixture-math-tf', 'fixture-math'] });

    const card = page.getByRole('group', { name: LESSON, exact: true });
    await expect(card.getByRole('link', { name: /True\? · 20 problems/ })).toBeVisible();
    await expect(card.getByText('⚖️')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Fixture Math', exact: true }).getByRole('link', { name: /True\?/ })).toHaveCount(0);
  });
});

test.describe('a True or false session', () => {
  test('has 20 problems spread evenly over the four kinds, no repeats, about half true, and false ones off by 1 or 2', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    await expect(screen.progress).toHaveText('0 / 20');

    const shown = await screen.playRound();

    expect(shown).toHaveLength(20);
    expect(countBy(shown, kindOf)).toEqual({ 'same-number': 5, 'answer-left': 5, swapped: 5, 'two-sums': 5 });
    expect(new Set(shown.map(identityOf)).size).toBe(20);
    const trues = shown.filter(isTrue).length;
    expect(trues).toBeGreaterThanOrEqual(8);
    expect(trues).toBeLessThanOrEqual(12);
    for (const statement of shown) {
      if (!isTrue(statement)) expect([1, 2]).toContain(Math.abs(statement.left.value - statement.right.value));
      for (const side of [statement.left, statement.right]) {
        expect(side.value).toBeGreaterThanOrEqual(0);
        expect(Math.max(...side.terms)).toBeLessThanOrEqual(20);
      }
    }
    await expect(screen.completion).toBeVisible();
    await expect(page.getByText('20 of 20 on the first try!')).toBeVisible();
  });

  test('each kind reads the way it should, and each kind has both true and false problems', async ({ page, audio }) => {
    const screen = await start({ page, audio });

    const shown = await screen.playRound();

    for (const statement of shown) {
      const { left, right } = statement;
      switch (kindOf(statement)) {
        case 'same-number':
          expect(left.plain && right.plain).toBe(true);
          break;
        case 'answer-left':
          expect(left.plain && !right.plain).toBe(true);
          break;
        case 'swapped': {
          expect(left.text).toMatch(/^\d+ \+ \d+$/);
          expect(right.text).toMatch(/^\d+ \+ \d+$/);
          // One side is the other with its numbers the other way round, and at most one of them changed.
          const [a, b] = left.terms as [number, number];
          const [c, d] = right.terms as [number, number];
          expect(c === b || d === a).toBe(true);
          break;
        }
        case 'two-sums':
          expect(left.text).toMatch(/^\d+ \+ \d+$/);
          expect(right.text).toMatch(/^\d+ \+ \d+$/);
          break;
      }
    }
    for (const kind of ['same-number', 'answer-left', 'swapped', 'two-sums']) {
      const ofKind = shown.filter((s) => kindOf(s) === kind);
      expect(ofKind.filter(isTrue).length).toBeGreaterThanOrEqual(2);
      expect(ofKind.filter((s) => !isTrue(s)).length).toBeGreaterThanOrEqual(2);
    }
  });

  test('follows the lesson rules: a lesson that only subtracts has no sums, so only the same-number and answer-left kinds', async ({ page, audio }) => {
    const screen = await start({ page, audio }, 'Fixture Subtracting Only');

    const shown = await screen.playRound();

    expect(shown).toHaveLength(20);
    expect(countBy(shown, kindOf)).toEqual({ 'same-number': 10, 'answer-left': 10 });
    expect(shown.every((s) => !s.text.includes('+'))).toBe(true);
    expect(new Set(shown.map(identityOf)).size).toBe(20);
  });

  test('is answered with two big True and False buttons: no number pad, Undo or timer', async ({ page, audio }) => {
    const screen = await start({ page, audio });

    await screen.read();
    await expect(screen.trueButton).toBeVisible();
    await expect(screen.falseButton).toBeVisible();
    for (const box of [await screen.trueButton.boundingBox(), await screen.falseButton.boundingBox()]) {
      expect(box!.height).toBeGreaterThanOrEqual(96);
      expect(box!.width).toBeGreaterThanOrEqual(120);
    }
    await expect(page.getByRole('button', { name: 'Check', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '5', exact: true })).toHaveCount(0);
    await expect(screen.undo).toHaveCount(0);
    await expect(page.getByTestId('timer')).toHaveCount(0);
  });
});

test.describe('tries and marks', () => {
  test('right on the first try counts as ✅ with the chime and moves on', async ({ page, audio }) => {
    const screen = await start({ page, audio });

    await screen.solveFirstTry();

    await expect(screen.progress).toHaveText('1 / 20');
    expect(await audio.effects()).toEqual(['chime']);
  });

  test('wrong then right shows "got it!" and the verdict, counts as ❌, and makes no ❌ sound', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    const statement = await screen.answerWrong();

    await expect(screen.feedback).toContainText('Try again');
    await expect(screen.progress).toHaveText('0 / 20');
    expect((await screen.read()).text).toBe(statement.text); // the same problem, a second try
    expect(await audio.effects()).toEqual([]);

    await screen.tap(isTrue(statement));
    await expect(screen.feedback).toContainText('got it!');
    await expect(screen.problem).toContainText(`${statement.text} ${isTrue(statement) ? 'True' : 'False'}`);
    await expect(screen.strategy).toHaveCount(0);
    expect(await audio.effects()).toEqual([]);

    await screen.next.click();
    await expect(screen.progress).toHaveText('1 / 20');
    await screen.playRound();
    await expect(screen.summary).toBeVisible();
    await expect(page.getByTestId('correct-count')).toHaveText('19');
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('wrong twice shows the answer and why (both sides worked out), plays the ❌ sound only then, and counts as ❌', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    const statement = await screen.answerWrong();
    await expect(screen.feedback).toContainText('Try again');
    expect(await audio.effects()).toEqual([]);

    await screen.tap(!isTrue(statement));

    await expect(screen.feedback).toContainText(`The answer is ${isTrue(statement) ? 'True' : 'False'}`);
    const why = (await screen.strategy.textContent())!;
    expect(why).toContain(`Left: ${statement.left.plain ? statement.left.text : `${statement.left.text} = ${statement.left.value}`}.`);
    expect(why).toContain(`Right: ${statement.right.plain ? statement.right.text : `${statement.right.text} = ${statement.right.value}`}.`);
    expect(why).toContain(isTrue(statement) ? 'so it is true' : 'so it is false');
    await expect.poll(() => audio.effects()).toEqual(['gentle']);

    await screen.next.click();
    await expect(screen.progress).toHaveText('1 / 20');
    await screen.playRound();
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('with Sounds off a missed problem makes no sound', async ({ page, audio }) => {
    await setUpLearner(page, { lessons: ['fixture-math-tf'] });
    await setSoundEffects(page, false);
    const screen = new TrueOrFalseScreen(page, audio);
    await screen.open(LESSON);

    await screen.solveMissed();
    await screen.solveFirstTry();

    expect(await audio.effects()).toEqual([]);
  });

  test('finishing a session with no misses plays the fanfare and shows the score', async ({ page, audio }) => {
    const screen = await start({ page, audio });

    await screen.playRound();

    await expect(screen.completion).toBeVisible();
    await expect(page.getByText('Rounds: 1')).toBeVisible();
    expect(await audio.effects()).toEqual([...Array<string>(19).fill('chime'), 'fanfare']);
  });
});

test.describe('retry rounds', () => {
  test('a retry round covers exactly the ❌ problems, each replaced by a new problem of the same kind', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    const missedAt = new Set([2, 5, 11]);

    const first = await screen.playRound((_, index) => (missedAt.has(index) ? (index === 5 ? 'second' : 'missed') : 'first'));

    await expect(screen.summary).toBeVisible();
    await expect(page.getByTestId('correct-count')).toHaveText('17');
    await expect(page.getByTestId('wrong-count')).toHaveText('3');
    const missed = first.filter((_, index) => missedAt.has(index));
    await screen.retry.click();
    await expect(screen.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    await expect(screen.progress).toHaveText('0 / 3');

    const second = await screen.playRound();

    expect(second).toHaveLength(3);
    expect(countBy(second, kindOf)).toEqual(countBy(missed, kindOf));
    const everyIdentity = new Set(first.map(identityOf));
    for (const statement of second) expect(everyIdentity.has(identityOf(statement))).toBe(false);
    await expect(screen.completion).toBeVisible();
    await expect(page.getByText('17 of 20 on the first try!')).toBeVisible();
    await expect(page.getByText('Rounds: 2')).toBeVisible();
  });
});

test.describe('reloading resumes the exact state', () => {
  test('after a first try that was wrong: the same problem, Try again, and the second try still pending', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    await screen.solveFirstTry();
    const statement = await screen.answerWrong();
    await expect(screen.feedback).toContainText('Try again');

    await page.reload();

    await expect(screen.progress).toHaveText('1 / 20');
    expect((await screen.read()).text).toBe(statement.text);
    await expect(screen.feedback).toContainText('Try again');
    await screen.tap(isTrue(statement));
    await expect(screen.feedback).toContainText('got it!');
  });

  test('after "got it!": still showing it, and Next carries on', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    const statement = await screen.answerWrong();
    await screen.tap(isTrue(statement));
    await expect(screen.feedback).toContainText('got it!');

    await screen.reopenViaKeepGoing();

    await expect(screen.feedback).toContainText('got it!');
    await expect(screen.problem).toContainText(`${statement.text} ${isTrue(statement) ? 'True' : 'False'}`);
    await expect(screen.progress).toHaveText('0 / 20');
    await screen.next.click();
    await expect(screen.progress).toHaveText('1 / 20');
  });

  test('after the answer was shown: the answer and why again, without a second ❌ sound', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    const statement = await screen.answerWrong();
    await screen.tap(!isTrue(statement));
    const why = await screen.strategy.textContent();

    await page.reload();
    await audio.clear();

    await expect(screen.feedback).toContainText(`The answer is ${isTrue(statement) ? 'True' : 'False'}`);
    await expect(screen.strategy).toHaveText(why!);
    await expect(screen.progress).toHaveText('0 / 20');
    expect(await audio.effects()).toEqual([]);
    await screen.next.click();
    await expect(screen.progress).toHaveText('1 / 20');
  });

  test('on a fresh problem, with the same problems still to come', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    await screen.solveFirstTry();
    await screen.solveFirstTry();
    const statement = await screen.read();

    await screen.reopenViaKeepGoing();

    await expect(screen.progress).toHaveText('2 / 20');
    expect((await screen.read()).text).toBe(statement.text);
    await expect(screen.feedback).toHaveCount(0);
    const rest = await screen.playRound();
    expect(rest).toHaveLength(18);
    expect(rest[0]!.text).toBe(statement.text);
  });

  test('at the round summary and in the retry round: the same after a reload', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    await screen.playRound((_, index) => (index < 2 ? 'missed' : 'first'));
    await expect(screen.summary).toBeVisible();

    await page.reload();

    await expect(screen.summary).toBeVisible();
    await expect(page.getByTestId('wrong-count')).toHaveText('2');
    await screen.retry.click();
    const retried = await screen.read();
    await expect(screen.progress).toHaveText('0 / 2');

    await page.reload();

    await expect(screen.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    expect((await screen.read()).text).toBe(retried.text);
  });

  test('is saved before the screen moves on: the practice in progress shows on home with its place and label', async ({ page, audio }) => {
    const screen = await start({ page, audio });
    await screen.solveFirstTry();
    await screen.solveFirstTry();
    await screen.solveFirstTry();

    await page.goto('./');

    await expect(screen.keepGoing).toContainText(LESSON);
    await expect(screen.keepGoing).toContainText('True?');
    await expect(screen.keepGoing.getByTestId('progress-text')).toHaveText('3 / 20');
  });
});

test.describe('breaks', () => {
  test('count a finished problem, not each try', async ({ page, audio }) => {
    const screen = await start({ page, audio }, LESSON, 5);
    await screen.solveSecondTry();
    await screen.solveMissed();
    for (let i = 0; i < 2; i++) await screen.solveFirstTry();
    await expect(screen.breakPrompt).toHaveCount(0);

    await screen.solveFirstTry();

    await expect(screen.breakPrompt).toBeVisible();
    await expect(screen.trueButton).toHaveCount(0);
    await page.getByRole('button', { name: 'Break' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await screen.keepGoing.click();
    await expect(screen.progress).toHaveText('5 / 20');
    await expect(screen.problem).toBeVisible();
  });
});
