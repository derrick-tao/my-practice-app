// Missing number: an equation `a + b = c` or `a − b = c` with one number missing, found on the number pad. Six
// kinds: the blank first, in the middle or at the answer, for adding and for subtracting. Each problem is written
// forwards (`8 + ? = 11`) or backwards (`11 = 8 + ?`, `5 = ☐ − 3`) at random. The kinds with a missing addend
// (`8 + ? = 10`, `10 − 8 = ?`) are subtraction as an unknown-addend problem (1.OA.4), solved by counting up.
import type { Problem } from './problem.ts';
import type { Rules } from './rules.ts';
import type { MathPracticeType } from './types.ts';

const MINUS = '−';

type Blank = 'first' | 'middle' | 'answer';
const BLANKS: Blank[] = ['first', 'middle', 'answer'];
type Operation = 'add' | 'subtract';

/** The kind "add-blank-middle" says what is added and where the blank is. */
const kindOf = (operation: Operation, blank: Blank): string => `${operation}-blank-${blank}`;
const parts = (kind: string): { operation: Operation; blank: Blank } => {
  const [operation, , blank] = kind.split('-') as [Operation, string, Blank];
  return { operation, blank };
};

const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** Every (a, b, c) with a + b = c, or a − b = c, inside the rules: all numbers from 1 up to `within`. */
function equations(operation: Operation, within: number): Array<[number, number, number]> {
  return operation === 'add'
    ? range(1, within - 1).flatMap((a) => range(1, within - a).map((b): [number, number, number] => [a, b, a + b]))
    : range(2, within).flatMap((a) => range(1, a - 1).map((b): [number, number, number] => [a, b, a - b]));
}

function pool(kind: string, rules: Rules): Problem[] {
  const { operation } = parts(kind);
  return equations(operation, rules.within).flatMap(([a, b, c]) => [
    { kind, numbers: [a, b, c] },
    { kind, numbers: [a, b, c], backwards: true },
  ]);
}

const blankIndex = (kind: string): number => BLANKS.indexOf(parts(kind).blank);

/** The equation as text with `mark` standing for the blank. */
function written(problem: Problem, mark: string): string {
  const { operation } = parts(problem.kind);
  const [a, b, c] = problem.numbers.map((n, i) => (i === blankIndex(problem.kind) ? mark : String(n))) as [string, string, string];
  const side = `${a} ${operation === 'add' ? '+' : MINUS} ${b}`;
  return problem.backwards ? `${c} = ${side}` : `${side} = ${c}`;
}

/** ☐ when written backwards (as the school writes `5 = ☐ − 3`), ? otherwise (`8 + ? = 11`). */
const blankGlyph = (problem: Problem): string => (problem.backwards ? '☐' : '?');

/** A marker that cannot be part of an equation, to split the text around the blank. */
const HERE = '\u0000';

const answerOf = (problem: Problem): number => problem.numbers[blankIndex(problem.kind)]!;

export const missingNumber: MathPracticeType = {
  kinds: (rules) => rules.operations.flatMap((operation) => BLANKS.map((blank) => kindOf(operation, blank))),
  pool,
  key(problem) {
    const { operation, blank } = parts(problem.kind);
    const [a, b, c] = problem.numbers as [number, number, number];
    // "3 + 4 = ?" and "4 + 3 = ?" are one problem; and writing a problem backwards does not make a new one.
    const operands = operation === 'add' && blank === 'answer' ? [a, b].sort((x, y) => x - y) : [a, b];
    return `${problem.kind}:${operands.join(',')},${c}`;
  },
  equation: (problem) => written(problem, blankGlyph(problem)),
  frame(problem) {
    const [before = '', after = ''] = written(problem, HERE).split(HERE);
    return { before, after, blank: blankGlyph(problem) };
  },
  answer: answerOf,
  strategy(problem) {
    const [a, b, c] = problem.numbers as [number, number, number];
    const { operation, blank } = parts(problem.kind);
    if (operation === 'add') {
      switch (blank) {
        case 'answer': {
          const big = Math.max(a, b);
          return `Count on ${a + b - big} from ${big}: ${a} + ${b} = ${c}`;
        }
        case 'middle':
          // 8 + ? = 11: how far is it from 8 up to 11?
          return `Count up from ${a} to ${c}: that is ${b} more, so ${a} + ${b} = ${c}`;
        case 'first':
          return `Count up from ${b} to ${c}: that is ${a} more, so ${a} + ${b} = ${c}`;
      }
    }
    switch (blank) {
      case 'answer':
        // 10 − 8 = ?: what makes 10 when added to 8?
        return `Count up from ${b} to ${a}: that is ${c} more, so ${a} ${MINUS} ${b} = ${c}`;
      case 'middle':
        return `Count up from ${c} to ${a}: that is ${b} more, so ${a} ${MINUS} ${b} = ${c}`;
      case 'first':
        return `Start at ${c} and add ${b} back: ${c} + ${b} = ${a}, so ${a} ${MINUS} ${b} = ${c}`;
    }
  },
};
