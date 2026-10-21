// Word problems ("Stories"): short stories for adding to, taking from, putting together, taking apart and comparing,
// with the unknown in every position except "both parts unknown" (which has many right answers). Eleven kinds, spread
// evenly over a session. The numbers are the pool's; the name, friend and object are picked at random when a problem is
// made (`decorate`) and saved with it, so a resumed story reads exactly the same.
//
// Every kind is one triple x + y = z, told differently. `numbers` is [x, y, z]; the kind says which two the story gives
// and which one the child finds (SHOWN and ANSWER below).
import type { RandomSource } from '../practice/random.ts';
import type { Problem } from './problem.ts';
import type { Operation, Rules } from './rules.ts';
import type { MathPracticeType } from './types.ts';
import { MINUS } from './util.ts';

type StoryKind =
  | 'add-result'
  | 'add-change'
  | 'add-start'
  | 'together-total'
  | 'compare-bigger'
  | 'take-result'
  | 'take-change'
  | 'take-start'
  | 'apart-part'
  | 'compare-difference'
  | 'compare-smaller';

/**
 * The kinds per operation: a story is an adding one when its equation adds (the child may still find a part by taking
 * away: "8 and some more make 11"), and a subtracting one when it takes away or finds a difference.
 */
const KINDS_BY_OPERATION: Record<Operation, StoryKind[]> = {
  add: ['add-result', 'add-change', 'add-start', 'together-total', 'compare-bigger'],
  subtract: ['take-result', 'take-change', 'take-start', 'apart-part', 'compare-difference', 'compare-smaller'],
};

/** Which of [x, y, z] the story tells, in reading order. */
const SHOWN: Record<StoryKind, [number, number]> = {
  'add-result': [0, 1],
  'add-change': [0, 2],
  'add-start': [1, 2],
  'together-total': [0, 1],
  'compare-bigger': [0, 1],
  'take-result': [2, 1],
  'take-change': [2, 0],
  'take-start': [1, 0],
  'apart-part': [2, 0],
  'compare-difference': [2, 0],
  'compare-smaller': [2, 1],
};

/** Which of [x, y, z] the child finds. */
const ANSWER: Record<StoryKind, number> = {
  'add-result': 2,
  'add-change': 1,
  'add-start': 0,
  'together-total': 2,
  'compare-bigger': 2,
  'take-result': 0,
  'take-change': 1,
  'take-start': 2,
  'apart-part': 1,
  'compare-difference': 1,
  'compare-smaller': 0,
};

/** Kinds that need a second person. */
const NEEDS_FRIEND: ReadonlySet<string> = new Set(['together-total', 'compare-bigger', 'compare-difference', 'compare-smaller']);

const GIRLS = ['Mia', 'Ava', 'Zoe', 'Ella', 'Lily', 'Ruby'];
const BOYS = ['Leo', 'Sam', 'Max', 'Noah', 'Ben', 'Jack'];
const NAMES = [...GIRLS, ...BOYS];
/** Things a child can have a few of, give away or put in a box. Each is one emoji, so a story and its pictures agree. */
const OBJECTS = ['🍎', '🍪', '🎈', '🍓', '⭐', '🚗', '🧸', '🍌', '⚽', '🍩'];

/** Pictures show up to this many; larger numbers are digits only. */
const MAX_PICTURED = 10;
const LEAST_PART = 2;
/** The picture fallback and the stand-ins for a problem saved without its cast (never made by the app). */
const FALLBACK = { name: 'Mia', friend: 'Leo', object: '⭐' };

const pick = <T>(items: readonly T[], random: RandomSource): T => items[Math.floor(random() * items.length)]!;

const isStoryKind = (kind: string): kind is StoryKind => kind in SHOWN;

function pool(kind: string, rules: Rules): Problem[] {
  const problems: Problem[] = [];
  for (let x = LEAST_PART; x <= rules.within - LEAST_PART; x++) {
    for (let y = LEAST_PART; x + y <= rules.within; y++) problems.push({ kind, numbers: [x, y, x + y] });
  }
  return problems;
}

/** The people and the object a story is told with. */
function cast(problem: Problem): { name: string; friend: string; object: string; She: string; she: string } {
  const name = problem.name ?? FALLBACK.name;
  const girl = !BOYS.includes(name);
  return {
    name,
    friend: problem.friend ?? FALLBACK.friend,
    object: problem.object ?? FALLBACK.object,
    She: girl ? 'She' : 'He',
    she: girl ? 'she' : 'he',
  };
}

