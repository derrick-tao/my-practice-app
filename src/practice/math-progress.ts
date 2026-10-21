// What the parent's Progress page shows for a math list, beyond the numbers every list has (progress.ts): the
// problem kinds that went wrong most, and the problems missed in a round with what the child entered. Pure:
// sessions in, numbers out. Reads only the Problem/Try shapes saved in a round, so it holds for every math practice type.
import type { RulesTypeId } from '../content/types.ts';
import { MATH_TYPES } from '../math/index.ts';
import type { Problem, Try } from '../math/problem.ts';
import { DEFAULT_RULES, type Rules } from '../math/rules.ts';
import type { Round, Session } from './session.ts';

export interface KindTally {
  kind: string;
  /** Problems of this kind marked ❌, across every attempt and round. */
  wrong: number;
  /** Problems of this kind that have been marked either way, across every attempt and round. */
  total: number;
}

export const TRICKIEST_KINDS_LIMIT = 10;

/**
 * Problem kinds with at least one ❌, most ❌ first. Of equal counts the kind with fewer problems (so the higher share
 * wrong) comes first, then the order the rules list the kinds in (kinds the rules no longer allow come last).
 * A problem counts once it is marked, so one still waiting in an unfinished attempt does not.
 */
export function trickiestKinds(sessions: readonly Session[], typeId: RulesTypeId, rules: Rules = DEFAULT_RULES): KindTally[] {
  const totals = new Map<string, KindTally>();
  for (const session of sessions) {
    for (const round of session.rounds) {
      for (const [spot, problem] of Object.entries(round.problems ?? {})) {
        const mark = round.marks[spot];
        if (mark === undefined) continue;
        const tally = totals.get(problem.kind) ?? { kind: problem.kind, wrong: 0, total: 0 };
        tally.total += 1;
        if (mark === 'wrong') tally.wrong += 1;
        totals.set(problem.kind, tally);
      }
    }
  }
  const order = MATH_TYPES[typeId].kinds(rules);
  const place = (kind: string): number => {
    const at = order.indexOf(kind);
    return at === -1 ? Number.POSITIVE_INFINITY : at;
  };
  return [...totals.values()]
    .filter((tally) => tally.wrong > 0)
    .sort((x, y) => y.wrong - x.wrong || x.total - y.total || place(x.kind) - place(y.kind) || x.kind.localeCompare(y.kind))
    .slice(0, TRICKIEST_KINDS_LIMIT);
}

export interface MissedProblem {
  /** The numbered spot in the round ("7"). */
  spot: string;
  /** The problem at that spot, if the round saved one. */
  problem: Problem | undefined;
  /** The answers the child entered, in order. */
  tries: Try[];
}

/** The round's ❌ spots in the order the round presented them, each with its problem and the child's tries. */
export function missedProblems(round: Round): MissedProblem[] {
  return round.itemIds
    .filter((spot) => round.marks[spot] === 'wrong')
    .map((spot) => ({ spot, problem: round.problems?.[spot], tries: round.tries?.[spot] ?? [] }));
}

/**
 * "answered 8", or "answered 8, then 9" after a second try; nothing when no try was saved. A multi-step problem gives
 * each step's answers on their own: "step 1: answered 2; step 2: answered 4, then 5".
 */
export function enteredAnswers(tries: readonly Try[]): string {
  if (tries.length === 0) return '';
  const list = (of: readonly Try[]): string => `answered ${of.map((t) => t.answer).join(', then ')}`;
  if (!tries.some((t) => t.step !== undefined)) return list(tries);
  const steps = [...new Set(tries.map((t) => t.step ?? 0))].sort((x, y) => x - y);
  return steps.map((step) => `step ${step + 1}: ${list(tries.filter((t) => (t.step ?? 0) === step))}`).join('; ');
}
