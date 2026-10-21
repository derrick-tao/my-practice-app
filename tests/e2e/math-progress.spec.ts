// Seam 1: the parent's Progress page for a math lesson (ticket 54). Scripted attempts are put on the device through
// backup import (as in progress.spec.ts); one test plays real Facts rounds and reads the page afterwards.
// Trickiest is by problem kind ("subtract across ten: ❌ 4 of 6"); a round's missed problems show what the child entered.
import type { Page } from '@playwright/test';
import { restoreSessions, type SessionJson } from './backup-driver.ts';
import { expect, test } from './harness.ts';
import { FactsScreen, kindOf, textOf } from './math-driver.ts';
import { openParentArea, openParentSection, setUpLearner } from './parent-driver.ts';

const facts = (page: Page) => page.getByTestId('progress-part-facts');

type Kind = 'add-within-10' | 'add-across-ten' | 'subtract-within-10' | 'subtract-across-ten';

/** One scripted spot: its problem and the answers entered. The mark follows from the tries, as the app decides it. */
interface Spot {
  kind: Kind;
  a: number;
  b: number;
  entered: string[];
}

const answerOf = ({ kind, a, b }: Spot): string => String(kind.startsWith('add') ? a + b : a - b);
const right = (kind: Kind, a: number, b: number): Spot => ({ kind, a, b, entered: [answerOf({ kind, a, b, entered: [] })] });
/** Wrong then right ("got it!"): a ❌. */
const gotIt = (kind: Kind, a: number, b: number, first: string): Spot => ({ kind, a, b, entered: [first, answerOf({ kind, a, b, entered: [] })] });
/** Wrong twice (the answer was shown): a ❌. */
const missed = (kind: Kind, a: number, b: number, first: string, second: string): Spot => ({ kind, a, b, entered: [first, second] });

function mathRound(index: number, spots: Record<string, Spot>, startedAt: string, over = true) {
  const ids = Object.keys(spots);
  const marked = ids.filter((id) => spots[id]!.entered.length > 0);
  return {
    index,
    itemIds: ids,
    position: marked.length,
    phase: 'prompt',
    heardCurrent: false,
    marks: Object.fromEntries(marked.map((id) => [id, spots[id]!.entered[0] === answerOf(spots[id]!) ? 'correct' : 'wrong'])),
    startedAt,
    ...(over ? { completedAt: startedAt } : {}),
    problems: Object.fromEntries(ids.map((id) => [id, { kind: spots[id]!.kind, numbers: [spots[id]!.a, spots[id]!.b] }])),
    tries: Object.fromEntries(
      marked.map((id) => [id, spots[id]!.entered.map((answer) => ({ answer, correct: answer === answerOf(spots[id]!) }))]),
    ),
  };
}

function mathAttempt(id: string, status: 'completed' | 'stopped', startedAt: string, rounds: ReturnType<typeof mathRound>[]): SessionJson {
  return {
    id,
    profileId: 'replaced-on-restore',
    subject: 'math',
    practiceType: 'facts',
    lessonId: 'fixture-math',
    contentVersion: 'saved-before',
    status,
    startedAt,
    ...(status === 'completed' ? { completedAt: startedAt } : {}),
    updatedAt: startedAt,
    rounds,
    undo: null,
    marksSinceBreak: 0,
    mathRules: { within: 20, operations: ['add', 'subtract'] },
  };
}

