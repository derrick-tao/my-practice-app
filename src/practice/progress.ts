// What the parent's Progress page shows, computed from saved sessions. Pure: sessions in, numbers out.
//
// Definitions (the spec's):
//  - first-try score: round 1's correct marks out of round 1's item count;
//  - rounds to complete: how many rounds a completed attempt took;
//  - a stopped attempt is listed, but is left out of the trend and the best score (so is an attempt
//    still in progress: neither has finished);
//  - trickiest: items by total wrong marks over every round of every attempt of the list.
import { isRoundOver, markCounts, type Round, type Session, type SessionStatus } from './session.ts';

export interface Score {
  correct: number;
  total: number;
}

export interface RoundSummary {
  /** 1-based round number. */
  index: number;
  itemCount: number;
  /** The round's targets, in the order it presented them. */
  itemIds: string[];
  correct: number;
  wrong: number;
  /** Targets marked wrong, in the order the round presented them. */
  missed: string[];
  /** How many of the round's items it has got past (marked, or for a practice type without marks, moved on from). */
  reached: number;
  /** All of the round's items have been marked. False for a round still going, or left half done. */
  finished: boolean;
}

export interface AttemptSummary {
  id: string;
  startedAt: string;
  status: SessionStatus;
  /** Null until round 1 is over. */
  firstTry: Score | null;
  /** Rounds played so far (the rounds to complete, once the attempt is completed). */
  roundCount: number;
  rounds: RoundSummary[];
}

export interface TrickyItem {
  target: string;
  /** Total wrong marks across all attempts. */
  wrong: number;
}

export const TRICKIEST_LIMIT = 10;

/** One learner's progress on one list (a lesson's items for one practice type). */
export interface ListProgress {
  /** Every attempt (completed, in progress and stopped), newest first. */
  attempts: AttemptSummary[];
  attemptCount: number;
  /** The best first-try score among completed attempts, or null when none has completed. */
  best: Score | null;
  /** First-try correct counts of completed attempts, oldest first. */
  trend: number[];
  /** Top items by total wrong marks (at most TRICKIEST_LIMIT), most first. */
  trickiest: TrickyItem[];
}

function summarizeRound(round: Round): RoundSummary {
  const { correct, wrong } = markCounts(round);
  return {
    index: round.index,
    itemCount: round.itemIds.length,
    itemIds: round.itemIds,
    correct,
    wrong,
    missed: round.itemIds.filter((target) => round.marks[target] === 'wrong'),
    reached: Math.min(round.position, round.itemIds.length),
    finished: isRoundOver(round),
  };
}

export function summarizeAttempt(session: Session): AttemptSummary {
  const rounds = session.rounds.map(summarizeRound);
  const first = rounds[0];
  return {
    id: session.id,
    startedAt: session.startedAt,
    status: session.status,
    firstTry: first?.finished ? { correct: first.correct, total: first.itemCount } : null,
    roundCount: rounds.length,
    rounds,
  };
}

/**
 * Progress for one learner on one list. `listedTargets` are the targets the list has now, in list order: they
 * order items with equal counts in the trickiest ranking (items the list no longer has come last).
 */
export function listProgress(sessions: readonly Session[], listedTargets: readonly string[]): ListProgress {
  const attempts = sessions
    .map(summarizeAttempt)
    .sort((x, y) => y.startedAt.localeCompare(x.startedAt));
  const completed = attempts.filter((a) => a.status === 'completed' && a.firstTry !== null).reverse();
  return {
    attempts,
    attemptCount: attempts.length,
    best: bestScore(completed.map((a) => a.firstTry!)),
    trend: completed.map((a) => a.firstTry!.correct),
    trickiest: trickiest(attempts, listedTargets),
  };
}

/** The highest share correct (the list may have grown between attempts); a later attempt wins a tie. */
function bestScore(scoresOldestFirst: Score[]): Score | null {
  let best: Score | null = null;
  for (const score of scoresOldestFirst) {
    if (best === null || score.correct * best.total >= best.correct * score.total) best = score;
  }
  return best;
}

function trickiest(attempts: readonly AttemptSummary[], listedTargets: readonly string[]): TrickyItem[] {
  const totals = new Map<string, number>();
  for (const attempt of attempts) {
    for (const round of attempt.rounds) {
      for (const target of round.missed) totals.set(target, (totals.get(target) ?? 0) + 1);
    }
  }
  const place = (target: string): number => {
    const at = listedTargets.indexOf(target);
    return at === -1 ? Number.POSITIVE_INFINITY : at;
  };
  return [...totals]
    .map(([target, wrong]) => ({ target, wrong }))
    .sort((x, y) => y.wrong - x.wrong || place(x.target) - place(y.target) || x.target.localeCompare(y.target))
    .slice(0, TRICKIEST_LIMIT);
}
