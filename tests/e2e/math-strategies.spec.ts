// Seam 1: the Strategies practice type (🧠 Tricks, ticket 52). A strategy problem has several blanks, answered one at
// a time on the number pad; its mark is ✅ only if every step is right on its first try. Problems are random, so the
// driver reads each line from the screen and works out the blank itself (strategies-driver.ts).
import type { Page } from '@playwright/test';
import { expect, test, type AudioProbe } from './harness.ts';
import { editSavedData } from './backup-driver.ts';
import { openSettings, setSoundEffects, setUpLearner } from './parent-driver.ts';
import {
  blankOf,
  checkShape,
  identityOfShown,
  kindOfShown,
  STEPS_OF,
  STRATEGY_KINDS,
  STRATEGY_TITLES,
  StrategiesScreen,
  type How,
} from './strategies-driver.ts';

const LESSON = 'Fixture Strategies';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
}

async function start({ page, audio }: Fixtures, title = LESSON, breakEvery?: 5 | 10 | 15): Promise<StrategiesScreen> {
  await setUpLearner(page);
  if (breakEvery !== undefined) {
    await openSettings(page);
    const choice = page.getByRole('radiogroup', { name: 'Break every' }).getByRole('radio', { name: String(breakEvery), exact: true });
    await choice.click();
    await expect(choice).toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();
  }
  const tricks = new StrategiesScreen(page, audio);
  await tricks.open(title);
  await audio.clear();
  return tricks;
}

const countBy = <T>(items: T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {});