// Three attempts at fixture-math (sessions of 6 problems, to keep the numbers small). Oldest first:
//  Oct 1 completed in 3 rounds, first try 3 of 6.
//  Oct 3 stopped: round 1 has two problems marked, then it was left.
//  Oct 8 completed in 2 rounds, first try 5 of 6.
// Across them, per kind (problems marked / ❌): subtract across ten 6 / 4, add across ten 3 / 1, add within 10 6 / 1,
// subtract within 10 4 / 0.
const SCRIPTED: SessionJson[] = [
  mathAttempt('math-1', 'completed', '2026-10-01T12:00:00.000Z', [
    mathRound(
      1,
      {
        '1': gotIt('subtract-across-ten', 13, 4, '8'),
        '2': missed('subtract-across-ten', 15, 7, '9', '6'),
        '3': right('add-across-ten', 8, 6),
        '4': right('add-within-10', 3, 4),
        '5': right('subtract-within-10', 9, 4),
        '6': gotIt('add-across-ten', 9, 4, '12'),
      },
      '2026-10-01T12:00:00.000Z',
    ),
    mathRound(
      2,
      {
        '1': right('subtract-across-ten', 14, 6),
        '2': missed('subtract-across-ten', 16, 9, '8', '7'),
        '6': right('add-across-ten', 7, 5),
      },
      '2026-10-01T12:05:00.000Z',
    ),
    mathRound(3, { '2': right('subtract-across-ten', 11, 3) }, '2026-10-01T12:08:00.000Z'),
  ]),
  mathAttempt('math-2', 'stopped', '2026-10-03T12:00:00.000Z', [
    mathRound(
      1,
      {
        '1': missed('subtract-across-ten', 17, 8, '8', '10'),
        '2': right('add-within-10', 2, 5),
        '3': { kind: 'add-within-10', a: 6, b: 2, entered: [] }, // never reached
      },
      '2026-10-03T12:00:00.000Z',
      false,
    ),
  ]),
  mathAttempt('math-3', 'completed', '2026-10-08T12:00:00.000Z', [
    mathRound(
      1,
      {
        '1': gotIt('add-within-10', 4, 3, '8'),
        '2': right('subtract-within-10', 9, 3),
        '3': right('add-within-10', 5, 2),
        '4': right('subtract-within-10', 8, 5),
        '5': right('subtract-within-10', 7, 2),
        '6': right('add-within-10', 6, 3),
      },
      '2026-10-08T12:00:00.000Z',
    ),
    mathRound(2, { '1': right('add-within-10', 2, 6) }, '2026-10-08T12:05:00.000Z'),
  ]),
];

async function openProgress(page: Page): Promise<void> {
  await openParentArea(page);
  await openParentSection(page, 'Progress');
  await page.getByRole('link', { name: /Fixture Math/ }).click();
}

