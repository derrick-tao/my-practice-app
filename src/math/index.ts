// The math practice-type registry: what generates and explains the problems of each rules practice type.
import type { RulesTypeId } from '../content/types.ts';
import { facts } from './facts.ts';
import { missingNumber } from './missing-number.ts';
import { trueOrFalse } from './true-or-false.ts';
import type { MathPracticeType } from './types.ts';

export const MATH_TYPES: Record<RulesTypeId, MathPracticeType> = { facts, 'missing-number': missingNumber, 'true-or-false': trueOrFalse };
