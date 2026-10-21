// Seam 1: the Math subject and its Facts practice type (ticket 49). A math lesson holds rules, so the problems are
// random: the driver reads each problem on screen and works out the answer itself (math-driver.ts).
import type { Page } from '@playwright/test';
import { expect, test, type AudioProbe } from './harness.ts';
import { answerOf, FactsScreen, identityOf, kindOf, textOf } from './math-driver.ts';
import { openSettings, setSoundEffects, setUpLearner } from './parent-driver.ts';

const LESSON = 'Fixture Math';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
}

async function start({ page, audio }: Fixtures, title = LESSON, breakEvery?: 5 | 10 | 15): Promise<FactsScreen> {
  await setUpLearner(page);
  if (breakEvery !== undefined) {
    await openSettings(page);
    const choice = page.getByRole('radio', { name: String(breakEvery), exact: true });
    await choice.click();
    await expect(choice).toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();
  }
  const facts = new FactsScreen(page, audio);
  await facts.open(title);
  await audio.clear();
  return facts;
}

const countBy = <T>(items: T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {});

test.describe('math lessons on home', () => {
  test('a math lesson shows with a Math tag and a Facts button; a Chinese lesson is tagged Chinese', async ({ page }) => {
    await setUpLearner(page);

    const card = page.getByRole('group', { name: LESSON, exact: true });
    await expect(card.getByTestId('subject-tag')).toHaveText('Math');
    await expect(card.getByRole('link', { name: /Facts · 20 problems/ })).toBeVisible();
    await expect(card.getByText('Test: 2026-10-26 to 2026-10-30')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Fixture Three', exact: true }).getByTestId('subject-tag')).toHaveText('Chinese');
  });
});

test.describe('a Facts session', () => {
  test('has 20 problems spread evenly over the kinds, half within 10 and half across ten, with no repeats', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    await expect(facts.progress).toHaveText('0 / 20');

    const shown = await facts.playRound();

    expect(shown).toHaveLength(20);
    expect(countBy(shown, kindOf)).toEqual({
      'add-within-10': 5,
      'add-across-ten': 5,
      'subtract-within-10': 5,
      'subtract-across-ten': 5,
    });
    expect(new Set(shown.map(identityOf)).size).toBe(20);
    for (const { a, b } of shown) {
      expect(Math.max(a, b)).toBeLessThanOrEqual(20);
    }
    await expect(facts.completion).toBeVisible();
    await expect(page.getByText('20 of 20 on the first try!')).toBeVisible();
  });

  test('follows the lesson rules: a lesson that only adds has only adding problems, half within 10 and half across ten', async ({ page, audio }) => {
    const facts = await start({ page, audio }, 'Fixture Adding Only');

    const shown = await facts.playRound();

    expect(shown).toHaveLength(20);
    expect(shown.every(({ op }) => op === '+')).toBe(true);
    expect(countBy(shown, kindOf)).toEqual({ 'add-within-10': 10, 'add-across-ten': 10 });
    expect(new Set(shown.map(identityOf)).size).toBe(20);
  });

  test('shows a problem with a number pad, and no Undo, Shuffle or timer', async ({ page, audio }) => {
    const facts = await start({ page, audio });

    await facts.read();
    for (const digit of '0123456789') await expect(page.getByRole('button', { name: digit, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'OK', exact: true })).toBeVisible();
    await expect(facts.undo).toHaveCount(0);
    await facts.solveFirstTry();
    await expect(facts.undo).toHaveCount(0);
    await expect(page.getByTestId('timer')).toHaveCount(0);
  });

  test('uses the digits tapped: Delete takes one back', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    const equation = await facts.read();
    const answer = answerOf(equation);

    await page.getByRole('button', { name: String((answer + 3) % 10), exact: true }).click();
    await expect(facts.problem).toContainText(`= ${(answer + 3) % 10}`);
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(facts.problem).toContainText('= ?');
    await facts.submit(answer);

    await expect(facts.progress).toHaveText('1 / 20');
  });

  test('OK with nothing entered does nothing', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    const equation = await facts.read();

    await page.getByRole('button', { name: 'OK', exact: true }).click();

    await expect(facts.progress).toHaveText('0 / 20');
    expect(await facts.read()).toEqual(equation);
    await expect(facts.feedback).toHaveCount(0);
  });
});

