// Seam 1 helpers for the Strategies (🧠 Tricks) practice screen, driven the way a child does it. A strategy problem
// is a few lines, each with one blank answered on the number pad; the driver reads the lines on screen and works
// out the blank itself, because the problems are random. It also knows what a well-formed problem of each kind
// looks like (from the school's examples), so a spec can check the generated problems against them.
import type { Locator, Page } from '@playwright/test';
import { expect, type AudioProbe } from './harness.ts';
import { tapNumber } from './parent-driver.ts';

export const STRATEGY_KINDS = [
  'swap-order',
  'make-ten-three',
  'count-on',
  'make-ten',
  'break-down-to-ten',
  'related-fact',
  'near-doubles',
] as const;
export type StrategyKind = (typeof STRATEGY_KINDS)[number];

/** How many blanks (steps) a problem of each kind has, when the lesson uses the default rules. */
export const STEPS_OF: Record<StrategyKind, number[]> = {
  'swap-order': [2],
  'make-ten-three': [2],
  'count-on': [2, 3],
  'make-ten': [3],
  'break-down-to-ten': [3],
  'related-fact': [2],
  'near-doubles': [3],
};

/** A problem as shown on the step where the last blank is current: the given line (if any) and every line so far. */
export interface Shown {
  given: string | null;
  /** Earlier steps with their answers filled in, then the current line with its "?" (or digits). */
  lines: string[];
}

const nums = (text: string): number[] => (text.match(/\d+/g) ?? []).map(Number);

/** The number that fills the blank in the last line. Throws for a line this driver does not know. */
export function blankOf(line: string): number {
  let m: RegExpExecArray | null;
  if ((m = /^(?:So )?(\d+) ([+−]) (\d+) = \?$/.exec(line))) return m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]);
  if ((m = /^(\d+) \+ (\d+) \+ (\d+) = (\d+) \+ \?$/.exec(line))) return Number(m[2]) + Number(m[3]);
  if ((m = /^(\d+) \+ \? = (\d+)$/.exec(line))) return Number(m[2]) - Number(m[1]);
  if ((m = /^(\d+) − \? = (\d+)$/.exec(line))) return Number(m[1]) - Number(m[2]);
  if ((m = /^(\d+) = (\d+) \+ \?$/.exec(line))) return Number(m[1]) - Number(m[2]);
  if ((m = /^(\d+) → \?$/.exec(line))) return Number(m[1]) + 1;
  throw new Error(`not a blank this driver can solve: ${line}`);
}

/** Which kind a problem is, from what is on screen alone. */
export function kindOfShown({ given, lines }: Shown): StrategyKind {
  const first = lines[0]!;
  const last = lines.at(-1)!;
  if (given === null) {
    if (/^\d+ \+ \d+ \+ \d+ = /.test(first)) return 'make-ten-three';
    if (/^So \d+ − /.test(last)) return 'related-fact';
    if (/^So \d+ \+ /.test(last)) return 'swap-order';
  } else {
    if (/count on/.test(given)) return 'count-on';
    if (given.includes('−')) return 'break-down-to-ten';
    return /^\d+ = \d+ \+ \d+$/.test(first) ? 'near-doubles' : 'make-ten';
  }
  throw new Error(`unknown problem: ${JSON.stringify({ given, lines })}`);
}

/**
 * Check a problem against its kind's worked form and return the answer of its last blank. Every line is checked
 * with arithmetic done here, so a wrong number anywhere in a generated problem fails.
 */
