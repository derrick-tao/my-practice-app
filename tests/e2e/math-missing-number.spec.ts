// Seam 1: the Missing number practice type (ticket 50). Problems are random, so the driver reads each equation on
// screen and works out the unknown itself (missing-number-driver.ts).
import type { Page } from '@playwright/test';
import { expect, test, type AudioProbe } from './harness.ts';
import { answerOf, blankOf, completed, identityOf, kindOf, MissingNumberScreen, type MissingProblem } from './missing-number-driver.ts';
import { openSettings, setUpLearner } from './parent-driver.ts';

const LESSON = 'Fixture Missing Number';

async function start({ page, audio }: { page: Page; audio: AudioProbe }, title = LESSON, breakEvery?: 5 | 10 | 15): Promise<MissingNumberScreen> {
  await setUpLearner(page);
  if (breakEvery !== undefined) {
    await openSettings(page);
    const choice = page.getByRole('radiogroup', { name: 'Break every' }).getByRole('radio', { name: String(breakEvery), exact: true });
    await choice.click();
    await expect(choice).toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();
  }
  const missing = new MissingNumberScreen(page, audio);
  await missing.open(title);
  await audio.clear();
  return missing;
}

const countBy = <T>(items: T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {});

const KINDS = [
  'add-blank-first',
  'add-blank-middle',
  'add-blank-answer',
  'subtract-blank-first',
  'subtract-blank-middle',
  'subtract-blank-answer',
];

test.describe('the Missing button', () => {
  test('a lesson with missing-number rules offers 🔍 Missing with 20 problems', async ({ page }) => {
    await setUpLearner(page);

    const card = page.getByRole('group', { name: LESSON, exact: true });
    await expect(card.getByTestId('subject-tag')).toHaveText('Math');
    await expect(card.getByRole('link', { name: /Missing · 20 problems/ })).toBeVisible();
    await expect(card.getByRole('link', { name: /Missing/ })).toContainText('🔍');
    await expect(card.getByRole('link', { name: /Facts/ })).toHaveCount(0);
  });
});

test.describe('a Missing number session', () => {
  test('has 20 problems spread over every kind, within 20, with no repeats', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    await expect(missing.progress).toHaveText('0 / 20');

    const shown = await missing.playRound();

    expect(shown).toHaveLength(20);
    const counts = countBy(shown, kindOf);
    expect(Object.keys(counts).sort()).toEqual([...KINDS].sort());
    for (const count of Object.values(counts)) expect([3, 4]).toContain(count); // 20 over 6 kinds
    expect(new Set(shown.map(identityOf)).size).toBe(20);
    for (const problem of shown) {
      const { a, b, c } = completed(problem);
      expect(Math.max(a, b, c)).toBeLessThanOrEqual(20);
      expect(Math.min(a, b, c)).toBeGreaterThanOrEqual(1);
      expect(problem.op === '+' ? a + b : a - b).toBe(c);
    }
    await expect(missing.completion).toBeVisible();
    await expect(page.getByText('20 of 20 on the first try!')).toBeVisible();
  });

  test('writes the blank in every place, forwards and backwards, with ☐ on the left of = as well', async ({ page, audio }) => {
    const missing = await start({ page, audio });

    const shown = await missing.playRound();

    expect(new Set(shown.map(blankOf))).toEqual(new Set(['first', 'middle', 'answer']));
    expect(shown.some((p) => !p.backwards)).toBe(true);
    expect(shown.some((p) => p.backwards)).toBe(true);
    // Backwards with the blank before the "=": ☐ = 6 + 6 (only the answer can be there).
    expect(shown.some((p) => p.backwards && blankOf(p) === 'answer' && p.text.startsWith('☐'))).toBe(true);
    // Subtraction written backwards: 5 = ☐ − 3.
    expect(shown.some((p) => p.backwards && p.op === '−' && blankOf(p) !== 'answer')).toBe(true);
  });

  test('draws the same box for the blank forwards and backwards, and never a "?"', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    const seen = { forwards: 0, backwards: 0 };

    for (let i = 0; i < 20; i++) {
      await expect(missing.problem.or(missing.breakPrompt)).toBeVisible();
      if (await missing.breakPrompt.isVisible()) await missing.base.keepOn.click();
      const problem = await missing.read();
      seen[problem.backwards ? 'backwards' : 'forwards']++;
      await expect(missing.blank).toHaveCount(1);
      await expect(missing.problem).not.toContainText('?');
      await expect(missing.problem).not.toContainText('☐'); // a drawn box, not a character
      const box = await missing.blank.boundingBox();
      expect(box!.width).toBeGreaterThan(20);
      expect(box!.height).toBeGreaterThan(20);
      await missing.solveFirstTry();
    }

    expect(seen.forwards).toBeGreaterThan(0);
    expect(seen.backwards).toBeGreaterThan(0);
  });

  test('keeps the box the same size empty and filled', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    const empty = await missing.blank.boundingBox();

    await page.getByRole('button', { name: '7', exact: true }).click();
    const filled = await missing.problem.getByTestId('answer').boundingBox();

    expect(filled!.width).toBeCloseTo(empty!.width, 0);
    expect(filled!.height).toBeCloseTo(empty!.height, 0);
  });

  test('follows the lesson rules: adding only',async ({ page, audio }) => {
    const missing = await start({ page, audio }, 'Fixture Missing Adding Only');

    const shown = await missing.playRound();

    expect(shown).toHaveLength(20);
    expect(shown.every((p) => p.op === '+')).toBe(true);
    const counts = countBy(shown, kindOf);
    expect(Object.keys(counts).sort()).toEqual(['add-blank-answer', 'add-blank-first', 'add-blank-middle']);
    for (const count of Object.values(counts)) expect([6, 7]).toContain(count); // 20 over 3 kinds
    expect(new Set(shown.map(identityOf)).size).toBe(20);
    for (const problem of shown) {
      const { a, b, c } = completed(problem);
      expect(Math.max(a, b, c)).toBeLessThanOrEqual(20);
    }
  });

  test('checks the answer against the true unknown, not the result of the numbers shown', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    // Find a problem whose blank is not the answer, and type the sum or difference of the two numbers shown.
    for (;;) {
      const problem = await missing.read();
      const shownNumbers = [problem.a, problem.b, problem.c].filter((n): n is number => n !== null) as [number, number];
      const naive = problem.op === '+' ? shownNumbers[0] + shownNumbers[1] : Math.abs(shownNumbers[0] - shownNumbers[1]);
      if (blankOf(problem) === 'answer' || naive === answerOf(problem)) {
        await missing.solveFirstTry();
        continue;
      }
      await missing.submit(naive);
      await expect(missing.feedback).toContainText('Try again');
      await missing.submit(answerOf(problem));
      await expect(missing.feedback).toContainText('got it!');
      return;
    }
  });

  test('shows what is typed in the blank itself, and Delete takes a digit back', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    const problem = await missing.read();
    const digit = (answerOf(problem) + 3) % 10;

    await page.getByRole('button', { name: String(digit), exact: true }).click();
    await expect(missing.problem).toContainText(problem.text.replace('☐', String(digit)));
    await expect(missing.blank).toHaveCount(0); // the digit fills the box
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(missing.blank).toHaveCount(1);
    expect(await missing.read()).toEqual(problem);
    await missing.submit(answerOf(problem));

    await expect(missing.progress).toHaveText('1 / 20');
  });
});