test.describe('tries and marks', () => {
  test('right on the first try counts as ✅ with the chime and moves on', async ({ page, audio }) => {
    const facts = await start({ page, audio });

    await facts.solveFirstTry();

    await expect(facts.progress).toHaveText('1 / 20');
    expect(await audio.effects()).toEqual(['chime']);
  });

  test('wrong then right shows "got it!", counts as ❌, and makes no ❌ sound', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    const equation = await facts.answerWrong();

    await expect(facts.feedback).toContainText('Try again');
    await expect(facts.progress).toHaveText('0 / 20');
    expect(await facts.read()).toEqual(equation); // the same problem, a second try
    expect(await audio.effects()).toEqual([]);

    await facts.submit(answerOf(equation));
    await expect(facts.feedback).toContainText('got it!');
    await expect(facts.problem).toContainText(`${textOf(equation)} = ${answerOf(equation)}`);
    await expect(facts.strategy).toHaveCount(0);
    expect(await audio.effects()).toEqual([]);

    await facts.next.click();
    await expect(facts.progress).toHaveText('1 / 20');
    await facts.playRound();
    await expect(facts.summary).toBeVisible();
    await expect(page.getByTestId('correct-count')).toHaveText('19');
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('wrong twice shows the answer and a worked strategy, plays the ❌ sound only then, and counts as ❌', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    const equation = await facts.answerWrong();
    await expect(facts.feedback).toContainText('Try again');
    expect(await audio.effects()).toEqual([]);

    await facts.submit(answerOf(equation) + 1);

    await expect(facts.feedback).toContainText(`The answer is ${answerOf(equation)}`);
    const strategy = (await facts.strategy.textContent())!;
    expect(strategy.startsWith(`${textOf(equation)} = `)).toBe(true);
    expect(strategy).toContain(String(answerOf(equation)));
    await expect.poll(() => audio.effects()).toEqual(['gentle']);

    await facts.next.click();
    await expect(facts.progress).toHaveText('1 / 20');
    await facts.playRound();
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('the strategy for an across-ten problem makes the ten: 8 + 6 = 8 + 2 + 4 = 14', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    // Solve problems until an across-ten one comes up, then miss it twice.
    for (;;) {
      const equation = await facts.read();
      if (kindOf(equation) === 'add-across-ten') {
        await facts.answerWrong();
        await facts.submit(answerOf(equation) + 1);
        const toTen = 10 - (equation.a % 10);
        await expect(facts.strategy).toHaveText(`${equation.a} + ${equation.b} = ${equation.a} + ${toTen} + ${equation.b - toTen} = ${equation.a + equation.b}`);
        return;
      }
      await facts.solveFirstTry();
    }
  });

  test('with Sounds off a missed problem makes no sound', async ({ page, audio }) => {
    await setUpLearner(page);
    await setSoundEffects(page, false);
    const facts = new FactsScreen(page, audio);
    await facts.open(LESSON);

    const equation = await facts.answerWrong();
    await facts.submit(answerOf(equation) + 1);
    await expect(facts.strategy).toBeVisible();
    await facts.next.click();
    await facts.solveFirstTry();

    expect(await audio.effects()).toEqual([]);
  });

  test('finishing a session with no misses plays the fanfare and shows the score', async ({ page, audio }) => {
    const facts = await start({ page, audio });

    await facts.playRound();

    await expect(facts.completion).toBeVisible();
    await expect(page.getByText('Rounds: 1')).toBeVisible();
    expect(await audio.effects()).toEqual([...Array<string>(19).fill('chime'), 'fanfare']);
  });
});

test.describe('retry rounds', () => {
  test('a retry round covers exactly the ❌ problems, each replaced by a new problem of the same kind', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    const missedAt = new Set([2, 5, 11]);

    const first = await facts.playRound((_, index) => (missedAt.has(index) ? (index === 5 ? 'second' : 'missed') : 'first'));

    await expect(facts.summary).toBeVisible();
    await expect(page.getByTestId('correct-count')).toHaveText('17');
    await expect(page.getByTestId('wrong-count')).toHaveText('3');
    const missed = first.filter((_, index) => missedAt.has(index));
    await facts.retry.click();
    await expect(facts.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    await expect(facts.progress).toHaveText('0 / 3');

    const second = await facts.playRound();

    expect(second).toHaveLength(3);
    expect(countBy(second, kindOf)).toEqual(countBy(missed, kindOf));
    const everyIdentity = new Set(first.map(identityOf));
    for (const equation of second) expect(everyIdentity.has(identityOf(equation))).toBe(false);
    await expect(facts.completion).toBeVisible();
    await expect(page.getByText('17 of 20 on the first try!')).toBeVisible();
    await expect(page.getByText('Rounds: 2')).toBeVisible();
  });

  test('a retry round that has misses again leads to another retry round of just those', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    await facts.playRound((_, index) => (index === 0 ? 'missed' : 'first'));
    await facts.retry.click();

    const [again] = await facts.playRound(() => 'missed');

    await expect(facts.summary).toBeVisible();
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
    await facts.retry.click();
    await expect(facts.roundBadge).toHaveAttribute('aria-label', 'Round 3');
    const [third] = await facts.playRound();
    expect(kindOf(third!)).toBe(kindOf(again!));
    await expect(page.getByText('Rounds: 3')).toBeVisible();
  });
});

