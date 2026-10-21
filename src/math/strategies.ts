// Strategies: guided steps through a trick for adding and subtracting, one blank at a time (1.OA.3, 1.OA.5 and the
// strategy part of 1.OA.6). Seven kinds, taken from the school's own examples: swap the order, make ten with three
// numbers, count on, make ten, break down to ten, a related fact and near doubles. A problem is a few lines, each
// with one blank; the learner fills them in order, so the earlier lines (with their answers) are the worked trick.
import type { Problem } from './problem.ts';
import type { Rules } from './rules.ts';
import type { MathPracticeType, Step } from './types.ts';
import { MINUS, range } from './util.ts';

const ARROW = '→';

type StrategyKind = 'swap-order' | 'make-ten-three' | 'count-on' | 'make-ten' | 'break-down-to-ten' | 'related-fact' | 'near-doubles';

const ADD_KINDS: StrategyKind[] = ['swap-order', 'make-ten-three', 'count-on', 'make-ten', 'near-doubles'];
const SUBTRACT_KINDS: StrategyKind[] = ['break-down-to-ten'];
/** A related fact adds (8 + 4 = 12) and then subtracts (12 − 8), so a lesson needs both operations to ask it. */
const BOTH_KINDS: StrategyKind[] = ['related-fact'];

const problem = (kind: string, ...numbers: number[]): Problem => ({ kind, numbers });

function pool(kind: string, rules: Rules): Problem[] {
  const { within } = rules;
  switch (kind as StrategyKind) {
    case 'swap-order':
      // 8 + 3 = 11, so 3 + 8: two different single-digit numbers.
      return range(2, 9).flatMap((a) => range(2, 9).filter((b) => b !== a && a + b <= within).map((b) => problem(kind, a, b)));
    case 'make-ten-three':
      // 2 + 6 + 4: the last two make ten.
      return range(1, 9).flatMap((a) => range(1, 9).filter(() => a + 10 <= within).map((b) => problem(kind, a, b, 10 - b)));
    case 'count-on':
      return [2, 3].flatMap((n) => range(3, Math.min(within - n, 18)).map((a) => problem(kind, a, n)));
    case 'make-ten':
      // 8 + 6: 8 needs 2 to make ten, and 6 has more than 2 in it. Works from any ten (18 + 5).
      return range(2, within - 1)
        .filter((a) => a % 10 >= 2)
        .flatMap((a) => range(10 - (a % 10) + 1, 9).filter((b) => a + b <= within).map((b) => problem(kind, a, b)));
    case 'near-doubles':
      // 6 + 7 (or 7 + 6): a double and one more.
      return range(3, Math.min(9, Math.floor((within - 1) / 2))).flatMap((small) => [problem(kind, small, small + 1), problem(kind, small + 1, small)]);
    case 'break-down-to-ten':
      // 13 − 4: take away the 3 to reach ten, then the rest of the 4.
      return range(11, within)
        .filter((a) => a % 10 >= 1 && a % 10 <= 8)
        .flatMap((a) => range((a % 10) + 1, 9).map((b) => problem(kind, a, b)));
    case 'related-fact':
      // 8 + 4 = 12, so 12 − 8 = 4.
      return range(2, 9).flatMap((a) => range(2, 9).filter((b) => a + b <= within).map((b) => problem(kind, a, b)));
  }
  return [];
}

