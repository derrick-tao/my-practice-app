// True or false: is the equal sign telling the truth? The child sees an equation such as `7 = 8 − 1` and taps True or
// False. Four kinds: the same number (`6 = 6`), the answer on the left (`7 = 8 − 1`), swapped order
// (`5 + 2 = 2 + 5`) and two sums (`4 + 3 = 5 + 2`). About half the problems are true; a false one is off by 1 or 2.
//
// How the numbers are saved (a problem's `numbers`):
//   same-number    [left, right]                 left = right
//   answer-left    [left, a, b]                  left = a + b, where a negative b is a subtraction: [7, 8, -1] is 7 = 8 − 1
//   swapped        [a, b, c, d]                  a + b = c + d, the right side being b and a in the other order (a true one)
//   two-sums       [a, b, c, d]                  a + b = c + d
// Whether the equation is true is read from the numbers (the two sides are equal), never saved separately.
import type { Problem } from './problem.ts';
import type { Rules } from './rules.ts';
import type { MathPracticeType } from './types.ts';
import { MINUS, range } from './util.ts';

type TrueOrFalseKind = 'same-number' | 'answer-left' | 'swapped' | 'two-sums';

/** The values of the equation's left and right sides. */
function sides(p: Problem): [number, number] {
  const [a = 0, b = 0, c = 0, d = 0] = p.numbers;
  switch (p.kind as TrueOrFalseKind) {
    case 'same-number':
      return [a, b];
    case 'answer-left':
      return [a, b + c];
    case 'swapped':
    case 'two-sums':
      return [a + b, c + d];
  }
  return [0, 0];
}

const isTrue = (p: Problem): boolean => sides(p)[0] === sides(p)[1];

/** A false equation is off by 1 or 2, either way. */
const OFF_BY = [-2, -1, 1, 2];
const SHIFTS = [-3, -2, -1, 1, 2, 3];
const problem = (kind: TrueOrFalseKind, ...numbers: number[]): Problem => ({ kind, numbers });

/**
 * Whether the pair (a, b) is in the pool. Within 20 every pair is; within 100 there would be a quarter of a million
 * problems to sort at the start of a session, so a steady one in every few pairs is kept (the same ones every time).
 */
const kept = (within: number, a: number, b: number): boolean => {
  const stride = Math.max(1, Math.round((within / 20) ** 2));
  return (a * 13 + b) % stride === 0;
};

/** Every `a + b` with both at least 1 and a sum of at most `within`. */
const sumPairs = (within: number): Array<[number, number]> =>
  range(1, within - 1).flatMap((a) => range(1, within - a).filter((b) => kept(within, a, b)).map((b): [number, number] => [a, b]));

function pool(kind: string, rules: Rules): Problem[] {
  const { within } = rules;
  const adds = rules.operations.includes('add');
  const subtracts = rules.operations.includes('subtract');
  switch (kind as TrueOrFalseKind) {
    case 'same-number':
      return range(1, within).flatMap((n) => [
        problem('same-number', n, n),
        ...OFF_BY.filter((off) => n + off >= 1 && n + off <= within).map((off) => problem('same-number', n, n + off)),
      ]);
    case 'answer-left': {
      // The right side is a sum or a difference; the left side is its value (true) or off by 1 or 2 (false).
      const rightSides = [
        ...(adds ? sumPairs(within).map(([a, b]) => [a, b] as const) : []),
        ...(subtracts ? range(2, within).flatMap((a) => range(1, a - 1).filter((b) => kept(within, a, b)).map((b) => [a, -b] as const)) : []),
      ];
      return rightSides.flatMap(([a, b]) => {
        const value = a + b;
        return [0, ...OFF_BY].filter((off) => value + off >= 1 && value + off <= within).map((off) => problem('answer-left', value + off, a, b));
      });
    }
    case 'swapped':
      // `a + b` against `b + a` (true), or with one of the two numbers changed so the sums differ by 1 or 2.
      return sumPairs(within)
        .filter(([a, b]) => a !== b)
        .flatMap(([a, b]) => [
          problem('swapped', a, b, b, a),
          ...OFF_BY.filter((off) => a + off >= 1 && a + b + off <= within).map((off) => problem('swapped', a, b, b, a + off)),
          ...OFF_BY.filter((off) => b + off >= 1 && a + b + off <= within).map((off) => problem('swapped', a, b, b + off, a)),
        ]);
    case 'two-sums':
      // `a + b` against another pair whose sum is the same (true) or 1 or 2 away (false): 4 + 3 = 5 + 2, 4 + 3 = 5 + 3.
      return sumPairs(within).flatMap(([a, b]) =>
        SHIFTS.flatMap((shift) =>
          [0, ...OFF_BY]
            .map((off) => problem('two-sums', a, b, a + shift, b - shift + off))
            // Both numbers stay in range, and nothing that reads as the swapped kind (`b + a`, or `b` first, or `a` last).
            .filter(({ numbers: [, , c = 0, d = 0] }) => c >= 1 && d >= 1 && c + d <= within && c !== b && d !== a),
        ),
      );
  }
  return [];
}

const sumText = (x: number, y: number): string => `${x} + ${y}`;

/** "8 − 1" or "3 + 4" for `[a, b]` with a signed b. */
const termText = (a: number, b: number): string => (b < 0 ? `${a} ${MINUS} ${-b}` : `${a} + ${b}`);

function sideTexts(p: Problem): [string, string] {
  const [a = 0, b = 0, c = 0, d = 0] = p.numbers;
  switch (p.kind as TrueOrFalseKind) {
    case 'same-number':
      return [String(a), String(b)];
    case 'answer-left':
      return [String(a), termText(b, c)];
    default:
      return [sumText(a, b), sumText(c, d)];
  }
}

export const trueOrFalse: MathPracticeType = {
  input: 'true-false',
  kinds: (rules) => (rules.operations.includes('add') ? ['same-number', 'answer-left', 'swapped', 'two-sums'] : ['same-number', 'answer-left']),
  pool,
  // Half true, half false in each kind (a session's problems of a kind alternate between the two).
  groupOf: (p) => (isTrue(p) ? 'true' : 'false'),
  key(p) {
    const [a = 0, b = 0, c = 0, d = 0] = p.numbers;
    const pair = (x: number, y: number): string => `${Math.min(x, y)},${Math.max(x, y)}`;
    switch (p.kind as TrueOrFalseKind) {
      case 'answer-left':
        // 7 = 3 + 4 and 7 = 4 + 3 are one problem; 7 = 8 − 1 has no twin.
        return `${p.kind}:${a}=${b >= 0 && c >= 0 ? pair(b, c) : `${b},${c}`}`;
      case 'swapped':
      case 'two-sums':
        return `${p.kind}:${[pair(a, b), pair(c, d)].sort().join('=')}`;
      default:
        // 6 = 7 and 7 = 6 are one problem.
        return `${p.kind}:${pair(a, b)}`;
    }
  },
  equation(p) {
    const [left, right] = sideTexts(p);
    return `${left} = ${right}`;
  },
  // 1 for true, 0 for false (the learner taps True or False).
  answer: (p) => (isTrue(p) ? 1 : 0),
  strategy(p) {
    const [left, right] = sides(p);
    const [leftText, rightText] = sideTexts(p);
    // A side that is a single number needs no working out.
    const work = (text: string, value: number): string => (/^\d+$/.test(text) ? text : `${text} = ${value}`);
    const verdict = left === right ? `Both are ${left}, so it is true.` : `${left} is not ${right}, so it is false.`;
    return `Left: ${work(leftText, left)}. Right: ${work(rightText, right)}. ${verdict}`;
  },
};
