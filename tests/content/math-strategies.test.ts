// Seam 2: Strategies follows the lesson's operations rule like every other math practice type: a kind that needs an
// operation the lesson leaves out is not asked.
import { describe, expect, it } from 'vitest';
import { generateProblems } from '../../src/math/generate.ts';
import { strategies } from '../../src/math/strategies.ts';
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
    const problems = generateProblems(strategies, SUBTRACT, Math.random);
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