test.describe('reloading resumes the exact state', () => {
  test('after a first try that was wrong: the same problem, Try again, and the second try still pending', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    await facts.solveFirstTry();
    const equation = await facts.answerWrong();
    await expect(facts.feedback).toContainText('Try again');

    await page.reload();

    await expect(facts.progress).toHaveText('1 / 20');
    expect(await facts.read()).toEqual(equation);
    await expect(facts.feedback).toContainText('Try again');
    await facts.submit(answerOf(equation));
    await expect(facts.feedback).toContainText('got it!');
  });

  test('after "got it!": still showing it, and Next carries on', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    const equation = await facts.answerWrong();
    await facts.submit(answerOf(equation));
    await expect(facts.feedback).toContainText('got it!');

    await facts.reopenViaKeepGoing();

    await expect(facts.feedback).toContainText('got it!');
    await expect(facts.problem).toContainText(`${textOf(equation)} = ${answerOf(equation)}`);
    await expect(facts.progress).toHaveText('0 / 20');
    await facts.next.click();
    await expect(facts.progress).toHaveText('1 / 20');
  });

  test('after the answer was shown: the answer and strategy again, without a second ❌ sound', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    const equation = await facts.answerWrong();
    await facts.submit(answerOf(equation) + 1);
    const strategy = await facts.strategy.textContent();

    await page.reload();
    await audio.clear();

    await expect(facts.feedback).toContainText(`The answer is ${answerOf(equation)}`);
    await expect(facts.strategy).toHaveText(strategy!);
    await expect(facts.progress).toHaveText('0 / 20');
    expect(await audio.effects()).toEqual([]);
    await facts.next.click();
    await expect(facts.progress).toHaveText('1 / 20');
  });

  test('on a fresh problem, with the same problems still to come', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    await facts.solveFirstTry();
    await facts.solveFirstTry();
    const equation = await facts.read();

    await facts.reopenViaKeepGoing();

    await expect(facts.progress).toHaveText('2 / 20');
    expect(await facts.read()).toEqual(equation);
    await expect(facts.feedback).toHaveCount(0);
    const rest = await facts.playRound();
    expect(rest).toHaveLength(18);
    expect(rest[0]).toEqual(equation);
  });

  test('at the round summary: the counts and the retry button; the retry round is the same after a reload too', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    await facts.playRound((_, index) => (index < 2 ? 'missed' : 'first'));
    await expect(facts.summary).toBeVisible();

    await page.reload();

    await expect(facts.summary).toBeVisible();
    await expect(page.getByTestId('wrong-count')).toHaveText('2');
    await facts.retry.click();
    const retried = await facts.read();
    await expect(facts.progress).toHaveText('0 / 2');

    await page.reload();

    await expect(facts.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    expect(await facts.read()).toEqual(retried);
  });

  test('is saved before the screen moves on: the practice in progress shows on home with its place', async ({ page, audio }) => {
    const facts = await start({ page, audio });
    await facts.solveFirstTry();
    await facts.solveFirstTry();
    await facts.solveFirstTry();

    await page.goto('./');

    await expect(facts.keepGoing).toContainText(LESSON);
    await expect(facts.keepGoing).toContainText('Facts');
    await expect(facts.keepGoing.getByTestId('progress-text')).toHaveText('3 / 20');
  });
});

test.describe('breaks', () => {
  test('count a finished problem, not each try', async ({ page, audio }) => {
    const facts = await start({ page, audio }, LESSON, 5);
    await facts.solveSecondTry(); // two tries, one finished problem
    await facts.solveMissed(); // two tries, one finished problem
    for (let i = 0; i < 2; i++) await facts.solveFirstTry();
    await expect(facts.breakPrompt).toHaveCount(0);

    await facts.solveFirstTry();

    await expect(facts.breakPrompt).toBeVisible();
    await expect(page.getByRole('button', { name: 'OK', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Break' }).click();
    await expect(page).toHaveURL(/#\/$/);

    await facts.keepGoing.click();
    await expect(facts.progress).toHaveText('5 / 20');
    await expect(facts.problem).toBeVisible();
  });
});

test.describe('the parent area', () => {
  test('says Shuffle does not apply to math, next to the setting', async ({ page }) => {
    await setUpLearner(page);
    await openSettings(page);

    await expect(page.getByRole('switch', { name: /Shuffle the first round/ })).toContainText('Not applicable to math');
  });
});
