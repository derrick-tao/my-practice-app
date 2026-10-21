// How a learner's entry is read for a math practice type. An entry is the string saved as a Try's `answer`:
// digits typed on the number pad, or "true" / "false" for a type answered with the two True and False buttons.
import type { Problem } from './problem.ts';
import type { MathPracticeType } from './types.ts';

export const TRUE_FALSE_ENTRIES = ['true', 'false'] as const;

/** Whether the entry is something this type can be answered with (anything else is ignored). */
export function isValidEntry(type: MathPracticeType, entry: string): boolean {
  return type.input === 'true-false' ? (TRUE_FALSE_ENTRIES as readonly string[]).includes(entry) : /^\d{1,4}$/.test(entry);
}

/** `answer` is the number the entry is checked against: the problem's, or the current step's in a multi-step problem. */
export function isCorrectEntry(type: MathPracticeType, problem: Problem, entry: string, answer = type.answer(problem)): boolean {
  return type.input === 'true-false' ? (entry === 'true') === (answer === 1) : Number(entry) === answer;
}

/** The answer as the learner sees it: "14", or "True" / "False". */
export function answerText(type: MathPracticeType, problem: Problem): string {
  if (type.input !== 'true-false') return String(type.answer(problem));
  return type.answer(problem) === 1 ? 'True' : 'False';
}
