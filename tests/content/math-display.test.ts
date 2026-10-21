// Seam 2: how the parent area reads a problem (lesson preview samples, Progress's missed problems), for every math
// practice type in the registry: one blank shown as the box glyph ☐, and the answer in words.
import { describe, expect, it } from 'vitest';
import { answerLine, problemLine } from '../../src/math/display.ts';
import { MATH_TYPES } from '../../src/math/index.ts';
import { DEFAULT_RULES } from '../../src/math/rules.ts';
import { generateProblems } from '../../src/math/generate.ts';
import { enteredAnswers } from '../../src/practice/math-progress.ts';

/** A "?" standing for a missing number: on its own, not the end of a question ("How many did she get?"). */
const QUESTION_MARK_BLANK = /(^|\s)\?/;

describe.each(Object.entries(MATH_TYPES))('%s as a grown-up reads it', (_id, type) => {
  it('shows each problem with its blank and an answer, without a doubled or missing "?"', () => {
    const problems = generateProblems(type, DEFAULT_RULES, Math.random, 20);
    for (const problem of problems) {
      const line = problemLine(type, problem);
      expect(line.trim()).not.toBe('');
      expect(line).not.toMatch(/\?\s*\?|undefined/);
      expect(answerLine(type, problem)).toMatch(/^Answer: (\d+|True|False)$/);
    }
  });
});

describe.each(Object.entries(MATH_TYPES))('%s plain-text strings use one box blank, never "?"', (id, type) => {
  const problems = generateProblems(type, DEFAULT_RULES, Math.random, 40);

  it('writes the blank of the problem line as ☐', () => {
    for (const problem of problems) {
      const line = problemLine(type, problem);
      expect(line, line).not.toMatch(QUESTION_MARK_BLANK);
      // Facts and Missing show exactly one box (a story asks its own question, true or false has no blank, and a
      // Tricks problem with a given line shows that line and gets its blanks step by step).
      if (id === 'facts' || id === 'missing-number') expect(line.split('☐'), line).toHaveLength(2);
    }
  });

  it('writes no "?" blank in the worked strategy or the lines of its steps', () => {
    for (const problem of problems) {
      const texts = [type.strategy(problem), ...(type.steps?.(problem) ?? []).flatMap((step) => [step.before, step.after, step.explanation])];
      for (const text of texts) expect(text, text).not.toMatch(QUESTION_MARK_BLANK);
    }
  });
});

describe('the blank glyph', () => {
  it('is the same box for a missing number written forwards and backwards', () => {
    const type = MATH_TYPES['missing-number'];
    const problems = generateProblems(type, DEFAULT_RULES, Math.random, 120);
    expect(problems.some((p) => p.backwards)).toBe(true);
    expect(problems.some((p) => !p.backwards)).toBe(true);
    for (const problem of problems) {
      expect(problemLine(type, problem)).toContain('☐');
      expect(type.equation(problem)).toContain('☐');
    }
  });

  it("marks the unknown of a story's worked strategy with ☐ when the story asks for a part", () => {
    const type = MATH_TYPES['word-problems'];
    const strategies = generateProblems(type, DEFAULT_RULES, Math.random, 120).map((p) => type.strategy(p));
    expect(strategies.some((text) => text.includes('☐'))).toBe(true);
  });
});

describe('answer in words', () => {
  it('says True or False for a true-or-false problem, never 1 or 0', () => {
    const type = MATH_TYPES['true-or-false'];
    for (const problem of generateProblems(type, DEFAULT_RULES, Math.random, 20)) {
      expect(answerLine(type, problem)).toBe(type.answer(problem) === 1 ? 'Answer: True' : 'Answer: False');
    }
  });
});

describe('enteredAnswers', () => {
  it('lists a single-blank problem as before', () => {
    expect(enteredAnswers([{ answer: '8', correct: false }, { answer: '9', correct: false }])).toBe('answered 8, then 9');
    expect(enteredAnswers([{ answer: 'true', correct: false }])).toBe('answered true');
    expect(enteredAnswers([])).toBe('');
  });

  it('keeps the answers of each step of a multi-step problem apart', () => {
    expect(
      enteredAnswers([
        { answer: '2', correct: true, step: 0 },
        { answer: '4', correct: false, step: 1 },
        { answer: '5', correct: false, step: 1 },
      ]),
    ).toBe('step 1: answered 2; step 2: answered 4, then 5');
  });
});