export function checkShape(shown: Shown): number {
  const { given, lines } = shown;
  const kind = kindOfShown(shown);
  const fill = lines.map((line, i) => (i === lines.length - 1 ? line.replace('?', String(blankOf(line))) : line));
  const fail = (): never => {
    throw new Error(`${kind} is not well formed: ${JSON.stringify({ given, lines })}`);
  };
  const eq = (actual: unknown, expected: unknown): void => {
    if (actual !== expected) fail();
  };
  switch (kind) {
    case 'swap-order': {
      const [a, b, c] = nums(fill[0]!);
      eq(fill[0], `${a} + ${b} = ${c}`);
      eq(a! + b!, c);
      eq(fill[1], `So ${b} + ${a} = ${c}`);
      break;
    }
    case 'related-fact': {
      const [a, b, c] = nums(fill[0]!);
      eq(fill[0], `${a} + ${b} = ${c}`);
      eq(a! + b!, c);
      eq(fill[1], `So ${c} − ${a} = ${b}`);
      break;
    }
    case 'make-ten-three': {
      const [a, b, c, a2, ten] = nums(fill[0]!);
      eq(fill[0], `${a} + ${b} + ${c} = ${a2} + ${ten}`);
      eq(a, a2);
      eq(b! + c!, ten);
      eq(ten, 10);
      eq(fill[1], `${a} + ${ten} = ${a! + ten!}`);
      break;
    }
    case 'count-on': {
      const [start, count] = nums(given!);
      eq(given, `${start}, count on ${count}`);
      eq(lines.length, count);
      fill.forEach((line, i) => eq(line, `${start! + i} → ${start! + i + 1}`));
      break;
    }
    case 'make-ten': {
      const [a, b] = nums(given!);
      eq(given, `${a} + ${b}`);
      const [, toTen, ten] = nums(fill[0]!);
      eq(fill[0], `${a} + ${toTen} = ${ten}`);
      eq(a! + toTen!, ten);
      eq(ten! % 10, 0);
      const rest = b! - toTen!;
      eq(fill[1], `${b} = ${toTen} + ${rest}`);
      eq(rest > 0, true);
      eq(fill[2], `${ten} + ${rest} = ${a! + b!}`);
      break;
    }
    case 'break-down-to-ten': {
      const [a, b] = nums(given!);
      eq(given, `${a} − ${b}`);
      const [, units, ten] = nums(fill[0]!);
      eq(fill[0], `${a} − ${units} = ${ten}`);
      eq(a! - units!, ten);
      eq(ten! % 10, 0);
      const rest = b! - units!;
      eq(fill[1], `${b} = ${units} + ${rest}`);
      eq(rest > 0, true);
      eq(fill[2], `${ten} − ${rest} = ${a! - b!}`);
      break;
    }
    case 'near-doubles': {
      const [x, y] = nums(given!);
      eq(given, `${x} + ${y}`);
      const big = Math.max(x!, y!);
      const small = Math.min(x!, y!);
      eq(big, small + 1);
      eq(fill[0], `${big} = ${small} + 1`);
      eq(fill[1], `${small} + ${small} = ${small * 2}`);
      eq(fill[2], `${small * 2} + 1 = ${x! + y!}`);
      break;
    }
  }
  return blankOf(lines.at(-1)!);
}

/** How many blanks a problem has, known from its first step: the given line, or that none means a two-step kind. */
export function totalSteps({ given }: Shown): number {
  if (given === null) return 2;
  const count = /count on (\d+)/.exec(given);
  return count ? Number(count[1]) : 3;
}

/** What the problem is, for telling problems apart: the given line and the lines of the last step. */
export const identityOfShown = ({ given, lines }: Shown): string => [given ?? '', ...lines].join(' | ').replace(/\?$/, '');

export type How = 'first' | 'second' | 'missed';

export class StrategiesScreen {
  readonly problem: Locator;
  readonly given: Locator;
  readonly steps: Locator;
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
    this.given = page.getByTestId('given');
    this.steps = page.getByTestId('step');
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

  /** Home -> the lesson's Tricks button. */
  async open(lessonTitle: string): Promise<void> {
    await this.page.goto('./');
    await this.page.getByRole('group', { name: lessonTitle, exact: true }).getByRole('link', { name: /Tricks ·/ }).click();
  }

  /** Close and reopen the app (a fresh load of home), then tap Keep going. */
  async reopenViaKeepGoing(): Promise<void> {
    await this.page.goto('./');
    await this.page.reload();
    await this.keepGoing.click();
  }