/** The lines of a problem, one blank each, in the order the learner fills them. */
function steps(p: Problem): Step[] {
  const [a, b, c] = p.numbers as [number, number, number];
  switch (p.kind as StrategyKind) {
    case 'swap-order': {
      const sum = a + b;
      return [
        { before: `${a} + ${b} = `, after: '', answer: sum, explanation: `Add them: ${a} + ${b} = ${sum}` },
        { before: `So ${b} + ${a} = `, after: '', answer: sum, explanation: `Adding in any order gives the same answer: ${b} + ${a} = ${sum}` },
      ];
    }
    case 'make-ten-three':
      return [
        { before: `${a} + ${b} + ${c} = ${a} + `, after: '', answer: 10, explanation: `${b} + ${c} makes a ten` },
        { before: `${a} + 10 = `, after: '', answer: a + 10, explanation: `Now add the ten: ${a} + 10 = ${a + 10}` },
      ];
    case 'count-on':
      return range(0, b - 1).map((i) => ({
        before: `${a + i} ${ARROW} `,
        after: '',
        answer: a + i + 1,
        explanation: `Count on 1 from ${a + i}: ${a + i + 1}`,
      }));
    case 'make-ten': {
      const toTen = 10 - (a % 10);
      const ten = a + toTen;
      const rest = b - toTen;
      return [
        { before: `${a} + `, after: ` = ${ten}`, answer: toTen, explanation: `${a} + ${toTen} = ${ten}: add ${toTen} to make a ten` },
        { before: `${b} = ${toTen} + `, after: '', answer: rest, explanation: `${b} = ${toTen} + ${rest}: split off ${toTen} and keep ${rest}` },
        { before: `${ten} + ${rest} = `, after: '', answer: a + b, explanation: `Now add the rest: ${ten} + ${rest} = ${a + b}` },
      ];
    }
    case 'break-down-to-ten': {
      const units = a % 10;
      const ten = a - units;
      const rest = b - units;
      return [
        { before: `${a} ${MINUS} `, after: ` = ${ten}`, answer: units, explanation: `${a} ${MINUS} ${units} = ${ten}: take away ${units} to reach a ten` },
        { before: `${b} = ${units} + `, after: '', answer: rest, explanation: `${b} = ${units} + ${rest}: ${units} is gone, ${rest} left to take away` },
        { before: `${ten} ${MINUS} ${rest} = `, after: '', answer: a - b, explanation: `Now take away the rest: ${ten} ${MINUS} ${rest} = ${a - b}` },
      ];
    }
    case 'related-fact': {
      const sum = a + b;
      return [
        { before: `${a} + ${b} = `, after: '', answer: sum, explanation: `Add them: ${a} + ${b} = ${sum}` },
        { before: `So ${sum} ${MINUS} ${a} = `, after: '', answer: b, explanation: `${a} + ${b} = ${sum}, so ${sum} ${MINUS} ${a} = ${b}` },
      ];
    }
    case 'near-doubles': {
      const small = Math.min(a, b);
      const big = Math.max(a, b);
      return [
        { before: `${big} = ${small} + `, after: '', answer: 1, explanation: `${big} is ${small} and 1 more` },
        { before: `${small} + ${small} = `, after: '', answer: small * 2, explanation: `${small} + ${small} is a double: ${small * 2}` },
        { before: `${small * 2} + 1 = `, after: '', answer: a + b, explanation: `Add the 1 more: ${small * 2} + 1 = ${a + b}` },
      ];
    }
  }
  return [];
}

/** The line above the steps, when the problem has one: "7, count on 2" or "8 + 6". */
function given(p: Problem): string {
  const [a, b] = p.numbers as [number, number];
  switch (p.kind as StrategyKind) {
    case 'count-on':
      return `${a}, count on ${b}`;
    case 'make-ten':
    case 'near-doubles':
      return `${a} + ${b}`;
    case 'break-down-to-ten':
      return `${a} ${MINUS} ${b}`;
    default:
      return '';
  }
}

export const strategies: MathPracticeType = {
  kinds(rules) {
    const adds = rules.operations.includes('add');
    const subtracts = rules.operations.includes('subtract');
    return [...(adds ? ADD_KINDS : []), ...(subtracts ? SUBTRACT_KINDS : []), ...(adds && subtracts ? BOTH_KINDS : [])];
  },
  pool,
  key: (p) => `${p.kind}:${p.numbers.join(',')}`,
  equation: given,
  steps,
  answer: (p) => steps(p).at(-1)!.answer,
  strategy: (p) => steps(p).map((step) => step.explanation).join(' · '),
};
