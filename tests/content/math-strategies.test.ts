// Seam 2: Strategies follows the lesson's operations rule like every other math practice type: a kind that needs an
// operation the lesson leaves out is not asked.
import { describe, expect, it } from 'vitest';
import { generateProblems } from '../../src/math/generate.ts';
import type { Problem } from '../../src/math/problem.ts';
import { strategies, trickHelp } from '../../src/math/strategies.ts';
import type { Rules } from '../../src/math/rules.ts';

const ADD: Rules = { within: 20, operations: ['add'] };
const SUBTRACT: Rules = { within: 20, operations: ['subtract'] };
const BOTH: Rules = { within: 20, operations: ['add', 'subtract'] };

describe('strategies kinds follow the operations rule', () => {
  it('asks a related fact (it adds, then subtracts) only when the lesson has both operations', () => {
    expect(strategies.kinds(BOTH)).toContain('related-fact');
    expect(strategies.kinds(ADD)).not.toContain('related-fact');
    expect(strategies.kinds(SUBTRACT)).not.toContain('related-fact');
  });

  it('subtracting only leaves just the break-down-to-ten trick, and a session still gets 20 problems of it', () => {
    expect(strategies.kinds(SUBTRACT)).toEqual(['break-down-to-ten']);
    const problems = generateProblems(strategies, SUBTRACT, Math.random, 20);
    expect(problems).toHaveLength(20);
    expect(new Set(problems.map((p) => p.kind))).toEqual(new Set(['break-down-to-ten']));
  });

  it('adding only leaves only the adding tricks', () => {
    expect(strategies.kinds(ADD)).toEqual(['swap-order', 'make-ten-three', 'count-on', 'make-ten', 'near-doubles']);
  });
});

const KINDS_AND_TITLES = {
  'swap-order': 'Swap the order',
  'make-ten-three': 'Make ten with three numbers',
  'count-on': 'Count on',
  'make-ten': 'Make a ten',
  'break-down-to-ten': 'Break down to ten',
  'related-fact': 'Related fact',
  'near-doubles': 'Near doubles',
} as const;

describe('strategies titles and hints', () => {
  const everyKind = Object.keys(KINDS_AND_TITLES).flatMap((kind) => strategies.pool(kind, BOTH));

  it('covers all seven kinds, each with problems to ask', () => {
    for (const kind of Object.keys(KINDS_AND_TITLES)) expect(strategies.pool(kind, BOTH).length, kind).toBeGreaterThan(0);
  });

  it('gives each kind its title', () => {
    for (const [kind, title] of Object.entries(KINDS_AND_TITLES)) {
      for (const problem of strategies.pool(kind, BOTH)) expect(strategies.title?.(problem), kind).toBe(title);
    }
  });

  it('gives every step a short hint in plain words', () => {
    for (const problem of everyKind) {
      for (const step of strategies.steps!(problem)) {
        expect(step.hint, `${problem.kind} ${problem.numbers}`).toBeTruthy();
        expect(step.hint!.split(/\s+/).length, step.hint).toBeLessThanOrEqual(8);
        expect(step.hint, step.hint).not.toMatch(/commutative|addend|minuend|subtrahend|sum of|difference/i);
        expect(step.hint, step.hint).not.toMatch(/(^|\s)\?/);
        expect(step.hint, step.hint).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('leaves the equations and answers as they were', () => {
    const makeTen = { kind: 'make-ten', numbers: [8, 6] };
    expect(strategies.equation(makeTen)).toBe('8 + 6');
    expect(strategies.steps!(makeTen).map((s) => [s.before, s.after, s.answer])).toEqual([
      ['8 + ', ' = 10', 2],
      ['6 = 2 + ', '', 4],
      ['10 + 4 = ', '', 14],
    ]);
  });

  it('hints the make-ten steps the way a child would say them', () => {
    const hints = strategies.steps!({ kind: 'make-ten', numbers: [8, 6] }).map((s) => s.hint);
    expect(hints).toEqual(['How many more makes 8 into 10?', 'Split 6 into 2 and what is left', 'Now add: 10 + 4']);
  });
});

describe('trick help', () => {
  const kinds = Object.keys(KINDS_AND_TITLES);
  const everyProblem = kinds.flatMap((kind) => strategies.pool(kind, BOTH));

  /** The example problem the help shows, read back from the numbers in its first line. */
  const exampleFor = (current: Problem): Problem => {
    const numbers = (trickHelp(current).example[0] ?? '').match(/\d+/g)!.map(Number);
    return { kind: current.kind, numbers: current.kind === 'make-ten-three' ? numbers.slice(0, 3) : numbers.slice(0, 2) };
  };

  it('gives every trick a plain "what it is" and "why it helps" line', () => {
    for (const kind of kinds) {
      const help = trickHelp(strategies.pool(kind, BOTH)[0]!);
      for (const line of [help.whatItIs, help.whyItHelps]) {
        expect(line.trim(), kind).not.toBe('');
        expect(line, kind).not.toMatch(/\n|undefined|NaN/);
        expect(line, kind).not.toMatch(/commutative|addend|minuend|subtrahend|sum of|difference/i);
      }
    }
  });

  it('shows the make-ten example the way the practice screen reads, answers filled in', () => {
    const help = trickHelp({ kind: 'make-ten', numbers: [7, 5] });
    expect(help.example).toEqual(['8 + 6', '8 + 2 = 10', '6 = 2 + 4', '10 + 4 = 14']);
  });

  it('puts the given line first only for tricks that have one', () => {
    expect(trickHelp({ kind: 'count-on', numbers: [3, 2] }).example).toEqual(['7, count on 2', '7 → 8', '8 → 9']);
    expect(trickHelp({ kind: 'swap-order', numbers: [2, 3] }).example).toEqual(['8 + 3 = 11', 'So 3 + 8 = 11']);
  });

  it('switches to the second example when the first has the current numbers, in either order', () => {
    expect(trickHelp({ kind: 'make-ten', numbers: [7, 5] }).example[0]).toBe('8 + 6');
    expect(trickHelp({ kind: 'make-ten', numbers: [8, 6] }).example[0]).toBe('9 + 5');
    expect(trickHelp({ kind: 'make-ten', numbers: [6, 8] }).example[0]).toBe('9 + 5');
    expect(trickHelp({ kind: 'swap-order', numbers: [3, 8] }).example[0]).toBe('9 + 4 = 13');
  });

  it('builds the example from the trick steps and ends with every blank answered correctly', () => {
    for (const problem of everyProblem) {
      const exampleProblem = exampleFor(problem);
      const steps = strategies.steps!(exampleProblem);
      const lines = steps.map((s) => `${s.before}${s.answer}${s.after}`);
      const given = strategies.equation(exampleProblem);
      const { example } = trickHelp(problem);
      expect(example, `${problem.kind} ${problem.numbers}`).toEqual(given ? [given, ...lines] : lines);
      expect(example.join(' '), problem.kind).not.toMatch(/undefined|NaN|☐/);
    }
  });

  it('uses an example that is a real problem of the trick, and never the current numbers in either order', () => {
    const sorted = (p: Problem) => [...p.numbers].sort((x, y) => x - y).join(',');
    for (const problem of everyProblem) {
      const exampleProblem = exampleFor(problem);
      const real = strategies.pool(problem.kind, BOTH).map((p) => p.numbers.join(','));
      expect(real, `${problem.kind} ${exampleProblem.numbers}`).toContain(exampleProblem.numbers.join(','));
      expect(sorted(exampleProblem), `${problem.kind} ${problem.numbers}`).not.toBe(sorted(problem));
    }
  });
});
