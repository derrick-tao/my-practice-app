// Generating a math session's problems from a lesson's rules. Pure apart from the injected random source, so a
// seeded source (the e2e build) gives the same problems every time.
import { shuffled, type RandomSource } from '../practice/random.ts';
import type { Problem } from './problem.ts';
import type { Rules } from './rules.ts';
import type { MathPracticeType } from './types.ts';

/**
 * `count` problems (the session's size: 10, 15 or 20): spread evenly over the kinds the rules allow (any remainder
 * goes to randomly chosen kinds, shared between a type's halves in turn), in random order, with no problem twice.
 * Within a kind the problems are sampled from its whole pool.
 */
export function generateProblems(type: MathPracticeType, rules: Rules, random: RandomSource, count: number): Problem[] {
  const kinds = type.kinds(rules);
  const extra = new Set(kindsGettingExtra(type, kinds, count % kinds.length, random));
  const chosen: Problem[] = [];
  const used = new Set<string>();
  for (const kind of kinds) {
    const share = Math.floor(count / kinds.length) + (extra.has(kind) ? 1 : 0);
    for (const problem of sample(type, rules, kind, share, used, random)) {
      used.add(type.key(problem));
      chosen.push(decorated(type, problem, random));
    }
  }
  return shuffled(chosen, random);
}

/** The `n` kinds that take one problem more than the rest: random ones, alternating between the type's halves when it has them. */
function kindsGettingExtra(type: MathPracticeType, kinds: string[], n: number, random: RandomSource): string[] {
  const halves = new Map<string, string[]>();
  for (const kind of shuffled(kinds, random)) {
    const half = type.halfOf?.(kind) ?? '';
    halves.set(half, [...(halves.get(half) ?? []), kind]);
  }
  const lists = shuffled([...halves.values()], random);
  const longest = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, i) => lists.flatMap((list) => (i < list.length ? [list[i]!] : []))).flat().slice(0, n);
}

/** A new problem of the same kind for a retry round: one the session has not used (`used` holds their keys) while the pool lasts. */
export function generateReplacement(type: MathPracticeType, rules: Rules, kind: string, used: ReadonlySet<string>, random: RandomSource): Problem {
  return decorated(type, sample(type, rules, kind, 1, used, random)[0]!, random);
}

/** The problem with what the practice type chooses at random (a story's names and object) filled in. */
const decorated = (type: MathPracticeType, problem: Problem, random: RandomSource): Problem => type.decorate?.(problem, random) ?? problem;

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
  const picked = [...balanced(type, fresh, random), ...rest].slice(0, count);
  // A pool smaller than the need (never so for the shipped rules) cycles rather than failing.
  while (picked.length < count) picked.push(picked[picked.length % Math.max(1, picked.length)] ?? distinct[0]!);
  return picked;
}

/** For a type with groups (true, false): the problems taken alternately from each group, starting with a random one. */
function balanced(type: MathPracticeType, problems: Problem[], random: RandomSource): Problem[] {
  if (!type.groupOf) return problems;
  const groups = new Map<string, Problem[]>();
  for (const problem of problems) {
    const name = type.groupOf(problem);
    groups.set(name, [...(groups.get(name) ?? []), problem]);
  }
  const lists = shuffled([...groups.values()], random);
  const longest = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, i) => lists.flatMap((list) => (i < list.length ? [list[i]!] : []))).flat();
}
