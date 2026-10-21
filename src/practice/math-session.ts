// Math practice state: the same Session -> Round -> Mark shape as every practice type, with a generated Problem at
// each of the round's numbered spots ("1" to "20") and the Tries made at it. Pure like session.ts: each function
// takes a session and returns the next one (or the same object when the action does not apply).
//
// One problem is one or more steps (blanks): Facts has one, a Strategies problem several. Each step goes: first try
// right -> on to the next step; first try wrong -> the same step again (phase stays `prompt`, one try on record);
// second try right -> "got it!" (phase `revealed`, Next moves on); second try wrong -> the answer with its explanation
// (phase `revealed`, Next moves on). The problem is ✅ only if every step was right on its first try, and its mark is
// decided, and saved, the moment its last step is settled, so a reload shows the same screen. Which step the learner is
// on is never saved on its own: it is read back from the tries (each says its step) and the phase. A retry round puts a
// new problem of the same kind at each ❌ spot. There is no undo and no timer.
import type { RulesTypeId } from '../content/types.ts';
import { isCorrectEntry, isValidEntry } from '../math/answer.ts';
import { generateProblems, generateReplacement } from '../math/generate.ts';
import { MATH_TYPES } from '../math/index.ts';
import { MAX_TRIES, type Problem, type Try } from '../math/problem.ts';
import type { Step } from '../math/types.ts';
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

/** The blanks of a problem, in order. A type without `steps` (Facts) has the one blank at the end of its equation. */
function stepsOf(session: Session, problem: Problem): Step[] {
  const type = typeOf(session);
  return type.steps?.(problem) ?? [{ before: `${type.equation(problem)} `, after: '', answer: type.answer(problem), explanation: type.strategy(problem) }];
}

const stepOfTry = (attempt: Try): number => attempt.step ?? 0;
const triesAt = (tries: Try[], step: number): Try[] => tries.filter((attempt) => stepOfTry(attempt) === step);
/** A step is over once it is answered right or both tries are used. */
const isStepSettled = (tries: Try[]): boolean => tries.some((attempt) => attempt.correct) || tries.length >= MAX_TRIES;

/** Where the learner is within the current problem: the step shown, how many there are, and the tries at that step. */
export interface StepPlace {
  index: number;
  steps: Step[];
  /** The step on screen (its answer and explanation are what feedback shows). */
  step: Step;
  /** The tries made at this step: none for a fresh one, one while the second try is pending. */
  tries: Try[];
}

/** `undefined` when the round is over. Read back from the saved tries and phase, so a reload lands on the same step. */
export function currentStep(session: Session): StepPlace | undefined {
  const problem = currentProblem(session);
  if (!problem) return undefined;
  const steps = stepsOf(session, problem);
  const all = currentRound(session).tries?.[currentItemId(currentRound(session))!] ?? [];
  // `revealed` is a settled step waiting for Next: it is the step of the latest try. Otherwise it is the first step not settled.
  const settledFirst = steps.findIndex((_, i) => !isStepSettled(triesAt(all, i)));
  const index =
    currentRound(session).phase === 'revealed' ? stepOfTry(all.at(-1)!) : settledFirst === -1 ? steps.length - 1 : settledFirst;
  return { index, steps, step: steps[index]!, tries: triesAt(all, index) };
}

/** The tries made so far at the current step. */
export function currentTries(session: Session): Try[] {
  return currentStep(session)?.tries ?? [];
}

/** Where the current step stands once a try has been made (read back from the saved tries, so a reload shows the same thing). */
export type TryOutcome = 'try-again' | 'second-try-right' | 'missed';

/** `undefined` for a step with no try yet. */
export function outcomeOf(session: Session): TryOutcome | undefined {
  const last = currentTries(session).at(-1);
  if (!last) return undefined;
  if (currentRound(session).phase === 'prompt') return 'try-again';
  return last.correct ? 'second-try-right' : 'missed';
}

/** Submit what was typed (digits) or tapped ("true" / "false"). Nothing happens for anything else, a settled step or a finished round. */
export function submitAnswer(session: Session, entry: string, env: PracticeEnv): Session {
  if (session.status !== 'active' || !isValidEntry(typeOf(session), entry)) return session;
  const before = currentRound(session);
  const id = currentItemId(before);
  const place = currentStep(session);
  const problem = currentProblem(session);
  if (id === undefined || !problem || !place || before.phase !== 'prompt') return session;
  if (place.tries.length >= MAX_TRIES) return session;

  const correct = isCorrectEntry(typeOf(session), problem, entry, place.step.answer);
  // Facts has one step and saves no step number, so what it saved before multi-step problems is unchanged.
  const attempt: Try = { answer: entry, correct, ...(place.steps.length > 1 && { step: place.index }) };
  const all = [...(before.tries?.[id] ?? []), attempt];
  const tries = triesAt(all, place.index);
  const firstTryRight = correct && tries.length === 1;
  if (!isStepSettled(tries)) return withCurrentRound(session, (round) => ({ ...round, tries: { ...round.tries, [id]: all } })); // wrong the first time: the same step again

  const isLast = place.index === place.steps.length - 1;
  // ✅ only if every step was right on its first try.
  const clean = place.steps.every((_, i) => {
    const at = triesAt(all, i);
    return at.length === 1 && at[0]!.correct;
  });
  const updated = withCurrentRound(session, (round) => {
    const withTry = { ...round, tries: { ...round.tries, [id]: all } };
    if (!isLast) return firstTryRight ? withTry : { ...withTry, phase: 'revealed' as const };
    const marked = { ...withTry, marks: { ...round.marks, [id]: clean ? ('correct' as const) : ('wrong' as const) } };
    return firstTryRight ? moveOn(marked, env) : { ...marked, phase: 'revealed' as const };
  });
  return isLast && firstTryRight ? afterFinished(updated, env) : updated;
}

/** Next: the answer (and explanation) has been seen, so move to the next step, or after the last one to the next problem. */
export function nextProblem(session: Session, env: PracticeEnv): Session {
  if (session.status !== 'active') return session;
  const round = currentRound(session);
  const place = currentStep(session);
  if (round.phase !== 'revealed' || isRoundOver(round) || !place) return session;
  if (place.index < place.steps.length - 1) return withCurrentRound(session, (r) => ({ ...r, phase: 'prompt' as const })); // the problem goes on
  return afterFinished(withCurrentRound(session, (r) => moveOn(r, env)), env);
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
