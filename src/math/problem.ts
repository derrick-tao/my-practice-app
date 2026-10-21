// What a math session saves for its problems and the learner's tries. Plain JSON, persisted as is inside a round
// (see practice/session.ts); every math practice type uses these two shapes.

/**
 * One generated problem. `kind` names the sort of problem within its practice type ("add-across-ten") and is what
 * a retry round keeps; `numbers` are the problem's numbers in the order the practice type reads them. A practice
 * type that needs more (a blank's position, a story's names) adds optional fields here.
 */
export interface Problem {
  kind: string;
  numbers: number[];
  /** Word problems: who the story is about, the second person if it has one, and the object (one emoji). */
  name?: string;
  friend?: string;
  object?: string;
}

/** One answer the learner submitted for a problem. */
export interface Try {
  /** What was typed on the number pad (digits). */
  answer: string;
  correct: boolean;
}

/** A problem has two tries: the second comes after a wrong first. */
export const MAX_TRIES = 2;
