// Seam 2: a math session has the size the learner's "Problems per practice" setting gave it (10, 15 or 20): spread
// evenly over the practice type's kinds, in random order, with no problem twice, whatever the rules.
import { describe, expect, it } from 'vitest';
import { generateProblems } from '../../src/math/generate.ts';
import { MATH_TYPES } from '../../src/math/index.ts';
import { DEFAULT_RULES, PROBLEM_COUNTS, type Rules } from '../../src/math/rules.ts';
import { createMathSession } from '../../src/practice/math-session.ts';
import { createRandomSource } from '../../src/practice/random.ts';
import type { RulesTypeId } from '../../src/content/types.ts';

const COUNTS = [10, 15, 20] as const;
const RULES: Array<[string, Rules]> = [
  ['the default rules', DEFAULT_RULES],
  ['within 20, adding only', { within: 20, operations: ['add'] }],
  ['within 20, subtracting only', { within: 20, operations: ['subtract'] }],
  ['within 100', { within: 100, operations: ['add', 'subtract'] }],
  ['within 100, adding only', { within: 100, operations: ['add'] }],
  ['within 100, subtracting only', { within: 100, operations: ['subtract'] }],
];
const TYPES = Object.entries(MATH_TYPES) as Array<[RulesTypeId, (typeof MATH_TYPES)[RulesTypeId]]>;
const RUNS = 10;

describe('the problems per practice setting offers 10, 15 or 20', () => {
  it('has those three choices', () => {
    expect([...PROBLEM_COUNTS]).toEqual([10, 15, 20]);
  });
});

describe.each(TYPES)('%s generates exactly the count asked for', (id, type) => {
  describe.each(RULES)('with %s', (_name, rules) => {
    it.each(COUNTS)('at %i: that many problems, an even spread over the kinds, no repeats', (count) => {
      const kinds = type.kinds(rules);
      for (let run = 0; run < RUNS; run += 1) {
        const problems = generateProblems(type, rules, createRandomSource(), count);

        expect(problems, `${id} run ${run}`).toHaveLength(count);
        expect(new Set(problems.map((p) => type.key(p))).size, `${id} run ${run}: repeats`).toBe(count);
        const perKind = kinds.map((kind) => problems.filter((p) => p.kind === kind).length);
        expect(Math.max(...perKind) - Math.min(...perKind), `${id} run ${run}: ${perKind}`).toBeLessThanOrEqual(1);
        expect(perKind.reduce((a, b) => a + b, 0)).toBe(count);
      }
    });
  });
});

describe('the remainder of an uneven spread', () => {
  it('spreads 15 problems over 4 kinds as 4, 4, 4 and 3', () => {
    const type = MATH_TYPES.facts;
    const kinds = type.kinds(DEFAULT_RULES);
    expect(kinds).toHaveLength(4);
    const problems = generateProblems(type, DEFAULT_RULES, createRandomSource(), 15);
    expect(kinds.map((kind) => problems.filter((p) => p.kind === kind).length).sort()).toEqual([3, 4, 4, 4]);
  });
});

describe('Facts stays half within 10 and half across ten, as close as the count allows', () => {
  const within = (kind: string): boolean => kind.endsWith('within-10');
  it.each(RULES)('with %s', (_name, rules) => {
    for (const count of COUNTS) {
      for (let run = 0; run < RUNS; run += 1) {
        const problems = generateProblems(MATH_TYPES.facts, rules, createRandomSource(), count);
        const inside = problems.filter((p) => within(p.kind)).length;
        expect(Math.abs(inside - (count - inside)), `${count}: ${inside} within 10`).toBe(count % 2);
      }
    }
  });
});

describe('createMathSession fixes the session size when it starts', () => {
  const env = { random: createRandomSource(), now: () => '2026-10-20T09:00:00.000Z', newId: () => 's-1' };
  it.each(COUNTS)('a session of %i problems has that many numbered spots', (problemCount) => {
    const session = createMathSession({ id: 'm', subject: 'math' }, { practiceType: 'facts', contentVersion: 'v', problemCount }, env);

    const round = session.rounds[0]!;
    expect(round.itemIds).toEqual(Array.from({ length: problemCount }, (_, i) => String(i + 1)));
    expect(Object.keys(round.problems!)).toHaveLength(problemCount);
  });
});
