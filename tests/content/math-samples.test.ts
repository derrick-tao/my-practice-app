// Seam 2: the lesson preview's sample problems, for every math practice type in the registry (so a type added
// later is covered without a change here). A sample is a problem the type could really ask under the lesson's rules.
import { describe, expect, it } from 'vitest';
import { MATH_TYPES } from '../../src/math/index.ts';
import { problemLine } from '../../src/math/display.ts';
import { kindLabel } from '../../src/math/kind-label.ts';
import { DEFAULT_RULES, type Rules } from '../../src/math/rules.ts';
import { SAMPLE_COUNT, sampleProblems } from '../../src/math/samples.ts';
import { shuffled } from '../../src/practice/random.ts';

/** A small deterministic random source, so a failure reproduces. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const RULE_SETS: Array<[string, Rules]> = [
  ['the defaults', DEFAULT_RULES],
  ['adding only', { within: 20, operations: ['add'] }],
  ['subtracting within 100', { within: 100, operations: ['subtract'] }],
];

describe.each(Object.entries(MATH_TYPES))('%s sample problems', (_id, type) => {
  it.each(RULE_SETS)('are 5 distinct problems the type could ask under %s', (_name, rules) => {
    for (let seed = 1; seed <= 25; seed++) {
      const samples = sampleProblems(type, rules, seeded(seed));

      expect(samples).toHaveLength(SAMPLE_COUNT);
      expect(new Set(samples.map((problem) => type.key(problem))).size).toBe(SAMPLE_COUNT);
      for (const problem of samples) {
        expect(type.kinds(rules)).toContain(problem.kind);
        expect(type.pool(problem.kind, rules).map((p) => type.key(p))).toContain(type.key(problem));
        expect(problemLine(type, problem)).not.toBe('');
        expect(Number.isInteger(type.answer(problem))).toBe(true);
      }
    }
  });

  it('give different samples when drawn again from the same source', () => {
    const random = seeded(7);
    const first = sampleProblems(type, DEFAULT_RULES, random).map((p) => type.key(p));
    const second = sampleProblems(type, DEFAULT_RULES, random).map((p) => type.key(p));

    expect(second).not.toEqual(first);
  });

  it('name each kind in words a grown-up can read', () => {
    for (const kind of type.kinds(DEFAULT_RULES)) expect(kindLabel(kind)).toMatch(/^[a-z0-9 ]+$/);
  });
});

describe('kindLabel', () => {
  it('spaces out the kind id', () => {
    expect(kindLabel('subtract-across-ten')).toBe('subtract across ten');
  });
});

void shuffled;
