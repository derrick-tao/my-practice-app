// Generating a math session's problems from a lesson's rules. Pure apart from the injected random source, so a
// seeded source (the e2e build) gives the same problems every time.
import { shuffled, type RandomSource } from '../practice/random.ts';
import type { Problem } from './problem.ts';
import type { Rules } from './rules.ts';
import { SESSION_SIZE } from './rules.ts';
import type { MathPracticeType } from './types.ts';

/**
 * `count` problems: spread evenly over the kinds the rules allow (any remainder goes to randomly chosen kinds),
 * in random order, with no problem twice. Within a kind the problems are sampled from its whole pool.
 */
export function generateProblems(type: MathPracticeType, rules: Rules, random: RandomSource, count = SESSION_SIZE): Problem[] {
  const kinds = type.kinds(rules);
  const extra = new Set(shuffled(kinds, random).slice(0, count % kinds.length));
  const chosen: Problem[] = [];
  const used = new Set<string>();
  for (const kind of kinds) {
    const share = Math.floor(count / kinds.length) + (extra.has(kind) ? 1 : 0);
    for (const problem of sample(type, rules, kind, share, used, random)) {
      used.add(type.key(problem));
      chosen.push(problem);
    }
  }
  return shuffled(chosen, random);
}

/** A new problem of the same kind for a retry round: one the session has not used (`used` holds their keys) while the pool lasts. */
export function generateReplacement(type: MathPracticeType, rules: Rules, kind: string, used: ReadonlySet<string>, random: RandomSource): Problem {
  return sample(type, rules, kind, 1, used, random)[0]!;
}

/** `count` distinct problems of a kind, preferring ones not in `used`; repeats only if the pool is smaller than the need. */
function sample(type: MathPracticeType, rules: Rules, kind: string, count: number, used: ReadonlySet<string>, random: RandomSource): Problem[] {
  const seen = new Set<string>();
  const distinct = shuffled(type.pool(kind, rules), random).filter((problem) => {
    const key = type.key(problem);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const fresh = distinct.filter((problem) => !used.has(type.key(problem)));
  const rest = distinct.filter((problem) => used.has(type.key(problem)));
  const picked = [...fresh, ...rest].slice(0, count);
  // A pool smaller than the need (never so for the shipped rules) cycles rather than failing.
  while (picked.length < count) picked.push(picked[picked.length % Math.max(1, picked.length)] ?? distinct[0]!);
  return picked;
}
