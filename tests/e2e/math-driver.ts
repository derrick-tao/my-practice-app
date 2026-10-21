// Seam 1 helpers for the Facts (math) practice screen, driven the way a child does it: read the problem on
// screen, tap the answer on the number pad, tap OK. Math problems are random, so a spec cannot know the
// answer ahead of time: the driver reads the problem from the screen and works out the answer itself.
import type { Locator, Page } from '@playwright/test';
import { expect, type AudioProbe } from './harness.ts';
import { tapNumber } from './parent-driver.ts';

export interface Equation {
  a: number;
  op: '+' | '−';
  b: number;
}

export const answerOf = ({ a, op, b }: Equation): number => (op === '+' ? a + b : a - b);

/** The kinds of problem a Facts session spreads over, decided here from the numbers alone. */
export type FactsKind = 'add-within-10' | 'add-across-ten' | 'subtract-within-10' | 'subtract-across-ten';

export function kindOf({ a, op, b }: Equation): FactsKind {
  if (op === '+') return a + b <= 10 ? 'add-within-10' : 'add-across-ten';
  return a <= 10 ? 'subtract-within-10' : 'subtract-across-ten';
}

/** "3 + 4" and "4 + 3" are the same problem; "7 − 3" is not "3 − 7". */
export const identityOf = ({ a, op, b }: Equation): string => (op === '+' ? `${Math.min(a, b)}+${Math.max(a, b)}` : `${a}−${b}`);

export const textOf = ({ a, op, b }: Equation): string => `${a} ${op} ${b}`;

export class FactsScreen {
  readonly problem: Locator;
  readonly feedback: Locator;
  readonly strategy: Locator;
  readonly next: Locator;
  readonly progress: Locator;
  readonly summary: Locator;
  readonly retry: Locator;
  readonly completion: Locator;
  readonly roundBadge: Locator;
  readonly breakPrompt: Locator;
  readonly keepOn: Locator;
  readonly keepGoing: Locator;
  readonly undo: Locator;

  constructor(
    readonly page: Page,
    readonly audio: AudioProbe,
  ) {
    this.problem = page.getByTestId('problem');
    this.feedback = page.getByTestId('feedback');
    this.strategy = page.getByTestId('strategy');
    this.next = page.getByRole('button', { name: 'Next', exact: true });
    this.progress = page.getByTestId('progress-text');
    this.summary = page.getByTestId('round-summary');
    this.retry = page.getByRole('button', { name: /Practice the .* problems/ });
    this.completion = page.getByTestId('completion');
    this.roundBadge = page.getByTestId('round-badge');
    this.breakPrompt = page.getByTestId('break-prompt');
    this.keepOn = page.getByRole('button', { name: 'Keep going' });
    this.keepGoing = page.getByRole('link', { name: /Keep going/ });
    this.undo = page.getByRole('button', { name: 'Undo' });
  }

  /** Home -> the lesson's Facts button. */
  async open(lessonTitle: string): Promise<void> {
    await this.page.goto('./');
    await this.page.getByRole('group', { name: lessonTitle, exact: true }).getByRole('link', { name: /Facts ·/ }).click();
  }

  /** Close and reopen the app (a fresh load of home), then tap Keep going. */
  async reopenViaKeepGoing(): Promise<void> {
    await this.page.goto('./');
    await this.page.reload();
    await this.keepGoing.click();
  }

  /** The problem on screen. Waits for one to show. */
  async read(): Promise<Equation> {
    await expect(this.problem).toBeVisible();
    const match = /^(\d+) ([+−]) (\d+) =/.exec(((await this.problem.textContent()) ?? '').trim());
    if (!match) throw new Error(`not a problem: ${await this.problem.textContent()}`);
    return { a: Number(match[1]), op: match[2] as Equation['op'], b: Number(match[3]) };
  }

  /** Tap a number and OK. */
  async submit(value: number): Promise<void> {
    await tapNumber(this.page, value);
    await this.page.getByRole('button', { name: 'OK', exact: true }).click();
  }

  /** Read the problem and answer it right. Returns the problem. */
  async answerRight(): Promise<Equation> {
    const equation = await this.read();
    await this.submit(answerOf(equation));
    return equation;
  }

  /** Read the problem and give an answer that is wrong. Returns the problem. */
  async answerWrong(): Promise<Equation> {
    const equation = await this.read();
    await this.submit(answerOf(equation) + 1);
    return equation;
  }

  /** Right on the first try, then wait for the next problem or the end of the round. */
  async solveFirstTry(): Promise<Equation> {
    const before = await this.progressNumber();
    const equation = await this.answerRight();
    await this.waitPast(before);
    return equation;
  }

  /** Wrong, then right (shows "got it!"), then Next. */
  async solveSecondTry(): Promise<Equation> {
    const equation = await this.answerWrong();
    await expect(this.feedback).toContainText('Try again');
    await this.submit(answerOf(equation));
    await expect(this.feedback).toContainText('got it!');
    await this.next.click();
    return equation;
  }

  /** Wrong twice (shows the answer and the strategy), then Next. */
  async solveMissed(): Promise<Equation> {
    const equation = await this.answerWrong();
    await expect(this.feedback).toContainText('Try again');
    await this.submit(answerOf(equation) + 1);
    await expect(this.strategy).toBeVisible();
    await this.next.click();
    return equation;
  }

  /** Wait until the learner is past problem number `before` (the next problem shows, or the round ended and the progress bar went). */
  private async waitPast(before: number): Promise<void> {
    await expect
      .poll(async () => (await this.progress.count()) === 0 || !((await this.progress.textContent()) ?? '').startsWith(`${before} /`))
      .toBe(true);
  }

  /** How many problems are behind the learner: the "n" of "n / 20". */
  async progressNumber(): Promise<number> {
    await expect(this.progress).toBeVisible();
    return Number(((await this.progress.textContent()) ?? '').split('/')[0]!.trim());
  }

  /**
   * Play the round to its end. `howToSolve(equation, index)` picks how each problem goes: 'first', 'second' or 'missed'.
   * Break prompts are answered with Keep going. Returns the problems in the order shown.
   */
  async playRound(howToSolve: (equation: Equation, index: number) => 'first' | 'second' | 'missed' = () => 'first'): Promise<Equation[]> {
    const shown: Equation[] = [];
    for (;;) {
      await expect(this.problem.or(this.summary).or(this.completion).or(this.breakPrompt)).toBeVisible();
      if (await this.breakPrompt.isVisible()) {
        await this.keepOn.click();
        continue;
      }
      if (!(await this.problem.isVisible())) return shown;
      const equation = await this.read();
      const how = howToSolve(equation, shown.length);
      shown.push(equation);
      if (how === 'first') {
        const before = await this.progressNumber();
        await this.submit(answerOf(equation));
        await this.waitPast(before);
      } else if (how === 'second') {
        await this.solveSecondFrom(equation);
      } else {
        await this.solveMissedFrom(equation);
      }
    }
  }

  private async solveSecondFrom(equation: Equation): Promise<void> {
    await this.submit(answerOf(equation) + 1);
    await expect(this.feedback).toContainText('Try again');
    await this.submit(answerOf(equation));
    await expect(this.feedback).toContainText('got it!');
    await this.next.click();
  }

  private async solveMissedFrom(equation: Equation): Promise<void> {
    await this.submit(answerOf(equation) + 1);
    await expect(this.feedback).toContainText('Try again');
    await this.submit(answerOf(equation) + 1);
    await expect(this.strategy).toBeVisible();
    await this.next.click();
  }
}
