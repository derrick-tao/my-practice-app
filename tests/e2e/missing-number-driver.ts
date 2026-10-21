// Seam 1 helpers for the Missing number (math) practice screen. Like math-driver.ts, the driver reads the
// problem on screen and works out the answer itself: an equation with one blank, written either "8 + ☐ = 11" or
// backwards "11 = 8 + ☐", the blank anywhere (read with textWithBlanks: on screen it is a drawn box).
import type { Locator, Page } from '@playwright/test';
import { expect, type AudioProbe } from './harness.ts';
import { FactsScreen, textWithBlanks } from './math-driver.ts';

export type Blank = 'first' | 'middle' | 'answer';

/** One equation `a op b = c` with one of the three numbers missing (null). */
export interface MissingProblem {
  a: number | null;
  op: '+' | '−';
  b: number | null;
  c: number | null;
  /** Written backwards: `c = a op b`. */
  backwards: boolean;
  /** The equation as the screen shows it, whitespace collapsed. */
  text: string;
}

export const BLANK_ORDER: Blank[] = ['first', 'middle', 'answer'];

export const blankOf = (p: MissingProblem): Blank => (p.a === null ? 'first' : p.b === null ? 'middle' : 'answer');

/** "add-blank-middle": the problem kind, decided here from the equation alone. */
export const kindOf = (p: MissingProblem): string => `${p.op === '+' ? 'add' : 'subtract'}-blank-${blankOf(p)}`;

/** The number that goes in the blank. */
export function answerOf(p: MissingProblem): number {
  const { a, b, c, op } = p;
  if (op === '+') return a === null ? c! - b! : b === null ? c! - a : a + b;
  return a === null ? c! + b! : b === null ? a - c! : a - b;
}

/** The whole equation with the answer in the blank (`a`, `b`, `c`). */
export function completed(p: MissingProblem): { a: number; b: number; c: number } {
  const answer = answerOf(p);
  return { a: p.a ?? answer, b: p.b ?? answer, c: p.c ?? answer };
}

/** What makes a problem the same problem: "3 + 4 = ☐" and "4 + 3 = ☐" are, and so is a problem written backwards. */
export function identityOf(p: MissingProblem): string {
  const { a, b, c } = completed(p);
  const operands = p.op === '+' && blankOf(p) === 'answer' ? [a, b].sort((x, y) => x - y) : [a, b];
  return `${kindOf(p)}:${operands.join(',')},${c}`;
}

const TOKEN = '(\\d+|☐)';
const FORWARD = new RegExp(`^${TOKEN} ([+−]) ${TOKEN} = ${TOKEN}$`);
const BACKWARD = new RegExp(`^${TOKEN} = ${TOKEN} ([+−]) ${TOKEN}$`);
const value = (token: string): number | null => (/^\d+$/.test(token) ? Number(token) : null);

export function parseProblem(raw: string): MissingProblem {
  const text = raw.replace(/\s+/g, ' ').trim();
  const forward = FORWARD.exec(text);
  const backward = forward ? null : BACKWARD.exec(text);
  const m = forward ?? backward;
  if (!m) throw new Error(`not a missing-number problem: ${text}`);
  const [a, op, b, c] = forward ? [m[1]!, m[2]!, m[3]!, m[4]!] : [m[2]!, m[3]!, m[4]!, m[1]!];
  return {
    a: value(a),
    op: op as MissingProblem['op'],
    b: value(b),
    c: value(c),
    backwards: backward !== null,
    text,
  };
}

export class MissingNumberScreen {
  /** The screen parts every math practice type shares (progress, feedback, summary, number pad). */
  readonly base: FactsScreen;
  readonly page: Page;
  readonly audio: AudioProbe;

  constructor(page: Page, audio: AudioProbe) {
    this.page = page;
    this.audio = audio;
    this.base = new FactsScreen(page, audio);
  }

