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
    const problems = generateProblems(strategies, SUBTRACT, Math.random, 20);
    expect(problems).toHaveLength(20);
    expect(new Set(problems.map((p) => p.kind))).toEqual(new Set(['break-down-to-ten']));
  });

  it('adding only leaves only the adding tricks', () => {
    expect(strategies.kinds(ADD)).toEqual(['swap-order', 'make-ten-three', 'count-on', 'make-ten', 'near-doubles']);
  });
});
