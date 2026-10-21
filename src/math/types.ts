// What a math practice type supplies. The generation module (generate.ts) and the practice flow only ever talk to
// this interface, so a new type is one object like `facts` in facts.ts plus an entry in math-types.ts.
import type { Rules } from './rules.ts';
import type { Problem } from './problem.ts';

/**
 * One blank of a multi-step problem. The line reads `before`, the blank, `after`; once answered the line stays on
 * screen with the answer in the blank. `explanation` is the one line shown after a second wrong try.
 */
export interface Step {
  before: string;
  after: string;
  answer: number;
  explanation: string;
}

export interface MathPracticeType {
  /** The kinds of problem these rules allow, in a stable order. A session spreads its problems evenly over them. */
  kinds(rules: Rules): string[];
  /** Every problem of this kind the rules allow (commutative twins included); a session samples from it without repeats. */
  pool(kind: string, rules: Rules): Problem[];
  /** What makes two problems the same problem ("3 + 4" and "4 + 3" are). */
  key(problem: Problem): string;
  /** The problem as the child reads it, up to the answer: "8 + 6 =". A multi-step type gives the line above its steps ("" for none). */
  equation(problem: Problem): string;
  /** The number that is the answer. */
  answer(problem: Problem): number;
  /**
   * Multi-step types only (a single-blank type like Facts leaves this out): the blanks in the order they are answered.
   * Each is try-limited on its own, and the problem is ✅ only if every one is right on the first try.
   */
  steps?(problem: Problem): Step[];
  /** The worked strategy shown after two wrong tries: "8 + 6 = 8 + 2 + 4 = 14". */
  strategy(problem: Problem): string;
}