  get problem(): Locator {
    return this.base.problem;
  }
  /** The empty box on screen, as the accessibility tree has it. */
  get blank(): Locator {
    return this.problem.getByRole('img', { name: 'blank' });
  }
  get feedback(): Locator {
    return this.base.feedback;
  }
  get strategy(): Locator {
    return this.base.strategy;
  }
  get next(): Locator {
    return this.base.next;
  }
  get progress(): Locator {
    return this.base.progress;
  }
  get summary(): Locator {
    return this.base.summary;
  }
  get retry(): Locator {
    return this.base.retry;
  }
  get completion(): Locator {
    return this.base.completion;
  }
  get roundBadge(): Locator {
    return this.base.roundBadge;
  }
  get breakPrompt(): Locator {
    return this.base.breakPrompt;
  }
  get keepGoing(): Locator {
    return this.base.keepGoing;
  }
  get undo(): Locator {
    return this.base.undo;
  }

  submit(value: number): Promise<void> {
    return this.base.submit(value);
  }

  reopenViaKeepGoing(): Promise<void> {
    return this.base.reopenViaKeepGoing();
  }

  /** Home -> the lesson's Missing button. */
  async open(lessonTitle: string): Promise<void> {
    await this.page.goto('./');
    await this.page.getByRole('group', { name: lessonTitle, exact: true }).getByRole('link', { name: /Missing ·/ }).click();
  }

  /** The problem on screen. Waits for one to show. */
  async read(): Promise<MissingProblem> {
    await expect(this.problem).toBeVisible();
    return parseProblem(await textWithBlanks(this.problem));
  }

  async answerRight(): Promise<MissingProblem> {
    const problem = await this.read();
    await this.submit(answerOf(problem));
    return problem;
  }

  async answerWrong(): Promise<MissingProblem> {
    const problem = await this.read();
    await this.submit(answerOf(problem) + 1);
    return problem;
  }

  /** Right on the first try, then wait until the learner is past this problem. */
  async solveFirstTry(): Promise<MissingProblem> {
    const before = await this.base.progressNumber();
    const problem = await this.answerRight();
    await this.waitPast(before);
    return problem;
  }

  async solveSecondTry(): Promise<MissingProblem> {
    const problem = await this.answerWrong();
    await expect(this.feedback).toContainText('Try again');
    await this.submit(answerOf(problem));
    await expect(this.feedback).toContainText('got it!');
    await this.next.click();
    return problem;
  }

  async solveMissed(): Promise<MissingProblem> {
    const problem = await this.answerWrong();
    await expect(this.feedback).toContainText('Try again');
    await this.submit(answerOf(problem) + 1);
    await expect(this.strategy).toBeVisible();
    await this.next.click();
    return problem;
  }

  private async waitPast(before: number): Promise<void> {
    await expect
      .poll(async () => (await this.progress.count()) === 0 || !((await this.progress.textContent()) ?? '').startsWith(`${before} /`))
      .toBe(true);
  }

  /**
   * Play the round to its end. `howToSolve(problem, index)` picks how each problem goes: 'first', 'second' or
   * 'missed'. Break prompts are answered with Keep going. Returns the problems in the order shown.
   */
  async playRound(howToSolve: (problem: MissingProblem, index: number) => 'first' | 'second' | 'missed' = () => 'first'): Promise<MissingProblem[]> {
    const shown: MissingProblem[] = [];
    for (;;) {
      await expect(this.problem.or(this.summary).or(this.completion).or(this.breakPrompt)).toBeVisible();
      if (await this.breakPrompt.isVisible()) {
        await this.base.keepOn.click();
        continue;
      }
      if (!(await this.problem.isVisible())) return shown;
      const problem = await this.read();
      const how = howToSolve(problem, shown.length);
      shown.push(problem);
      if (how === 'first') {
        const before = await this.base.progressNumber();
        await this.submit(answerOf(problem));
        await this.waitPast(before);
      } else if (how === 'second') {
        await this.submit(answerOf(problem) + 1);
        await expect(this.feedback).toContainText('Try again');
        await this.submit(answerOf(problem));
        await expect(this.feedback).toContainText('got it!');
        await this.next.click();
      } else {
        await this.submit(answerOf(problem) + 1);
        await expect(this.feedback).toContainText('Try again');
        await this.submit(answerOf(problem) + 1);
        await expect(this.strategy).toBeVisible();
        await this.next.click();
      }
    }
  }
}
