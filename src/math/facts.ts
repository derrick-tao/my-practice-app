// Facts: add and subtract within 20 (or up to 100) with quick recall. Four kinds, half within 10 and half across a
// ten, for each of the lesson's operations.
import type { Problem } from './problem.ts';
import type { Rules } from './rules.ts';
import type { MathPracticeType } from './types.ts';
import { MINUS, range } from './util.ts';

type FactsKind = 'add-within-10' | 'add-across-ten' | 'subtract-within-10' | 'subtract-across-ten';
const KINDS_BY_OPERATION: Record<'add' | 'subtract', [FactsKind, FactsKind]> = {
  add: ['add-within-10', 'add-across-ten'],
  subtract: ['subtract-within-10', 'subtract-across-ten'],
};

const isSubtract = (kind: string): boolean => kind.startsWith('subtract');
const problem = (kind: string, a: number, b: number): Problem => ({ kind, numbers: [a, b] });

function pool(kind: string, rules: Rules): Problem[] {
  const { within } = rules;
  switch (kind as FactsKind) {
    case 'add-within-10':
      return range(1, 9).flatMap((a) => range(1, 10 - a).map((b) => problem(kind, a, b)));
    case 'add-across-ten':
      // The units add up to more than ten: 8 + 6, 18 + 5.
      return range(2, within - 1)
        .filter((a) => a % 10 >= 2)
        .flatMap((a) => range(1, 9).filter((b) => (a % 10) + b > 10 && a + b <= within).map((b) => problem(kind, a, b)));
    case 'subtract-within-10':
      return range(2, 10).flatMap((a) => range(1, a - 1).map((b) => problem(kind, a, b)));
    case 'subtract-across-ten':
      // Takes away more than the units, so it borrows from the ten: 13 − 4, 22 − 7.
      return range(11, within)
        .filter((a) => a % 10 >= 1 && a % 10 <= 8)
        .flatMap((a) => range((a % 10) + 1, 9).map((b) => problem(kind, a, b)));
  }
  return [];
}

const sum = ([a, b]: number[]): number => a! + b!;

export const facts: MathPracticeType = {
  kinds: (rules) => rules.operations.flatMap((operation) => KINDS_BY_OPERATION[operation]),
  pool,
  key: (p) => (isSubtract(p.kind) ? `${p.kind}:${p.numbers.join(',')}` : `${p.kind}:${[...p.numbers].sort((x, y) => x - y).join(',')}`),
  equation: (p) => `${p.numbers[0]} ${isSubtract(p.kind) ? MINUS : '+'} ${p.numbers[1]} =`,
  answer: (p) => (isSubtract(p.kind) ? p.numbers[0]! - p.numbers[1]! : sum(p.numbers)),
  strategy(p) {
    const [a, b] = p.numbers as [number, number];
    const units = a % 10;
    switch (p.kind as FactsKind) {
      case 'add-across-ten': {
        // Make the next ten first, then add the rest.
        const toTen = 10 - units;
        return `${a} + ${b} = ${a} + ${toTen} + ${b - toTen} = ${a + b}`;
      }
      case 'subtract-across-ten':
        // Take away the units to land on the ten, then the rest.
        return `${a} ${MINUS} ${b} = ${a} ${MINUS} ${units} ${MINUS} ${b - units} = ${a - b}`;
      case 'subtract-within-10':
        return `${a} ${MINUS} ${b} = ${a - b} because ${b} + ${a - b} = ${a}`;
      case 'add-within-10': {
        // Count on from the bigger number.
        const big = Math.max(a, b);
        const small = Math.min(a, b);
        return small === 1 ? `${a} + ${b} = ${a + b}` : `${a} + ${b} = ${big} + ${Array(small).fill('1').join(' + ')} = ${a + b}`;
      }
    }
    return '';
  },
};