function story(problem: Problem): string {
  const [x, y, z] = problem.numbers as [number, number, number];
  const { name: N, friend: F, object: O, She, she } = cast(problem);
  switch (problem.kind as StoryKind) {
    case 'add-result':
      return `${N} has ${x} ${O}. ${She} gets ${y} more. How many ${O} does ${she} have now?`;
    case 'add-change':
      return `${N} has ${x} ${O}. ${She} gets some more. Now ${she} has ${z} ${O}. How many did ${she} get?`;
    case 'add-start':
      return `${N} has some ${O}. ${She} gets ${y} more. Now ${she} has ${z} ${O}. How many did ${she} have at first?`;
    case 'take-result':
      return `${N} has ${z} ${O}. ${She} gives ${y} away. How many ${O} does ${she} have left?`;
    case 'take-change':
      return `${N} has ${z} ${O}. ${She} gives some away. Now ${she} has ${x} ${O} left. How many did ${she} give away?`;
    case 'take-start':
      return `${N} has some ${O}. ${She} gives ${y} away. Now ${she} has ${x} ${O} left. How many did ${she} have at first?`;
    case 'together-total':
      return `${N} has ${x} ${O}. ${F} has ${y} ${O}. How many ${O} do they have in all?`;
    case 'apart-part':
      return `${N} has ${z} ${O}. ${She} puts ${x} in a box and the rest in a bag. How many ${O} are in the bag?`;
    case 'compare-difference':
      return `${N} has ${z} ${O}. ${F} has ${x} ${O}. How many more ${O} does ${N} have than ${F}?`;
    case 'compare-bigger':
      return `${F} has ${x} ${O}. ${N} has ${y} more ${O} than ${F}. How many ${O} does ${N} have?`;
    case 'compare-smaller':
      return `${N} has ${z} ${O}. That is ${y} more than ${F} has. How many ${O} does ${F} have?`;
  }
  return '';
}

export const wordProblems: MathPracticeType = {
  kinds: (rules) => rules.operations.flatMap((operation) => KINDS_BY_OPERATION[operation]),
  pool,
  // Who and what the story is about does not make a different problem; "Mia 6, Leo 7" and "Mia 7, Leo 6" do not either.
  key: (p) => `${p.kind}:${(p.kind === 'together-total' ? [...p.numbers].sort((a, b) => a - b) : p.numbers).join(',')}`,
  decorate(problem, random) {
    const name = pick(NAMES, random);
    const friend = NEEDS_FRIEND.has(problem.kind) ? pick(NAMES.filter((other) => other !== name), random) : undefined;
    return { ...problem, name, ...(friend !== undefined && { friend }), object: pick(OBJECTS, random) };
  },
  equation: story,
  pictures(problem) {
    if (!isStoryKind(problem.kind)) return [];
    const { object } = cast(problem);
    return SHOWN[problem.kind].map((i) => problem.numbers[i]!).filter((count) => count <= MAX_PICTURED).map((count) => object.repeat(count));
  },
  answer: (p) => p.numbers[ANSWER[p.kind as StoryKind]]!,
  strategy(problem) {
    const [x, y, z] = problem.numbers as [number, number, number];
    const kind = problem.kind as StoryKind;
    // The equation the story is about, with the answer in place; stories that ask for a part show the unknown first.
    switch (kind) {
      case 'add-change':
        return `${x} + ? = ${z}, so ${x} + ${y} = ${z}`;
      case 'add-start':
        return `? + ${y} = ${z}, so ${x} + ${y} = ${z}`;
      case 'take-change':
        return `${z} ${MINUS} ? = ${x}, so ${z} ${MINUS} ${y} = ${x}`;
      case 'take-start':
        return `? ${MINUS} ${y} = ${x}, so ${z} ${MINUS} ${y} = ${x}`;
      case 'apart-part':
      case 'compare-difference':
        return `${z} ${MINUS} ${x} = ${y}`;
      case 'take-result':
      case 'compare-smaller':
        return `${z} ${MINUS} ${y} = ${x}`;
      default:
        return `${x} + ${y} = ${z}`;
    }
  },
};
