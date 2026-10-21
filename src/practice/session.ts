// Practice state: Session -> Round -> Mark, plain JSON with item ids only (an item's id is its
// target, which is unique within a list). Every function here is pure: it takes a session and
// returns the next one (or the same object when the action does not apply).
//
// The shape is the spec's data model and is persisted as is through the StorageAdapter (see
// session-sync.ts), so retry rounds, undo and breaks extend it instead of rewriting it. Changing
// the persisted shape needs a schema migration (src/storage/migrations.ts).
import { isListType, type LessonData, type PracticeTypeId } from '../content/types.ts';
import type { Problem, Try } from '../math/problem.ts';
import type { Rules } from '../math/rules.ts';
import { shuffled, type RandomSource } from './random.ts';

export type Mark = 'correct' | 'wrong';
/** `prompt`: the item is being prompted (heard, for dictation); `revealed`: its target is showing. */
export type Phase = 'prompt' | 'revealed';
export type SessionStatus = 'active' | 'completed' | 'stopped';

export interface Round {
  /** 1-based. */
  index: number;
  /** Ordered item ids (targets) for this round. */
  itemIds: string[];
  /** Index into itemIds of the current item; equals itemIds.length once the round is over. */
  position: number;
  phase: Phase;
  /** The audio for the current item has started at least once. */
  heardCurrent: boolean;
  /** item id -> mark, for items marked so far. */
  marks: Record<string, Mark>;
  startedAt: string;
  completedAt?: string;
  /**
   * Math sessions only: the problem at each item id (a numbered spot, "1" to the session size). A retry round puts a new problem
   * of the same kind at the same spot. Without it the item id is the item (every other practice type).
   */
  problems?: Record<string, Problem>;
  /** Math sessions only: the tries made so far at each item id in this round (at most two). */
  tries?: Record<string, Try[]>;
}

/** The last mark, kept so one tap can take it back (one level only). */
export interface UndoEntry {
  roundIndex: number;
  itemId: string;
  position: number;
  previousMark?: Mark;
}

export interface Session {
  id: string;
  profileId: string;
  subject: string;
  practiceType: PracticeTypeId;
  lessonId: string;
  contentVersion: string;
  status: SessionStatus;
  startedAt: string;
  completedAt?: string;
  /** When the session was last saved (the storage adapter stamps it on every save). */
  updatedAt: string;
  rounds: Round[];
  /** The single undo entry, or null. Set by a mark; cleared by the next mark, a new round, or completion. */
  undo: UndoEntry | null;
  /**
   * Marks (and Next taps in stroke order and learning sessions) since the last break prompt was answered (or the last retry round started).
   * The name stays because renaming the saved field would need a storage migration.
   */
  marksSinceBreak: number;
  /**
   * A learning session (phrase recognition while the learner's learning setting was on): the items are shown and
   * heard, then Next, with no marks. Fixed when the session starts, so changing the setting leaves a session in
   * progress as it was. Absent means graded.
   */
  learning?: true;
  /**
   * Math sessions only: the lesson's rules as they were when the session started, so its retry rounds keep generating
   * problems the same way even if the lesson is edited.
   */
  mathRules?: Rules;
}

/** Whether the session's items are marked ✅/❌. Stroke order and learning sessions are not: they have no scores, undo or retry rounds. */
export const hasMarks = (session: Pick<Session, 'practiceType' | 'learning'>): boolean =>
  session.practiceType !== 'stroke-order' && !session.learning;

/** Everything non-deterministic the practice logic needs; injected so tests can pin it. */
export interface PracticeEnv {
  random: RandomSource;
  now(): string;
  newId(): string;
}

/** Sessions saved before profiles existed (ticket 05) belong to this implicit profile; the first real profile adopts them (profiles.ts). */
export const DEFAULT_PROFILE_ID = 'default';

export function createSession(
  lesson: Pick<LessonData, 'id' | 'subject' | 'lists'>,
  options: {
    practiceType: PracticeTypeId;
    contentVersion: string;
    shuffle: boolean;
    profileId?: string;
    /** Start a learning session. Only phrase recognition has them; any other practice type ignores it. */
    learning?: boolean;
  },
  env: PracticeEnv,
): Session {
  const items = isListType(options.practiceType) ? lesson.lists[options.practiceType] : undefined;
  const itemIds = (items ?? []).map((item) => item.target);
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
    rounds: [
      {
        index: 1,
        itemIds: options.shuffle ? shuffled(itemIds, env.random) : itemIds,
        position: 0,
        phase: 'prompt',
        heardCurrent: false,
        marks: {},
        startedAt: now,
      },
    ],
    undo: null,
    marksSinceBreak: 0,
    ...(options.learning && options.practiceType === 'phrase-recognition' ? { learning: true as const } : {}),
  };
}

export const currentRound = (session: Session): Round => session.rounds[session.rounds.length - 1]!;

export const isRoundOver = (round: Round): boolean => round.position >= round.itemIds.length;

