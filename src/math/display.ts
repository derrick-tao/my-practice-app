// How a grown-up reads a math problem in the parent area (lesson preview, Progress): the problem with its blank shown
// as the box glyph ☐, and its answer in words. Everything goes through the MathPracticeType interface, so every type is covered.
import { answerText } from './answer.ts';
import type { Problem } from './problem.ts';
import type { MathPracticeType } from './types.ts';
import { BLANK } from './util.ts';

/** "8 + 6 = ☐" (Facts), "8 + ☐ = 11" (Missing), "7 = 8 − 1: true or false?", "8 + 6" (Strategies: the line the steps start from), the whole story (it ends with its own question). */
export function problemLine(type: MathPracticeType, problem: Problem): string {
  if (type.steps) {
    const given = type.equation(problem);
    if (given !== '') return given;
    const first = type.steps(problem)[0]!;
    return `${first.before}${BLANK}${first.after}`.trim();
  }
  if (type.frame) {
    const { before, after } = type.frame(problem);
    return `${before}${BLANK}${after}`;
  }
  if (type.pictures) return type.equation(problem); // a story already ends with its question
  return type.input === 'true-false' ? `${type.equation(problem)}: true or false?` : `${type.equation(problem)} ${BLANK}`;
}

/** "Answer: 14", "Answer: True". A multi-step problem's answer is its last step's. */
export const answerLine = (type: MathPracticeType, problem: Problem): string => `Answer: ${answerText(type, problem)}`;