test.describe('strategies on home', () => {
  test('a lesson with strategies rules shows a 🧠 Tricks button with 20 problems; others do not', async ({ page }) => {
    await setUpLearner(page);

    const card = page.getByRole('group', { name: LESSON, exact: true });
    await expect(card.getByTestId('subject-tag')).toHaveText('Math');
    await expect(card.getByRole('link', { name: /Tricks · 20 problems/ })).toBeVisible();
    await expect(card.getByRole('link', { name: /Facts/ })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Fixture Math', exact: true }).getByRole('link', { name: /Tricks/ })).toHaveCount(0);
  });
});

test.describe('a Tricks session', () => {
  test('has 20 problems covering every kind, spread evenly, with no repeats and every blank right', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    await expect(tricks.progress).toHaveText('0 / 20');

    const shown = await tricks.playRound();

    expect(shown).toHaveLength(20);
    const counts = countBy(shown, (problem) => kindOfShown(problem));
    expect(Object.keys(counts).sort()).toEqual([...STRATEGY_KINDS].sort());
    for (const kind of STRATEGY_KINDS) expect([2, 3]).toContain(counts[kind]); // 20 over 7 kinds: 2 or 3 each
    expect(new Set(shown.map(identityOfShown)).size).toBe(20);
    for (const problem of shown) {
      const kind = kindOfShown(problem);
      expect(STEPS_OF[kind]).toContain(problem.lines.length);
      checkShape(problem); // the school's worked form of that kind, with its arithmetic right
      // Its title (with the given line, when it has one) and a short plain hint under every line.
      expect(problem.title).toBe(problem.given === null ? STRATEGY_TITLES[kind] : `${STRATEGY_TITLES[kind]}: ${problem.given}`);
      expect(problem.hints).toHaveLength(problem.lines.length);
      for (const hint of problem.hints) {
        expect(hint.length, hint).toBeGreaterThan(0);
        expect(hint.split(' ').length, hint).toBeLessThanOrEqual(8);
        expect(hint, hint).not.toMatch(/commutative|addend|(^|\s)\?|☐/);
      }
      for (const earlier of problem.lines.slice(0, -1)) expect(earlier).not.toContain('☐');
      for (const number of (problem.lines.join(' ') + (problem.given ?? '')).match(/\d+/g)!) expect(Number(number)).toBeLessThanOrEqual(20);
    }
    await expect(tricks.completion).toBeVisible();
    await expect(page.getByText('20 of 20 on the first try!')).toBeVisible();
  });

  test('follows the lesson rules: a lesson that only adds has no subtraction kinds', async ({ page, audio }) => {
    const tricks = await start({ page, audio }, 'Fixture Adding Tricks');

    const shown = await tricks.playRound();

    expect(shown).toHaveLength(20);
    const kinds = new Set(shown.map((problem) => kindOfShown(problem)));
    expect([...kinds].sort()).toEqual(['count-on', 'make-ten', 'make-ten-three', 'near-doubles', 'swap-order']);
    for (const kind of kinds) expect(countBy(shown, (p) => kindOfShown(p))[kind]).toBe(4);
    expect(shown.some((problem) => problem.lines.some((line) => line.includes('−')))).toBe(false);
  });

  test('shows one blank at a time with the earlier steps filled in, and no Undo, Shuffle or timer', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    const first = await tricks.read();
    expect(first.lines).toHaveLength(1);
    expect(first.lines[0]).toContain('☐');
    expect(first.hints).toHaveLength(1); // a hint for each line shown so far
    await expect(tricks.title).toBeVisible();
    await expect(page.getByTestId('answer')).toHaveCount(1);
    for (const digit of '0123456789') await expect(page.getByRole('button', { name: digit, exact: true })).toBeVisible();
    await expect(tricks.undo).toHaveCount(0);
    await expect(page.getByTestId('timer')).toHaveCount(0);

    await tricks.answerRight();

    const second = await tricks.read();
    expect(second.lines).toHaveLength(2);
    expect(second.lines[0]).not.toContain('☐'); // the first step stays, with its answer
    expect(second.lines[1]).toContain('☐');
    expect(second.hints).toHaveLength(2);
    await expect(page.getByTestId('answer')).toHaveCount(1);
    await expect(tricks.progress).toHaveText('0 / 20'); // not counted until the whole problem is done
  });

  test('uses the digits tapped: Delete takes one back, and Check with nothing entered does nothing', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    const before = await tricks.read();
    const answer = await tricks.currentAnswer();

    await page.getByRole('button', { name: 'Check', exact: true }).click();
    expect(await tricks.read()).toEqual(before);
    await expect(tricks.feedback).toHaveCount(0);

    const wrongDigit = String((answer + 3) % 10);
    await page.getByRole('button', { name: wrongDigit, exact: true }).click();
    await expect(page.getByTestId('answer')).toHaveText(wrongDigit);
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('answer')).toHaveText('');
    await expect(page.getByTestId('answer')).toHaveAccessibleName('blank');
    await tricks.submit(answer);

    await expect(tricks.steps).toHaveCount(2);
  });
});