/** The item being practiced, or undefined when the round is over. */
export const currentItemId = (round: Round): string | undefined => round.itemIds[round.position];

/**
 * Ids marked wrong in a round, in the order the round presented them. Misses on items the list no
 * longer has (`listed` are the ids it has now) are left out: the parent removed them, and their marks
 * stay in the round as history.
 */
export const wrongItemIds = (round: Round, listed: ReadonlySet<string>): string[] =>
  round.itemIds.filter((id) => round.marks[id] === 'wrong' && listed.has(id));

/** The finished round has misses to practice again (the session is still active). */
export const canRetry = (session: Session, listed: ReadonlySet<string>): boolean => {
  const round = currentRound(session);
  return session.status === 'active' && isRoundOver(round) && wrongItemIds(round, listed).length > 0;
};

export function markCounts(round: Round): { correct: number; wrong: number } {
  const marks = Object.values(round.marks);
  return {
    correct: marks.filter((m) => m === 'correct').length,
    wrong: marks.filter((m) => m === 'wrong').length,
  };
}

export function withCurrentRound(session: Session, update: (round: Round) => Round): Session {
  const round = currentRound(session);
  const next = update(round);
  if (next === round) return session;
  return { ...session, rounds: [...session.rounds.slice(0, -1), next] };
}

/** Where the learner is, so late async results (audio started) can be matched to the item they were for. */
export interface Place {
  roundIndex: number;
  position: number;
}

export const placeOf = (session: Session): Place => {
  const round = currentRound(session);
  return { roundIndex: round.index, position: round.position };
};

/** Audio for the item at `place` started. Ignored if the learner has already moved on. */
export function markHeard(session: Session, place: Place): Session {
  return withCurrentRound(session, (round) =>
    round.index !== place.roundIndex || round.position !== place.position || round.heardCurrent
      ? round
      : { ...round, heardCurrent: true },
  );
}

/** Check: moves to the revealed phase. With `needsHeard` (dictation) it is only available once the current item's audio has been heard. */
export function reveal(session: Session, needsHeard: boolean): Session {
  if (!hasMarks(session)) return session;
  return withCurrentRound(session, (round) =>
    isRoundOver(round) || round.phase !== 'prompt' || (needsHeard && !round.heardCurrent)
      ? round
      : { ...round, phase: 'revealed' },
  );
}

/** Record the learner's mark for the revealed item and move to the next one (or finish the round). */
export function mark(session: Session, result: Mark, env: PracticeEnv): Session {
  if (!hasMarks(session)) return session;
  const before = currentRound(session);
  const itemId = currentItemId(before);
  const marked = withCurrentRound(session, (round) => {
    if (itemId === undefined || round.phase !== 'revealed') return round;
    const position = round.position + 1;
    return {
      ...round,
      marks: { ...round.marks, [itemId]: result },
      position,
      phase: 'prompt',
      heardCurrent: false,
      ...(position >= round.itemIds.length ? { completedAt: env.now() } : {}),
    };
  });
  if (marked === session || itemId === undefined) return marked;
  const entry: UndoEntry = { roundIndex: before.index, itemId, position: before.position };
  const previousMark = before.marks[itemId];
  if (previousMark) entry.previousMark = previousMark;
  const next = { ...marked, undo: entry, marksSinceBreak: marked.marksSinceBreak + 1 };
  // Marking happens on the round as it is: every one of its items still counts.
  return finishIfClean(next, env, new Set(currentRound(next).itemIds));
}

/**
 * Next (stroke order, learning sessions): the learner has drawn or heard the current item, so move on to the next
 * one (or finish) with no mark. It counts toward the break prompt like a mark does, but sets no undo entry: there
 * is nothing to take back. With no ❌ such a round is always clean, so it never leads to a retry round.
 */
export function next(session: Session, env: PracticeEnv): Session {
  if (session.status !== 'active' || hasMarks(session)) return session;
  const moved = withCurrentRound(session, (round) => {
    if (isRoundOver(round)) return round;
    const position = round.position + 1;
    return {
      ...round,
      position,
      phase: 'prompt',
      heardCurrent: false,
      ...(position >= round.itemIds.length ? { completedAt: env.now() } : {}),
    };
  });
  if (moved === session) return session;
  const counted = { ...moved, marksSinceBreak: moved.marksSinceBreak + 1 };
  return finishIfClean(counted, env, new Set(currentRound(counted).itemIds));
}

/** The last mark can be taken back: it is in the current round, and nothing has been marked since. */
export function canUndo(session: Session): boolean {
  const entry = session.undo;
  if (session.status !== 'active' || !entry) return false;
  const round = currentRound(session);
  return (
    round.index === entry.roundIndex &&
    entry.position < round.position &&
    round.itemIds[entry.position] === entry.itemId
  );
}

/**
 * Take back the last mark: its item is shown again in the revealed phase with the mark removed (or
 * put back to what it was). From a round summary this reopens the round. Undo is used up by this.
 */
