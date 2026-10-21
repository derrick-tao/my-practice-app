// Seam 1 helpers for the True or false practice screen, driven the way a child does it: read the equation on screen,
// tap True or False. The problems are random, so the driver works out whether the equation is true from the text
// itself (it evaluates both sides) and never from the app's code.
import type { Locator, Page } from '@playwright/test';
import { expect, type AudioProbe } from './harness.ts';

/** One side of an equation as shown: a number, or two numbers with + or −. */
export type Side = { text: string; value: number; terms: number[]; plain: boolean };

export interface Statement {
  text: string;
  left: Side;
  right: Side;
}

export type TrueOrFalseKind = 'same-number' | 'answer-left' | 'swapped' | 'two-sums';

function parseSide(text: string): Side {
  const match = /^(\d+)(?: ([+−]) (\d+))?$/.exec(text.trim());
  if (!match) throw new Error(`not one side of an equation: "${text}"`);
  const a = Number(match[1]);
  if (match[2] === undefined) return { text: text.trim(), value: a, terms: [a], plain: true };
  const b = Number(match[3]);
  return { text: text.trim(), value: match[2] === '+' ? a + b : a - b, terms: [a, b], plain: false };
}

export function parseStatement(text: string): Statement {
  const [left, right, ...more] = text.trim().split(' = ');
  if (left === undefined || right === undefined || more.length > 0) throw new Error(`not an equation: "${text}"`);
  return { text: text.trim(), left: parseSide(left), right: parseSide(right) };
}

export const isTrue = ({ left, right }: Statement): boolean => left.value === right.value;

/** The kind of problem, told from how it reads. */
export function kindOf({ left, right }: Statement): TrueOrFalseKind {
  if (left.plain && right.plain) return 'same-number';
  if (left.plain) return 'answer-left';
  // Two sums: the swapped kind keeps the first number last or the second number first (5 + 2 = 2 + 5, 5 + 2 = 2 + 6).
  const [a, b] = left.terms;
  const [c, d] = right.terms;
  return c === b || d === a ? 'swapped' : 'two-sums';
}

/** "3 + 4" and "4 + 3" are the same problem. */
export function identityOf({ left, right }: Statement): string {
  const side = (s: Side): string => (s.text.includes('−') ? s.text : [...s.terms].sort((x, y) => x - y).join('+'));
  return [side(left), side(right)].sort().join('=');
}

export class TrueOrFalseScreen {
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
  readonly trueButton: Locator;
  readonly falseButton: Locator;

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
    this.trueButton = page.getByRole('button', { name: 'True', exact: true });
    this.falseButton = page.getByRole('button', { name: 'False', exact: true });
  }

  /** Home -> the lesson's True? button. */
  async open(lessonTitle: string): Promise<void> {
    await this.page.goto('./');
    await this.page.getByRole('group', { name: lessonTitle, exact: true }).getByRole('link', { name: /True\? ·/ }).click();
  }

  /** Close and reopen the app (a fresh load of home), then tap Keep going. */
  async reopenViaKeepGoing(): Promise<void> {
    await this.page.goto('./');
    await this.page.reload();
    await this.keepGoing.click();
  }

  /** The equation on screen (without the verdict that shows once the problem is settled). Waits for one to show. */
  async read(): Promise<Statement> {
    await expect(this.problem).toBeVisible();
    const text = ((await this.problem.textContent()) ?? '').trim().replace(/\s*(True|False)$/, '');
    return parseStatement(text);
  }

  /** Tap True or False. */
  async tap(value: boolean): Promise<void> {
    await (value ? this.trueButton : this.falseButton).click();
  }

  /** Read the problem and tap the right button. */
  async answerRight(): Promise<Statement> {
    const statement = await this.read();
    await this.tap(isTrue(statement));
    return statement;
  }

  /** Read the problem and tap the wrong button. */
  async answerWrong(): Promise<Statement> {
    const statement = await this.read();
    await this.tap(!isTrue(statement));
    return statement;
  }

  /** Right on the first try, then wait for the next problem or the end of the round. */
  async solveFirstTry(): Promise<Statement> {
    const before = await this.progressNumber();
    const statement = await this.answerRight();
    await this.waitPast(before);
    return statement;
  }

  /** Wrong, then right (shows "got it!"), then Next. */
  async solveSecondTry(): Promise<Statement> {
    const statement = await this.answerWrong();
    await expect(this.feedback).toContainText('Try again');
    await this.tap(isTrue(statement));
    await expect(this.feedback).toContainText('got it!');
    await this.next.click();
    return statement;
  }

  /** Wrong twice (shows the answer and why), then Next. */
  async solveMissed(): Promise<Statement> {
    const statement = await this.answerWrong();
    await expect(this.feedback).toContainText('Try again');
    await this.tap(!isTrue(statement));
    await expect(this.strategy).toBeVisible();
    await this.next.click();
    return statement;
  }

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
   * Play the round to its end. `howToSolve(statement, index)` picks how each problem goes: 'first', 'second' or
   * 'missed'. Break prompts are answered with Keep going. Returns the problems in the order shown.
   */
  async playRound(howToSolve: (statement: Statement, index: number) => 'first' | 'second' | 'missed' = () => 'first'): Promise<Statement[]> {
    const shown: Statement[] = [];
    for (;;) {
      await expect(this.problem.or(this.summary).or(this.completion).or(this.breakPrompt)).toBeVisible();
      if (await this.breakPrompt.isVisible()) {
        await this.keepOn.click();
        continue;
      }
      if (!(await this.problem.isVisible())) return shown;
      const statement = await this.read();
      const how = howToSolve(statement, shown.length);
      shown.push(statement);
      if (how === 'first') {
        const before = await this.progressNumber();
        await this.tap(isTrue(statement));
        await this.waitPast(before);
      } else if (how === 'second') {
        await this.tap(!isTrue(statement));
        await expect(this.feedback).toContainText('Try again');
        await this.tap(isTrue(statement));
        await expect(this.feedback).toContainText('got it!');
        await this.next.click();
      } else {
        await this.tap(!isTrue(statement));
        await expect(this.feedback).toContainText('Try again');
        await this.tap(!isTrue(statement));
        await expect(this.strategy).toBeVisible();
        await this.next.click();
      }
    }
  }
}
