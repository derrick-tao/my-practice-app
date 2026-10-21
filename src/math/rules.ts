// The rules a math lesson sets for a practice type. A math lesson holds rules, not items: the problems are
// generated when a session starts (see generate.ts). Shared by the content build (validation, defaults) and the app.

export const OPERATIONS = ['add', 'subtract'] as const;
export type Operation = (typeof OPERATIONS)[number];

export interface Rules {
  /** Sums and minuends stay at or under this number. */
  within: number;
  /** Which operations the problems use (never empty). */
  operations: Operation[];
}

export const DEFAULT_RULES: Rules = { within: 20, operations: ['add', 'subtract'] };

/** Within 10 and across ten both need room, so a lesson goes up from 20 to 100. */
export const MIN_WITHIN = 20;
export const MAX_WITHIN = 100;

/** The sizes a math session can have ("Problems per practice"), and the one a profile starts with. */
export const PROBLEM_COUNTS = [10, 15, 20] as const;
export type ProblemCount = (typeof PROBLEM_COUNTS)[number];
export const DEFAULT_PROBLEM_COUNT: ProblemCount = 20;

export const isOperation = (value: unknown): value is Operation => (OPERATIONS as readonly unknown[]).includes(value);

/** The rules in words for a grown-up: "within 20 · adding and subtracting". */
export function rulesSummary(rules: Rules): string {
  const words = rules.operations.map((operation) => (operation === 'add' ? 'adding' : 'subtracting'));
  return `within ${rules.within} · ${words.join(' and ')}`;
}