test.describe('marks: ✅ only if every step is right on its first try', () => {
  test('every step right first time is ✅: one chime when the problem is done, none per step', async ({ page, audio }) => {
    const tricks = await start({ page, audio });

    const first = await tricks.read();
    await tricks.answerRight();
    await expect(tricks.steps).toHaveCount(2);
    expect(await audio.effects()).toEqual([]); // a step on its own makes no sound
    expect(first.lines).toHaveLength(1);
    await tricks.solveProblem();

    await expect(tricks.progress).toHaveText('1 / 20');
    expect(await audio.effects()).toEqual(['chime']);
  });

  test('a wrong first try on a step says Try again and keeps the step; a right second try says "got it!" and Next goes to the next step', async ({
    page,
    audio,
  }) => {
    const tricks = await start({ page, audio });
    const shown = await tricks.read();
    const answer = await tricks.currentAnswer();

    await tricks.answerWrong();

    await expect(tricks.feedback).toContainText('Try again');
    expect(await tricks.read()).toEqual(shown); // the same step, nothing revealed
    expect(await audio.effects()).toEqual([]);

    await tricks.submit(answer);

    await expect(tricks.feedback).toContainText('got it!');
    await expect(tricks.strategy).toHaveCount(0);
    expect(await audio.effects()).toEqual([]);
    await expect(tricks.progress).toHaveText('0 / 20'); // the problem is not over: later steps remain
    await tricks.next.click();
    await expect(tricks.steps).toHaveCount(2);
    await expect(tricks.feedback).toHaveCount(0);
    expect((await tricks.read()).lines[0]).not.toContain('☐');
  });

  test('wrong twice on a step shows its answer and a one-line explanation, plays the ❌ sound only then, and moves on to the next step', async ({
    page,
    audio,
  }) => {
    const tricks = await start({ page, audio });
    const answer = await tricks.currentAnswer();
    await tricks.answerWrong();
    await expect(tricks.feedback).toContainText('Try again');
    expect(await audio.effects()).toEqual([]);

    await tricks.submit(answer + 1);

    await expect(tricks.feedback).toContainText(`The answer is ${answer}`);
    await expect(tricks.strategy).toBeVisible();
    expect(((await tricks.strategy.textContent()) ?? '').trim().length).toBeGreaterThan(10);
    expect(await tricks.strategy.locator('br').count()).toBe(0); // one line
    await expect.poll(() => audio.effects()).toEqual(['gentle']);
    await expect(tricks.progress).toHaveText('0 / 20');

    await tricks.next.click();
    await expect(tricks.steps).toHaveCount(2);
    expect((await tricks.read()).lines[0]).toContain(String(answer)); // the missed step now shows its answer
    await expect(tricks.feedback).toHaveCount(0);
    await tricks.solveProblem();
    await expect(tricks.progress).toHaveText('1 / 20');
    await tricks.playRound();
    await expect(page.getByTestId('correct-count')).toHaveText('19');
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('one missed step makes the problem ❌ whichever step it is, even if every other step is first try', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    const missAt = (index: number, step: number): How => {
      if (index === 0) return step === 0 ? 'missed' : 'first'; // the first step
      if (index === 1) return step === 1 ? 'second' : 'first'; // the second step, got on the second try
      if (index === 2) return step === 2 ? 'second' : 'first'; // the third step when there is one
      return 'first';
    };

    const shown = await tricks.playRound(missAt);

    await expect(tricks.summary).toBeVisible();
    const lastStepExists = shown[2]!.lines.length >= 3;
    await expect(page.getByTestId('wrong-count')).toHaveText(lastStepExists ? '3' : '2');
    await expect(page.getByTestId('correct-count')).toHaveText(lastStepExists ? '17' : '18');
  });

  test('a problem is finished and counted once, after its last step, however many tries it took', async ({ page, audio }) => {
    const tricks = await start({ page, audio });

    await tricks.solveProblem((step) => (step === 0 ? 'missed' : 'second'));

    await expect(tricks.progress).toHaveText('1 / 20');
    await tricks.solveProblem();
    await expect(tricks.progress).toHaveText('2 / 20');
  });

  test('with Sounds off a missed step makes no sound', async ({ page, audio }) => {
    await setUpLearner(page);
    await setSoundEffects(page, false);
    const tricks = new StrategiesScreen(page, audio);
    await tricks.open(LESSON);

    await tricks.solveProblem((step) => (step === 0 ? 'missed' : 'first'));
    await tricks.solveProblem();

    expect(await audio.effects()).toEqual([]);
  });

  test('finishing a session with no misses plays the fanfare and shows the score', async ({ page, audio }) => {
    const tricks = await start({ page, audio });

    await tricks.playRound();

    await expect(tricks.completion).toBeVisible();
    await expect(page.getByText('Rounds: 1')).toBeVisible();
    expect(await audio.effects()).toEqual([...Array<string>(19).fill('chime'), 'fanfare']);
  });
});

test.describe('a missed step explains itself in one line', () => {
  test('swap order: adding in any order gives the same answer', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    await tricks.goToLastStep('swap-order');

    await tricks.answerWrong();
    await tricks.submit((await tricks.currentAnswer()) + 1);

    await expect(tricks.strategy).toContainText('any order');
  });

  test('related fact: the explanation uses the sum it was given', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    const shown = await tricks.goToLastStep('related-fact');
    const sum = shown.lines[0]!; // "8 + 4 = 12"

    await tricks.answerWrong();
    await tricks.submit((await tricks.currentAnswer()) + 1);

    await expect(tricks.strategy).toContainText(sum);
  });
});

