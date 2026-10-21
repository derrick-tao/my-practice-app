// Math practice state: the same Session -> Round -> Mark shape as every practice type, with a generated Problem at
// each of the round's numbered spots ("1" to "20") and the Tries made at it. Pure like session.ts: each function
// takes a session and returns the next one (or the same object when the action does not apply).
//
// One problem goes: first try right -> ✅ and on to the next problem; first try wrong -> the same problem again
// (phase stays `prompt`, one try on record); second try right -> ❌ ("got it!", phase `revealed`, Next moves on);
// second try wrong -> ❌ and the answer with its strategy (phase `revealed`, Next moves on). The mark is saved the
// moment it is decided, so a reload shows the same screen. A retry round puts a new problem of the same kind at each
// ❌ spot. There is no undo and no timer.
import type { RulesTypeId } from '../content/types.ts';
import { isCorrectEntry, isValidEntry } from '../math/answer.ts';
import { generateProblems, generateReplacement } from '../math/generate.ts';
import { MATH_TYPES } from '../math/index.ts';
import { MAX_TRIES, type Problem, type Try } from '../math/problem.ts';
import { DEFAULT_RULES, type Rules } from '../math/rules.ts';
import {
  canRetry,
  currentItemId,
  currentRound,
  finishIfClean,
  isRoundOver,
  wrongItemIds,
  withCurrentRound,
  DEFAULT_PROFILE_ID,
  type PracticeEnv,
  type Round,
  type Session,
} from './session.ts';

/** A math lesson as a session needs it: its rules (a type missing from `rules` means the defaults). */
export interface MathLesson {
  id: string;
  subject: string;
  rules?: Partial<Record<RulesTypeId, Rules>>;
}

export function createMathSession(
  lesson: MathLesson,
  options: { practiceType: RulesTypeId; contentVersion: string; profileId?: string },
  env: PracticeEnv,
): Session {
  const rules = lesson.rules?.[options.practiceType] ?? DEFAULT_RULES;
  const generated = generateProblems(MATH_TYPES[options.practiceType], rules, env.random);
  const now = env.now();
  return {
    id: env.newId(),
    profileId: options.profileId ?? DEFAULT_PROFILE_ID,
    subject: lesson.subject,
    practiceType: options.practiceType,
    lessonId: lesson.id,
    contentVersion: options.contentVersion,
    status: 'active',
    startedAt: now,
    updatedAt: now,
    rounds: [spotsRound(1, generated, now)],
    undo: null,
    marksSinceBreak: 0,
    mathRules: rules,
  };
}

/** A round whose spots "1".."n" hold the given problems (a retry round's spots keep the ids they had, see below). */
function spotsRound(index: number, problems: Problem[], now: string, spotIds?: string[]): Round {
  const itemIds = spotIds ?? problems.map((_, i) => String(i + 1));
  return {
    index,
    itemIds,
    position: 0,
    phase: 'prompt',
    heardCurrent: false,
    marks: {},
    startedAt: now,
    problems: Object.fromEntries(itemIds.map((id, i) => [id, problems[i]!])),
    tries: {},
  };
}

const typeOf = (session: Session) => MATH_TYPES[session.practiceType as RulesTypeId];

/** The problem at the current spot, or undefined when the round is over. */
export function currentProblem(session: Session): Problem | undefined {
  const round = currentRound(session);
  const id = currentItemId(round);
  return id === undefined ? undefined : round.problems?.[id];
}

/** The tries made so far at the current spot (none for a fresh problem, one while the second try is pending). */
export function currentTries(session: Session): Try[] {
  const round = currentRound(session);
  const id = currentItemId(round);
  return (id === undefined ? undefined : round.tries?.[id]) ?? [];
}

/** Where the current problem stands once a try has been made (read back from the saved tries, so a reload shows the same thing). */
export type TryOutcome = 'try-again' | 'second-try-right' | 'missed';

/** `undefined` for a problem with no try yet. */
export function outcomeOf(session: Session): TryOutcome | undefined {
  const last = currentTries(session).at(-1);
  if (!last) return undefined;
  if (currentRound(session).phase === 'prompt') return 'try-again';
  return last.correct ? 'second-try-right' : 'missed';
}

/** Submit what was typed (digits) or tapped ("true" / "false"); nothing happens for anything else, a finished problem or a finished round. */
export function submitAnswer(session: Session, entry: string, env: PracticeEnv): Session {
  if (session.status !== 'active' || !isValidEntry(typeOf(session), entry)) return session;
  const before = currentRound(session);
  const id = currentItemId(before);
  const problem = id === undefined ? undefined : before.problems?.[id];
  if (id === undefined || !problem || before.phase !== 'prompt') return session;
  const prior = before.tries?.[id] ?? [];
  if (prior.length >= MAX_TRIES) return session;

  const correct = isCorrectEntry(typeOf(session), problem, entry);
  const tries = [...prior, { answer: entry, correct }];
  const settledRight = correct && prior.length === 0;
  const settled = correct || tries.length >= MAX_TRIES;

  const updated = withCurrentRound(session, (round) => {
    const withTry = { ...round, tries: { ...round.tries, [id]: tries } };
    if (!settled) return withTry; // wrong the first time: the same problem again
    const marked = { ...withTry, marks: { ...round.marks, [id]: settledRight ? ('correct' as const) : ('wrong' as const) } };
    return settledRight ? moveOn(marked, env) : { ...marked, phase: 'revealed' as const };
  });
  return settledRight ? afterFinished(updated, env) : updated;
}

/** Next: the answer (and strategy) has been seen, so move to the next problem. */
export function nextProblem(session: Session, env: PracticeEnv): Session {
  if (session.status !== 'active') return session;
  if (currentRound(session).phase !== 'revealed' || isRoundOver(currentRound(session))) return session;
  return afterFinished(withCurrentRound(session, (round) => moveOn(round, env)), env);
}

/** The next spot: the learner's place moves on and the round is over after the last one. */
function moveOn(round: Round, env: PracticeEnv): Round {
  const position = round.position + 1;
  return {
    ...round,
    position,
    phase: 'prompt',
    heardCurrent: false,
    ...(position >= round.itemIds.length ? { completedAt: env.now() } : {}),
  };
}

/** A problem is finished: it counts toward the break prompt, and a round with no ❌ left completes the session. */
function afterFinished(session: Session, env: PracticeEnv): Session {
  const counted = { ...session, marksSinceBreak: session.marksSinceBreak + 1 };
  return finishIfClean(counted, env, new Set(currentRound(counted).itemIds));
}

/** Every problem the session has shown, by their keys, so a retry round never repeats one. */
function usedKeys(session: Session): Set<string> {
  const type = typeOf(session);
  return new Set(session.rounds.flatMap((round) => Object.values(round.problems ?? {}).map((problem) => type.key(problem))));
}

/** The retry round: the ❌ spots, in the order they were in, each with a new problem of the same kind. */
export function startMathRetryRound(session: Session, env: PracticeEnv): Session {
  const previous = currentRound(session);
  const spots = new Set(previous.itemIds);
  if (!canRetry(session, spots)) return session;
  const missed = wrongItemIds(previous, spots);
  const type = typeOf(session);
  const rules = session.mathRules ?? DEFAULT_RULES;
  const used = usedKeys(session);
  const fresh = missed.map((id) => {
    const problem = generateReplacement(type, rules, previous.problems![id]!.kind, used, env.random);
    used.add(type.key(problem));
    return problem;
  });
  return {
    ...session,
    rounds: [...session.rounds, spotsRound(previous.index + 1, fresh, env.now(), missed)],
    undo: null,
    marksSinceBreak: 0,
  };
}
