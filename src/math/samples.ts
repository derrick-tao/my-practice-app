// The sample problems the lesson preview shows for a math practice type: drawn the way a session's problems are
// (generate.ts), so each is a problem that type can really ask under the lesson's rules.
import type { RandomSource } from '../practice/random.ts';
import { generateProblems } from './generate.ts';
import type { Problem } from './problem.ts';
import type { Rules } from './rules.ts';
import type { MathPracticeType } from './types.ts';

export const SAMPLE_COUNT = 5;

/** `SAMPLE_COUNT` distinct problems spread over the type's kinds, in random order. */
export const sampleProblems = (type: MathPracticeType, rules: Rules, random: RandomSource): Problem[] =>
  generateProblems(type, rules, random, SAMPLE_COUNT);