test.describe('retry rounds', () => {
  test('a retry round covers exactly the ❌ problems, each replaced by a new problem of the same kind', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    const missedAt = new Set([2, 5, 11]);

    const first = await tricks.playRound((index, step) => (missedAt.has(index) && step === 0 ? (index === 5 ? 'second' : 'missed') : 'first'));

    await expect(tricks.summary).toBeVisible();
    await expect(page.getByTestId('correct-count')).toHaveText('17');
    await expect(page.getByTestId('wrong-count')).toHaveText('3');
    const missed = first.filter((_, index) => missedAt.has(index));
    await tricks.retry.click();
    await expect(tricks.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    await expect(tricks.progress).toHaveText('0 / 3');

    const second = await tricks.playRound();

    expect(second).toHaveLength(3);
    expect(countBy(second, (p) => kindOfShown(p))).toEqual(countBy(missed, (p) => kindOfShown(p)));
    const everyIdentity = new Set(first.map(identityOfShown));
    for (const problem of second) expect(everyIdentity.has(identityOfShown(problem))).toBe(false);
    await expect(tricks.completion).toBeVisible();
    await expect(page.getByText('17 of 20 on the first try!')).toBeVisible();
    await expect(page.getByText('Rounds: 2')).toBeVisible();
  });
});

