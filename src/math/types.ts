// What a math practice type supplies. The generation module (generate.ts) and the practice flow only ever talk to
// this interface, so a new type is one object like `facts` in facts.ts plus an entry in MATH_TYPES (index.ts).
import type { Rules } from './rules.ts';
import type { RandomSource } from '../practice/random.ts';
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
  /**
   * How the learner answers: absent means the number pad. 'true-false' means two big True and False buttons; the
   * type's `answer` is then 1 for true and 0 for false (see answer.ts for how an entry is read).
   */
  input?: 'true-false';
  /** The kinds of problem these rules allow, in a stable order. A session spreads its problems evenly over them. */
  kinds(rules: Rules): string[];
  /** Every problem of this kind the rules allow (commutative twins included); a session samples from it without repeats. */
  pool(kind: string, rules: Rules): Problem[];
  /**
   * Optional. Names the half a kind belongs to (Facts: within 10 or across ten). When a session's size does not divide
   * evenly over the kinds, the extra problems go to the halves in turn, so the halves stay as close as the size allows.
   */
  halfOf?(kind: string): string;
  /**
   * Optional. Names a group for each problem (true or false); the problems of a kind in a session are then drawn
   * alternately from each group, so the groups are balanced to within one.
   */
  groupOf?(problem: Problem): string;
  /** What makes two problems the same problem ("3 + 4" and "4 + 3" are). */
  key(problem: Problem): string;
  /** Fill in what a problem needs chosen at random once its numbers are picked (a story's names); saved with the problem. */
  decorate?(problem: Problem, random: RandomSource): Problem;
  /** Emoji rows to show with the problem (a story's quantities). A type that has this is shown as a story: text, pictures, then the answer box. */
  pictures?(problem: Problem): string[];
  /** The problem as the child reads it, up to the answer: "8 + 6 =" (a story: the whole story). A multi-step type gives the line above its steps ("" for none). */
  equation(problem: Problem): string;
  /**
   * A type whose answer is not at the end of the equation (a blank in the middle, or on the left of "=") gives the
   * text on each side of the blank, and the glyph that marks it while it is empty. The screen puts the learner's
   * digits in the blank. A type without `frame` ends its `equation` where the answer goes.
   */
  frame?(problem: Problem): { before: string; after: string; blank: string };
  /** The number that is the answer (for a true-false type, 1 or 0). */
  answer(problem: Problem): number;
  /**
   * Multi-step types only (a single-blank type like Facts leaves this out): the blanks in the order they are answered.
   * Each is try-limited on its own, and the problem is ✅ only if every one is right on the first try.
   */
  steps?(problem: Problem): Step[];
  /** The worked strategy shown after two wrong tries: "8 + 6 = 8 + 2 + 4 = 14". */
  strategy(problem: Problem): string;
}
