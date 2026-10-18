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

/** Sessions saved before profiles existed (ticket 05) belong to this implicit profile; the first real profile adopts them (profiles.ts). */
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

/** Ids marked wrong in a round, in the order the round presented them. */
export const wrongItemIds = (round: Round): string[] => round.itemIds.filter((id) => round.marks[id] === 'wrong');

/** The finished round has misses to practice again (the session is still active). */
export const canRetry = (session: Session): boolean => {
  const round = currentRound(session);
  return session.status === 'active' && isRoundOver(round) && wrongItemIds(round).length > 0;
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

/** A round that ends with no misses completes the session (no summary / retry step). */
function finishIfClean(session: Session, env: PracticeEnv): Session {
  const round = currentRound(session);
  if (session.status !== 'active' || !isRoundOver(round) || wrongItemIds(round).length > 0) return session;
  return { ...session, status: 'completed', completedAt: round.completedAt ?? env.now() };
}

/**
 * Minimal guard for a list that changed under a saved session (ticket 10 does the full reconciliation):
 * step past current items that are no longer in the list, so the child is never stuck on one. If that
 * ends the round, the usual summary (or completion) follows.
 */
export function skipUnknownItems(session: Session, listed: ReadonlySet<string>, env: PracticeEnv): Session {
  if (session.status !== 'active') return session;
  const skipped = withCurrentRound(session, (round) => {
    let position = round.position;
    while (position < round.itemIds.length && !listed.has(round.itemIds[position]!)) position++;
    if (position === round.position) return round;
    return {
      ...round,
      position,
      phase: 'listening',
      heardCurrent: false,
      ...(position >= round.itemIds.length ? { completedAt: env.now() } : {}),
    };
  });
  return skipped === session ? session : finishIfClean(skipped, env);
}

/**
 * Start the next round from exactly the items marked wrong in the finished round, always shuffled.
 * The new order differs from the order those items had in the previous round (when there are
 * at least two), so the child never sees the same sequence again.
 */
export function startRetryRound(session: Session, env: PracticeEnv): Session {
  if (!canRetry(session)) return session;
  const previous = currentRound(session);
  const missed = wrongItemIds(previous);
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