test.describe('reloading resumes the exact state, mid-problem too', () => {
  test('after the first step was answered right: the second step, with the first still shown', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    await tricks.solveProblem();
    await tricks.answerRight();
    const shown = await tricks.read();
    expect(shown.lines).toHaveLength(2);

    await page.reload();

    await expect(tricks.progress).toHaveText('1 / 20');
    expect(await tricks.read()).toEqual(shown);
    await expect(tricks.feedback).toHaveCount(0);
  });

  test('after a wrong first try on a later step: the same step, Try again, and the second try still pending', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    await tricks.answerRight();
    const shown = await tricks.read();
    await tricks.answerWrong();
    await expect(tricks.feedback).toContainText('Try again');

    await page.reload();

    await expect(tricks.progress).toHaveText('0 / 20');
    expect(await tricks.read()).toEqual(shown);
    await expect(tricks.feedback).toContainText('Try again');
    // It really is the second try: right now is "got it!" and the problem is ❌, not ✅.
    await tricks.answerRight();
    await expect(tricks.feedback).toContainText('got it!');
    await tricks.next.click();
    await tricks.playRound();
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('after "got it!" on a step: still showing it, and Next carries on', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    const answer = await tricks.currentAnswer();
    await tricks.answerWrong();
    await tricks.submit(answer);
    await expect(tricks.feedback).toContainText('got it!');

    await tricks.reopenViaKeepGoing();

    await expect(tricks.feedback).toContainText('got it!');
    await expect(tricks.progress).toHaveText('0 / 20');
    await tricks.next.click();
    await expect(tricks.steps).toHaveCount(2);
  });

  test('after a step was missed: its answer and explanation again, without a second ❌ sound, and Next carries on', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    const answer = await tricks.currentAnswer();
    await tricks.answerWrong();
    await tricks.submit(answer + 1);
    const explanation = await tricks.strategy.textContent();

    await page.reload();
    await audio.clear();

    await expect(tricks.feedback).toContainText(`The answer is ${answer}`);
    await expect(tricks.strategy).toHaveText(explanation!);
    expect(await audio.effects()).toEqual([]);
    await tricks.next.click();
    await expect(tricks.steps).toHaveCount(2);
    await tricks.solveProblem();
    await tricks.playRound();
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('after the last step was missed: the problem is ❌, shown with its answer, and Next moves to the next problem', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    await tricks.goToLastStep();
    const answer = await tricks.currentAnswer();
    await tricks.answerWrong();
    await tricks.submit(answer + 1);
    await expect(tricks.strategy).toBeVisible();

    await page.reload();

    await expect(tricks.feedback).toContainText(`The answer is ${answer}`);
    await expect(tricks.progress).toHaveText('0 / 20');
    await tricks.next.click();
    await expect(tricks.progress).toHaveText('1 / 20');
    await tricks.playRound();
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
  });

  test('on a fresh problem, with the same problems still to come', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    await tricks.solveProblem();
    await tricks.solveProblem();
    const shown = await tricks.read();

    await tricks.reopenViaKeepGoing();

    await expect(tricks.progress).toHaveText('2 / 20');
    expect(await tricks.read()).toEqual(shown);
    const rest = await tricks.playRound();
    expect(rest).toHaveLength(18);
    expect(rest[0]!.given).toBe(shown.given);
    const firstLine = shown.lines[0]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('☐', '\\d+');
    expect(rest[0]!.lines[0]).toMatch(new RegExp(`^${firstLine}$`)); // the same problem, its blank now filled
  });

  test('at the round summary and in a retry round: the counts, the retry button and the retry round come back the same', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    await tricks.playRound((index, step) => (index < 2 && step === 0 ? 'missed' : 'first'));
    await expect(tricks.summary).toBeVisible();

    await page.reload();

    await expect(tricks.summary).toBeVisible();
    await expect(page.getByTestId('wrong-count')).toHaveText('2');
    await tricks.retry.click();
    const retried = await tricks.read();
    await expect(tricks.progress).toHaveText('0 / 2');

    await page.reload();

    await expect(tricks.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    expect(await tricks.read()).toEqual(retried);
  });

  test('is saved before the screen moves on: Keep going on home shows the place, and the tries survive a backup round trip', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    await tricks.solveProblem();
    // A step with a wrong try then a right one, then a wrong try on the next step: three tries in one problem.
    await tricks.solveStep('second', 1, 1);
    const shown = await tricks.read();
    await tricks.answerWrong();
    await expect(tricks.feedback).toContainText('Try again');

    await page.goto('./');
    await editSavedData(page, (saved) => saved); // through backup export and import validation

    await expect(tricks.keepGoing).toContainText(LESSON);
    await expect(tricks.keepGoing).toContainText('Tricks');
    await expect(tricks.keepGoing.getByTestId('progress-text')).toHaveText('1 / 20');
    await tricks.keepGoing.click();
    expect(await tricks.read()).toEqual(shown);
    await expect(tricks.feedback).toContainText('Try again');
    expect(blankOf((await tricks.read()).lines.at(-1)!)).toBeGreaterThanOrEqual(0);
  });
});

test.describe('breaks', () => {
  test('count a finished problem, not each step or try', async ({ page, audio }) => {
    const tricks = await start({ page, audio }, LESSON, 5);
    await tricks.solveProblem((step) => (step === 0 ? 'second' : 'first'));
    await tricks.solveProblem((step) => (step === 0 ? 'missed' : 'first'));
    for (let i = 0; i < 2; i++) await tricks.solveProblem();
    await expect(tricks.breakPrompt).toHaveCount(0);

    await tricks.solveProblem();

    await expect(tricks.breakPrompt).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Break' }).click();
    await expect(page).toHaveURL(/#\/$/);

    await tricks.keepGoing.click();
    await expect(tricks.progress).toHaveText('5 / 20');
    await expect(tricks.problem).toBeVisible();
  });
});
