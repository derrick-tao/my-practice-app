// What a math practice type supplies. The generation module (generate.ts) and the practice flow only ever talk to
// this interface, so a new type is one object like `facts` in facts.ts plus an entry in math-types.ts.
import type { Rules } from './rules.ts';
import type { RandomSource } from '../practice/random.ts';
import type { Problem } from './problem.ts';

export interface MathPracticeType {
  /** The kinds of problem these rules allow, in a stable order. A session spreads its problems evenly over them. */
  kinds(rules: Rules): string[];
  /** Every problem of this kind the rules allow (commutative twins included); a session samples from it without repeats. */
  pool(kind: string, rules: Rules): Problem[];
  /** What makes two problems the same problem ("3 + 4" and "4 + 3" are). */
  key(problem: Problem): string;
  /** Fill in what a problem needs chosen at random once its numbers are picked (a story's names); saved with the problem. */
  decorate?(problem: Problem, random: RandomSource): Problem;
  /** Emoji rows to show with the problem (a story's quantities). A type that has this is shown as a story: text, pictures, then the answer box. */
  pictures?(problem: Problem): string[];
  /** The problem as the child reads it, up to the answer: "8 + 6 =" (a story: the whole story). */
  equation(problem: Problem): string;
  /** The number that is the answer. */
  answer(problem: Problem): number;
  /** The worked strategy shown after two wrong tries: "8 + 6 = 8 + 2 + 4 = 14". */
  strategy(problem: Problem): string;
}
