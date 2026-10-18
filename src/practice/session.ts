// Practice state: Session -> Round -> Mark, plain JSON with item ids only (an item's id is its
// target, which is unique within a list). Every function here is pure: it takes a session and
// returns the next one (or the same object when the action does not apply).
//
// The shape is the spec's data model and is persisted as is through the StorageAdapter (see
// session-sync.ts), so retry rounds, undo and breaks extend it instead of rewriting it. Changing
// the persisted shape needs a schema migration (src/storage/migrations.ts).
import type { ListData, PracticeTypeId } from '../content/types.ts';
import { shuffled, type RandomSource } from './random.ts';

export type Mark = 'correct' | 'wrong';
export type Phase = 'listening' | 'revealed';
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
}

/** Ticket 06 fills this in. */
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
  listId: string;
  contentVersion: string;
  status: SessionStatus;
  startedAt: string;
  completedAt?: string;
  rounds: Round[];
  /** Ticket 06. */
  undo: UndoEntry | null;
  /** Ticket 06. */
  marksSinceBreak: number;
}

/** Everything non-deterministic the practice logic needs; injected so tests can pin it. */
export interface PracticeEnv {
  random: RandomSource;
  now(): string;
  newId(): string;
}

/** Until profiles exist (ticket 07) everything belongs to this implicit profile. */
export const DEFAULT_PROFILE_ID = 'default';

export function createSession(
  list: Pick<ListData, 'id' | 'subject' | 'items'>,
  options: { practiceType: PracticeTypeId; contentVersion: string; shuffle: boolean; profileId?: string },
  env: PracticeEnv,
): Session {
  const itemIds = list.items.map((item) => item.target);
  const now = env.now();
  return {
    id: env.newId(),
    profileId: options.profileId ?? DEFAULT_PROFILE_ID,
    subject: list.subject,
    practiceType: options.practiceType,
    listId: list.id,
    contentVersion: options.contentVersion,
    status: 'active',
    startedAt: now,
    rounds: [
      {
        index: 1,
        itemIds: options.shuffle ? shuffled(itemIds, env.random) : itemIds,
        position: 0,
        phase: 'listening',
        heardCurrent: false,
        marks: {},
        startedAt: now,
      },
    ],
    undo: null,
    marksSinceBreak: 0,
  };
}

export const currentRound = (session: Session): Round => session.rounds[session.rounds.length - 1]!;

export const isRoundOver = (round: Round): boolean => round.position >= round.itemIds.length;

/** The item being practiced, or undefined when the round is over. */
export const currentItemId = (round: Round): string | undefined => round.itemIds[round.position];

/**
 * Ids marked wrong in a round, in the order the round presented them. Given the ids the list still has,
 * misses on items the parent has since removed are left out (their marks stay in the round as history).
 */
export const wrongItemIds = (round: Round, listed?: ReadonlySet<string>): string[] =>
  round.itemIds.filter((id) => round.marks[id] === 'wrong' && (listed === undefined || listed.has(id)));

/** The finished round has misses to practice again (the session is still active). */
export const canRetry = (session: Session, listed?: ReadonlySet<string>): boolean => {
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

function withCurrentRound(session: Session, update: (round: Round) => Round): Session {
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

/** Check: only available once the current item's audio has been heard. */
export function reveal(session: Session): Session {
  return withCurrentRound(session, (round) =>
    isRoundOver(round) || round.phase !== 'listening' || !round.heardCurrent
      ? round
      : { ...round, phase: 'revealed' },
  );
}

/** Record the learner's mark for the revealed item and move to the next one (or finish the round). */
export function mark(session: Session, result: Mark, env: PracticeEnv): Session {
  const marked = withCurrentRound(session, (round) => {
    const itemId = currentItemId(round);
    if (itemId === undefined || round.phase !== 'revealed') return round;
    const position = round.position + 1;
    return {
      ...round,
      marks: { ...round.marks, [itemId]: result },
      position,
      phase: 'listening',
      heardCurrent: false,
      ...(position >= round.itemIds.length ? { completedAt: env.now() } : {}),
    };
  });
  return finishIfClean(marked, env);
}

/** A round that ends with no misses to practice completes the session (no summary / retry step). */
function finishIfClean(session: Session, env: PracticeEnv, listed?: ReadonlySet<string>): Session {
  const round = currentRound(session);
  if (session.status !== 'active' || !isRoundOver(round) || wrongItemIds(round, listed).length > 0) return session;
  return { ...session, status: 'completed', completedAt: round.completedAt ?? env.now() };
}

/**
 * Make a saved session agree with the list as it is now. Run when the session is opened, and again after
 * every step (a no-op once it agrees). Sessions hold item ids only, so edits to a clue, pinyin or audio
 * need nothing here. What the list lost is handled:
 *  - removed items still to come drop out of the current round, so they never show up and never reach a
 *    later round. If the current item was removed practice moves to the next one; if that ends the round
 *    the usual summary (or completion) follows;
 *  - marks already made stay on the session as history, removed item or not;
 *  - items the list gained are not added (the next session picks them up);
 *  - if none of the session's items are in the list any more, the session is stopped.
 * Returns the same object when nothing needed to change.
 */
export function reconcileWithList(session: Session, listed: ReadonlySet<string>, env: PracticeEnv): Session {
  if (session.status !== 'active') return session;
  if (!session.rounds[0]!.itemIds.some((id) => listed.has(id))) return { ...session, status: 'stopped' };
  const pruned = withCurrentRound(session, (round) => {
    if (isRoundOver(round)) return round;
    const itemIds = round.itemIds.filter((id, i) => i < round.position || listed.has(id));
    if (itemIds.length === round.itemIds.length) return round;
    const currentGone = itemIds[round.position] !== round.itemIds[round.position];
    return {
      ...round,
      itemIds,
      ...(currentGone ? { phase: 'listening' as const, heardCurrent: false } : {}),
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
export function startRetryRound(session: Session, env: PracticeEnv, listed?: ReadonlySet<string>): Session {
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
    phase: 'listening',
    heardCurrent: false,
    marks: {},
    startedAt: env.now(),
  };
  return { ...session, rounds: [...session.rounds, round], undo: null };
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