test.describe('tries and marks', () => {
  test('right on the first try counts as ✅ with the chime and moves on', async ({ page, audio }) => {
    const missing = await start({ page, audio });

    await missing.solveFirstTry();

    await expect(missing.progress).toHaveText('1 / 20');
    expect(await audio.effects()).toEqual(['chime']);
  });

  test('wrong then right shows "got it!" with the blank filled in, counts as ❌, and makes no ❌ sound', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    const problem = await missing.answerWrong();

    await expect(missing.feedback).toContainText('Try again');
    await expect(missing.progress).toHaveText('0 / 20');
    expect(await missing.read()).toEqual(problem);
    expect(await audio.effects()).toEqual([]);

    await missing.submit(answerOf(problem));
    await expect(missing.feedback).toContainText('got it!');
    await expect(missing.problem).toContainText(problem.text.replace('☐', String(answerOf(problem))));
    expect(await audio.effects()).toEqual([]);

    await missing.next.click();
    await missing.playRound();
    await expect(page.getByTestId('correct-count')).toHaveText('19');
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('wrong twice shows the answer and a worked strategy, plays the ❌ sound only then, and counts as ❌', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    const problem = await missing.answerWrong();
    await expect(missing.feedback).toContainText('Try again');
    expect(await audio.effects()).toEqual([]);

    await missing.submit(answerOf(problem) + 1);

    await expect(missing.feedback).toContainText(`The answer is ${answerOf(problem)}`);
    await expect(missing.strategy).toContainText(String(answerOf(problem)));
    await expect.poll(() => audio.effects()).toEqual(['gentle']);
    await missing.next.click();
    await missing.playRound();
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('the strategy suits the kind: counting up for a missing addend, 8 + ☐ = 11 -> count up from 8 to 11', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    const seen = new Set<string>();
    for (;;) {
      const problem = await missing.read();
      const kind = kindOf(problem);
      if (problem.op === '+' && blankOf(problem) === 'middle' && !seen.has(kind)) {
        seen.add(kind);
        await missing.answerWrong();
        await missing.submit(answerOf(problem) + 1);
        const { a, c } = completed(problem);
        await expect(missing.strategy).toHaveText(`Count up from ${a} to ${c}: that is ${c - a} more, so ${a} + ${c - a} = ${c}`);
        return;
      }
      await missing.solveFirstTry();
    }
  });

  test('the strategy for subtraction as an unknown addend counts up too: 10 − 8 = ☐ -> count up from 8 to 10', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    for (;;) {
      const problem = await missing.read();
      if (problem.op === '−' && blankOf(problem) === 'answer') {
        await missing.answerWrong();
        await missing.submit(answerOf(problem) + 1);
        const { a, b, c } = completed(problem);
        await expect(missing.strategy).toHaveText(`Count up from ${b} to ${a}: that is ${c} more, so ${a} − ${b} = ${c}`);
        return;
      }
      await missing.solveFirstTry();
    }
  });

  test('finishing a session with no misses plays the fanfare and shows the score', async ({ page, audio }) => {
    const missing = await start({ page, audio });

    await missing.playRound();

    await expect(missing.completion).toBeVisible();
    await expect(page.getByText('Rounds: 1')).toBeVisible();
    expect(await audio.effects()).toEqual([...Array<string>(19).fill('chime'), 'fanfare']);
  });
});