export function undo(session: Session): Session {
  if (!canUndo(session)) return session;
  const entry = session.undo!;
  const { completedAt: _reopened, ...round } = currentRound(session);
  const { [entry.itemId]: _removed, ...marks } = round.marks;
  const reopened: Round = {
    ...round,
    position: entry.position,
    phase: 'revealed',
    heardCurrent: true,
    marks: entry.previousMark ? { ...marks, [entry.itemId]: entry.previousMark } : marks,
  };
  return {
    ...session,
    rounds: [...session.rounds.slice(0, -1), reopened],
    undo: null,
    marksSinceBreak: Math.max(0, session.marksSinceBreak - 1),
  };
}

/**
 * A break prompt is due: `breakEvery` marks (0 is off) since the last one, and the round is not over
 * (a round end has its own summary, so the prompt never lands there).
 */
export function breakDue(session: Session, breakEvery: number): boolean {
  return (
    session.status === 'active' &&
    breakEvery > 0 &&
    session.marksSinceBreak >= breakEvery &&
    !isRoundOver(currentRound(session))
  );
}

/** Keep going / Break: the prompt is answered, so counting starts again. */
export function resetBreakCount(session: Session): Session {
  return session.marksSinceBreak === 0 ? session : { ...session, marksSinceBreak: 0 };
}

/** A round that ends with no misses to practice completes the session (no summary / retry step). */
export function finishIfClean(session: Session, env: PracticeEnv, listed: ReadonlySet<string>): Session {
  const round = currentRound(session);
  if (session.status !== 'active' || !isRoundOver(round) || wrongItemIds(round, listed).length > 0) return session;
  return { ...session, status: 'completed', completedAt: round.completedAt ?? env.now(), undo: null };
}

/**
 * Make a saved session agree with the list as it is now. Run when the session is opened, and again after
 * every step (a no-op once it agrees). Sessions hold item ids only, so edits to a clue, pinyin or audio
 * need nothing here. What the list lost is handled:
 *  - removed items still to come drop out of the current round, so they never show up and never reach a
 *    later round. If the current item was removed practice moves to the next one; if that ends the round
 *    the usual summary (or completion) follows;
 *  - marks already made stay on the session as history, removed item or not; but the undo entry of a
 *    removed item is dropped (nothing to take back to), and the break count is kept;
 *  - items the list gained are not added (the next session picks them up);
 *  - if none of the session's items are in the list any more, the session is stopped.
 * Returns the same object when nothing needed to change.
 */
export function reconcileWithList(session: Session, listed: ReadonlySet<string>, env: PracticeEnv): Session {
  if (session.status !== 'active') return session;
  if (!session.rounds[0]!.itemIds.some((id) => listed.has(id))) return { ...session, status: 'stopped', undo: null };
  // Undo must never reopen an item the list no longer has. (Entries always point before the current
  // position, which pruning below never touches, so the position stays valid; the break count is left
  // alone: the marks it counts are kept as history.)
  const kept = session.undo && !listed.has(session.undo.itemId) ? { ...session, undo: null } : session;
  const pruned = withCurrentRound(kept, (round) => {
    if (isRoundOver(round)) return round;
    const itemIds = round.itemIds.filter((id, i) => i < round.position || listed.has(id));
    if (itemIds.length === round.itemIds.length) return round;
    const currentGone = itemIds[round.position] !== round.itemIds[round.position];
    return {
      ...round,
      itemIds,
      ...(currentGone ? { phase: 'prompt' as const, heardCurrent: false } : {}),
      ...(round.position >= itemIds.length ? { completedAt: env.now() } : {}),
    };
  });
  return finishIfClean(pruned, env, listed);
}

/**
 * Start the next round from exactly the items marked wrong in the finished round, always shuffled.
 * The new order differs from the order those items had in the previous round (when there are
 * at least two), so the child never sees the same sequence again.
 */
export function startRetryRound(session: Session, env: PracticeEnv, listed: ReadonlySet<string>): Session {
  if (!canRetry(session, listed)) return session;
  const previous = currentRound(session);
  const missed = wrongItemIds(previous, listed);
  let itemIds = shuffled(missed, env.random);
  if (missed.length > 1 && itemIds.every((id, i) => id === missed[i])) {
    itemIds = [...itemIds.slice(1), itemIds[0]!];
  }
  const round: Round = {
    index: previous.index + 1,
    itemIds,
    position: 0,
    phase: 'prompt',
    heardCurrent: false,
    marks: {},
    startedAt: env.now(),
  };
  return { ...session, rounds: [...session.rounds, round], undo: null, marksSinceBreak: 0 };
}

export interface SessionResult {
  /** Round 1 items marked correct. */
  firstTryCorrect: number;
  /** Round 1 item count. */
  total: number;
  rounds: number;
}

export function sessionResult(session: Session): SessionResult {
  const first = session.rounds[0]!;
  return {
    firstTryCorrect: markCounts(first).correct,
    total: first.itemIds.length,
    rounds: session.rounds.length,
  };
}