test.describe('parent progress for a math lesson', () => {
  test('lists attempts newest first with status, first-try score and rounds; shows the trend and the best first try', async ({ page }) => {
    await setUpLearner(page);
    await restoreSessions(page, SCRIPTED);
    await openProgress(page);

    await expect(facts(page).getByTestId('progress-facts')).toContainText('Attempts: 3');
    await expect(facts(page).getByTestId('progress-facts')).toContainText('Best first try: 5 of 6');
    await expect(facts(page).getByTestId('trend')).toHaveText('3 → 5');
    const attempts = facts(page).getByTestId('attempt');
    await expect(attempts).toHaveCount(3);
    await expect(attempts.nth(0)).toContainText('Oct 8, 2026');
    await expect(attempts.nth(0)).toContainText('Completed');
    await expect(attempts.nth(0)).toContainText('First try: 5 of 6');
    await expect(attempts.nth(0)).toContainText('Rounds: 2');
    await expect(attempts.nth(1)).toContainText('Stopped');
    await expect(attempts.nth(2)).toContainText('First try: 3 of 6');
    await expect(attempts.nth(2)).toContainText('Rounds: 3');
  });

  test('trickiest lists problem kinds with ❌ counts out of the problems of that kind across all attempts, most first', async ({ page }) => {
    await setUpLearner(page);
    await restoreSessions(page, SCRIPTED);
    await openProgress(page);

    await expect(facts(page).getByRole('heading', { name: 'Trickiest problem kinds' })).toBeVisible();
    const tricky = facts(page).getByTestId('tricky-kind');
    // Equal ❌ counts: the kind with the higher share wrong (1 of 3) comes before 1 of 6. Kinds with no ❌ are left out.
    await expect(tricky).toHaveCount(3);
    await expect(tricky.nth(0)).toContainText('subtract across ten');
    await expect(tricky.nth(0)).toContainText('❌ 4 of 6');
    await expect(tricky.nth(1)).toContainText('add across ten');
    await expect(tricky.nth(1)).toContainText('❌ 1 of 3');
    await expect(tricky.nth(2)).toContainText('add within 10');
    await expect(tricky.nth(2)).toContainText('❌ 1 of 6');
    await expect(facts(page).getByText('subtract within 10')).toHaveCount(0);
    await expect(facts(page).getByTestId('tricky')).toHaveCount(0);
  });

  test('an attempt page shows each round\'s missed problems with what the child entered', async ({ page }) => {
    await setUpLearner(page);
    await restoreSessions(page, SCRIPTED);
    await openProgress(page);

    await facts(page).getByTestId('attempt').nth(2).click(); // Oct 1
    const rounds = page.getByTestId('round');
    await expect(rounds).toHaveCount(3);
    await expect(rounds.nth(0)).toContainText('Round 1');
    await expect(rounds.nth(0)).toContainText('✅ 3');
    await expect(rounds.nth(0)).toContainText('❌ 3');
    const first = rounds.nth(0).getByTestId('missed-problem');
    await expect(first).toHaveCount(3);
    await expect(first.nth(0)).toHaveText('13 − 4 = ☐answered 8, then 9');
    await expect(first.nth(1)).toHaveText('15 − 7 = ☐answered 9, then 6');
    await expect(first.nth(2)).toHaveText('9 + 4 = ☐answered 12, then 13');
    await expect(rounds.nth(1).getByTestId('missed-problem')).toHaveText(['16 − 9 = ☐answered 8, then 7']);
    await expect(rounds.nth(2).getByTestId('missed-problem')).toHaveCount(0);
    await expect(page.getByText(/Problem \d/)).toHaveCount(0);
  });

  test('a problem that is still waiting in a stopped attempt is not counted and not listed as missed', async ({ page }) => {
    await setUpLearner(page);
    await restoreSessions(page, SCRIPTED);
    await openProgress(page);

    await facts(page).getByTestId('attempt').nth(1).click(); // Oct 3, stopped
    await expect(page.getByTestId('round')).toHaveCount(1);
    await expect(page.getByTestId('missed-problem')).toHaveText(['17 − 8 = ☐answered 8, then 10']);
  });
});

test.describe('progress after real Facts practice', () => {
  test('a problem missed in a round appears in its kind\'s count and in the round with the wrong answer entered', async ({ page, audio }) => {
    await setUpLearner(page);
    const screen = new FactsScreen(page, audio);
    await screen.open('Fixture Math');
    const shown = await screen.playRound((_, index) => (index === 3 ? 'missed' : 'first'));
    await expect(screen.summary).toBeVisible();
    const missedProblem = shown[3]!;
    const wrongAnswer = String(answerFor(missedProblem) + 1);

    await page.goto('./');
    await openProgress(page);

    const labels: Record<string, string> = {
      'add-within-10': 'add within 10',
      'add-across-ten': 'add across ten',
      'subtract-within-10': 'subtract within 10',
      'subtract-across-ten': 'subtract across ten',
    };
    const tricky = facts(page).getByTestId('tricky-kind');
    await expect(tricky).toHaveCount(1);
    await expect(tricky).toContainText(labels[kindOf(missedProblem)]!);
    await expect(tricky).toContainText('❌ 1 of 5'); // a session spreads its 20 problems evenly: 5 of each kind
    await facts(page).getByTestId('attempt').click();
    await expect(page.getByTestId('missed-problem')).toHaveText([`${textOf(missedProblem)} = ☐answered ${wrongAnswer}, then ${wrongAnswer}`]);
  });
});

const answerFor = ({ a, op, b }: { a: number; op: '+' | '−'; b: number }): number => (op === '+' ? a + b : a - b);