test.describe('retry rounds', () => {
  test('a retry round covers exactly the ❌ problems, each replaced by a new problem of the same kind', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    const missedAt = new Set([2, 5, 11]);

    const first = await missing.playRound((_, index) => (missedAt.has(index) ? (index === 5 ? 'second' : 'missed') : 'first'));

    await expect(missing.summary).toBeVisible();
    await expect(page.getByTestId('wrong-count')).toHaveText('3');
    const missed = first.filter((_, index) => missedAt.has(index));
    await missing.retry.click();
    await expect(missing.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    await expect(missing.progress).toHaveText('0 / 3');

    const second = await missing.playRound();

    expect(second).toHaveLength(3);
    expect(countBy(second, kindOf)).toEqual(countBy(missed, kindOf));
    const seenBefore = new Set(first.map(identityOf));
    for (const problem of second) expect(seenBefore.has(identityOf(problem))).toBe(false);
    await expect(page.getByText('17 of 20 on the first try!')).toBeVisible();
    await expect(page.getByText('Rounds: 2')).toBeVisible();
  });
});

test.describe('reloading resumes the exact state', () => {
  test('after a first try that was wrong: the same equation, Try again, and the second try still pending', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    await missing.solveFirstTry();
    const problem = await missing.answerWrong();
    await expect(missing.feedback).toContainText('Try again');

    await page.reload();

    await expect(missing.progress).toHaveText('1 / 20');
    expect(await missing.read()).toEqual(problem);
    await expect(missing.feedback).toContainText('Try again');
    await missing.submit(answerOf(problem));
    await expect(missing.feedback).toContainText('got it!');
  });

  test('after the answer was shown: the answer and strategy again, without a second ❌ sound', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    const problem = await missing.answerWrong();
    await missing.submit(answerOf(problem) + 1);
    const strategy = await missing.strategy.textContent();

    await page.reload();
    await audio.clear();

    await expect(missing.feedback).toContainText(`The answer is ${answerOf(problem)}`);
    await expect(missing.strategy).toHaveText(strategy!);
    await expect(missing.problem).toContainText(problem.text.replace('☐', String(answerOf(problem))));
    expect(await audio.effects()).toEqual([]);
    await missing.next.click();
    await expect(missing.progress).toHaveText('1 / 20');
  });

  test('on a fresh problem, with the same problems still to come', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    await missing.solveFirstTry();
    await missing.solveFirstTry();
    const problem = await missing.read();

    await missing.reopenViaKeepGoing();

    await expect(missing.progress).toHaveText('2 / 20');
    expect(await missing.read()).toEqual(problem);
    const rest = await missing.playRound();
    expect(rest).toHaveLength(18);
    expect(rest[0]).toEqual(problem);
  });

  test('in a retry round, and the Keep going card names the practice type', async ({ page, audio }) => {
    const missing = await start({ page, audio });
    await missing.playRound((_, index) => (index < 2 ? 'missed' : 'first'));
    await missing.retry.click();
    const retried: MissingProblem = await missing.read();

    await page.goto('./');
    await expect(missing.keepGoing).toContainText('Missing');
    await missing.keepGoing.click();

    await expect(missing.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    await expect(missing.progress).toHaveText('0 / 2');
    expect(await missing.read()).toEqual(retried);
  });
});

test.describe('breaks', () => {
  test('count a finished problem, not each try', async ({ page, audio }) => {
    const missing = await start({ page, audio }, LESSON, 5);
    await missing.solveSecondTry();
    await missing.solveMissed();
    for (let i = 0; i < 2; i++) await missing.solveFirstTry();
    await expect(missing.breakPrompt).toHaveCount(0);

    await missing.solveFirstTry();

    await expect(missing.breakPrompt).toBeVisible();
  });
});
