// Seam 2: a math session as it is created. It saves its own copy of the rules, so nothing that happens to a
// saved session can change the defaults (or a lesson's rules) that the next session starts from.
import { describe, expect, it } from 'vitest';
import { createMathSession } from '../../src/practice/math-session.ts';
import { DEFAULT_RULES } from '../../src/math/rules.ts';

const env = { random: () => 0.5, now: () => '2026-10-20T09:00:00.000Z', newId: () => 's-1' };
const lesson = { id: 'm', subject: 'math' };
const options = { practiceType: 'facts', contentVersion: 'v', problemCount: 20 } as const;

describe('createMathSession rules', () => {
  it('saves a copy of the default rules, not the shared object', () => {
    const session = createMathSession(lesson, options, env);

    expect(session.mathRules).toEqual(DEFAULT_RULES);
    expect(session.mathRules).not.toBe(DEFAULT_RULES);
    expect(session.mathRules!.operations).not.toBe(DEFAULT_RULES.operations);
  });

  it("saves a copy of the lesson's rules too", () => {
    const rules = { within: 100, operations: ['add' as const] };
    const session = createMathSession({ ...lesson, rules: { facts: rules } }, options, env);

    expect(session.mathRules).toEqual(rules);
    expect(session.mathRules).not.toBe(rules);
    expect(session.mathRules!.operations).not.toBe(rules.operations);
  });
});