  /** The problem on screen, as far as it is shown. Waits for one to show. */
  async read(): Promise<Shown> {
    await expect(this.problem).toBeVisible();
    const lines = (await this.steps.allTextContents()).map((line) => line.replace(/\s+/g, ' ').trim());
    const given = (await this.given.count()) === 0 ? null : ((await this.given.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    return { given, lines };
  }

  /** The blank the child is on: the number the last line needs. */
  async currentAnswer(): Promise<number> {
    const { lines } = await this.read();
    return blankOf(lines.at(-1)!);
  }

  /** Tap a number and OK. */
  async submit(value: number): Promise<void> {
    await tapNumber(this.page, value);
    await this.page.getByRole('button', { name: 'OK', exact: true }).click();
  }

  /** Answer the current blank right. */
  async answerRight(): Promise<void> {
    await this.submit(await this.currentAnswer());
  }

  /** Answer the current blank with a wrong number. */
  async answerWrong(): Promise<void> {
    await this.submit((await this.currentAnswer()) + 1);
  }

  /** Wait until the screen has moved on from `lineCount` lines of problem number `before`: another line, another problem, or the end. */
  private async waitPast(before: number, lineCount: number): Promise<void> {
    await expect
      .poll(async () => {
        if ((await this.progress.count()) === 0) return true;
        if (Number(((await this.progress.textContent()) ?? '').split('/')[0]!.trim()) !== before) return true;
        return (await this.steps.count()) > lineCount;
      })
      .toBe(true);
  }

  /** How many problems are behind the learner: the "n" of "n / 20". */
  async progressNumber(): Promise<number> {
    await expect(this.progress).toBeVisible();
    return Number(((await this.progress.textContent()) ?? '').split('/')[0]!.trim());
  }

  /** One blank, solved the given way, then past it (Next is tapped when the step asks for it). */
  async solveStep(how: How, before: number, lineCount: number): Promise<void> {
    const answer = await this.currentAnswer();
    if (how === 'first') {
      await this.submit(answer);
    } else if (how === 'second') {
      await this.submit(answer + 1);
      await expect(this.feedback).toContainText('Try again');
      await this.submit(answer);
      await expect(this.feedback).toContainText('got it!');
      await this.next.click();
    } else {
      await this.submit(answer + 1);
      await expect(this.feedback).toContainText('Try again');
      await this.submit(answer + 1);
      await expect(this.strategy).toBeVisible();
      await this.next.click();
    }
    await this.waitPast(before, lineCount);
  }

  /**
   * Answer every blank but the last right, leaving the learner on the last one; skip problems (all first try) until one
   * is of the `wanted` kind, if given. Returns the problem as it shows on its last blank.
   */
  async goToLastStep(wanted?: StrategyKind): Promise<Shown> {
    for (;;) {
      const total = totalSteps(await this.read());
      for (let step = 1; step < total; step++) {
        await this.answerRight();
        await expect(this.steps).toHaveCount(step + 1);
      }
      const shown = await this.read();
      if (wanted === undefined || kindOfShown(shown) === wanted) return shown;
      await this.answerRight();
      await this.waitPastFirstLine(shown);
    }
  }

  /** After the last blank of `shown` was answered: wait for the next problem (its first line differs). */
  private async waitPastFirstLine(shown: Shown): Promise<void> {
    await expect
      .poll(async () => (await this.progress.count()) === 0 || identityOfShown(await this.read()) !== identityOfShown(shown))
      .toBe(true);
  }

  /** Whether the learner is past problem number `before` (the next problem shows, or the round ended and the progress bar went). */
  private async pastProblem(before: number): Promise<boolean> {
    return (await this.progress.count()) === 0 || (await this.progressNumber()) !== before;
  }

  /**
   * Solve the problem on screen, step by step; `howAt(step)` says how each blank goes (default: first try). Returns
   * the problem as it showed at its last blank. Stops when the problem is over (the next one, or the end of the round).
   */
  async solveProblem(howAt: (step: number) => How = () => 'first'): Promise<Shown> {
    const before = await this.progressNumber();
    for (let step = 0; ; step++) {
      const shown = await this.read();
      await this.solveStep(howAt(step), before, shown.lines.length);
      if (await this.pastProblem(before)) return shown;
    }
  }

  /**
   * Play the round to its end. `howAt(index, step)` picks how each blank of each problem goes (default: all first
   * try). Break prompts are answered with Keep going. Returns the problems as they showed at their last blank, in order.
   */
  async playRound(howAt: (index: number, step: number) => How = () => 'first'): Promise<Shown[]> {
    const shown: Shown[] = [];
    for (;;) {
      await expect(this.problem.or(this.summary).or(this.completion).or(this.breakPrompt)).toBeVisible();
      if (await this.breakPrompt.isVisible()) {
        await this.keepOn.click();
        continue;
      }
      if (!(await this.problem.isVisible())) return shown;
      const index = shown.length;
      shown.push(await this.solveProblem((step) => howAt(index, step)));
    }
  }
}
