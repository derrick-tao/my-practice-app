// Seam 2: a math session as it is created. It saves its own copy of the rules, so nothing that happens to a
// saved session can change the defaults (or a lesson's rules) that the next session starts from.
import { describe, expect, it } from 'vitest';
import { MATH_TYPES } from '../../src/math/index.ts';
import {
  createMathSession,
  currentProblem,
  nextProblem,
  outcomeOf,
  settleSavedTries,
  startMathRetryRound,
  submitAnswer,
} from '../../src/practice/math-session.ts';
import { currentItemId, currentRound, withCurrentRound } from '../../src/practice/session.ts';
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

describe('True or false has no second try', () => {
  const tf = { practiceType: 'true-or-false', contentVersion: 'v', problemCount: 10 } as const;
  const isTrueNow = (session: ReturnType<typeof createMathSession>): boolean => MATH_TYPES['true-or-false'].answer(currentProblem(session)!) === 1;
  const wrongEntry = (session: ReturnType<typeof createMathSession>): 'true' | 'false' => (isTrueNow(session) ? 'false' : 'true');

  it('settles as missed after one wrong answer: marked wrong, revealed, with one try on record', () => {
    const session = createMathSession(lesson, tf, env);
    const spot = currentItemId(currentRound(session))!;

    const after = submitAnswer(session, wrongEntry(session), env);

    expect(outcomeOf(after)).toBe('missed');
    expect(currentRound(after).phase).toBe('revealed');
    expect(currentRound(after).marks[spot]).toBe('wrong');
    expect(currentRound(after).tries![spot]).toHaveLength(1);
    expect(submitAnswer(after, 'true', env)).toBe(after); // a settled problem takes no further answer
  });

  it('a missed problem returns as a new problem in the retry round', () => {
    let session = createMathSession(lesson, tf, env);
    session = nextProblem(submitAnswer(session, wrongEntry(session), env), env);
    for (let i = 1; i < 10; i++) session = submitAnswer(session, isTrueNow(session) ? 'true' : 'false', env);

    const retry = startMathRetryRound(session, env);

    expect(currentRound(retry).itemIds).toEqual(['1']);
  });

  it('a session saved with one wrong True or false try reloads as missed (no schema change)', () => {
    const fresh = createMathSession(lesson, tf, env);
    const spot = currentItemId(currentRound(fresh))!;
    // the way an older version saved it: one wrong try, still waiting for the second
    const saved = withCurrentRound(fresh, (round) => ({ ...round, tries: { [spot]: [{ answer: wrongEntry(fresh), correct: false }] } }));
    expect(currentRound(saved).phase).toBe('prompt');

    const loaded = settleSavedTries(saved, env);

    expect(outcomeOf(loaded)).toBe('missed');
    expect(currentRound(loaded).phase).toBe('revealed');
    expect(currentRound(loaded).marks[spot]).toBe('wrong');
    expect(settleSavedTries(loaded, env)).toEqual(loaded);
  });

  it('number-pad types keep their second try', () => {
    const session = createMathSession(lesson, options, env);

    const after = submitAnswer(session, '99', env);

    expect(outcomeOf(after)).toBe('try-again');
    expect(currentRound(after).phase).toBe('prompt');
    expect(settleSavedTries(after, env)).toBe(after);
  });
});
