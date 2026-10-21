// The practice-type registry: everything the app knows about each kind of practice. A kid-facing label and icon
// ("✏️ Write"), the noun for its items ("37 characters"), and the screen that practices it. Being a Record
// keeps every practice type covered: adding an id to PRACTICE_TYPE_IDS fails to compile until it has an entry.
import type { ComponentType } from 'preact';
import { isRulesType, type LessonSummary, type PracticeTypeId } from '../content/types.ts';
import { DEFAULT_PROBLEM_COUNT } from '../math/rules.ts';
import {
  DictationScreen,
  FactsScreen,
  MissingNumberScreen,
  PhraseRecognitionScreen,
  StrategiesScreen,
  StrokeOrderScreen,
  TrueOrFalseScreen,
  WordProblemsScreen,
  type PracticeRouteProps,
} from '../screens/practice.tsx';

export interface PracticeType {
  id: PracticeTypeId;
  /** What the child sees on its button and Keep going card. */
  label: string;
  icon: string;
  /** What its items are called. */
  itemNoun: { singular: string; plural: string };
  /** Whether items are marked ✅/❌. Without marks there are no scores, so progress shows only how far an attempt got. */
  hasMarks: boolean;
  /** The practice screen, given the lesson to practice. */
  screen: ComponentType<PracticeRouteProps>;
}

export const PRACTICE_TYPES: Record<PracticeTypeId, PracticeType> = {
  dictation: {
    id: 'dictation',
    label: 'Write',
    icon: '✏️',
    itemNoun: { singular: 'character', plural: 'characters' },
    hasMarks: true,
    screen: DictationScreen,
  },
  'stroke-order': {
    id: 'stroke-order',
    label: 'Draw',
    icon: '🖌️',
    itemNoun: { singular: 'character', plural: 'characters' },
    hasMarks: false,
    screen: StrokeOrderScreen,
  },
  'phrase-recognition': {
    id: 'phrase-recognition',
    label: 'Say',
    icon: '🗣️',
    itemNoun: { singular: 'phrase', plural: 'phrases' },
    hasMarks: true,
    screen: PhraseRecognitionScreen,
  },
  facts: {
    id: 'facts',
    label: 'Facts',
    icon: '⚡',
    itemNoun: { singular: 'problem', plural: 'problems' },
    hasMarks: true,
    screen: FactsScreen,
  },
  'missing-number': {
    id: 'missing-number',
    label: 'Missing',
    icon: '🔍',
    itemNoun: { singular: 'problem', plural: 'problems' },
    hasMarks: true,
    screen: MissingNumberScreen,
  },
  'true-or-false': {
    id: 'true-or-false',
    label: 'True?',
    icon: '⚖️',
    itemNoun: { singular: 'problem', plural: 'problems' },
    hasMarks: true,
    screen: TrueOrFalseScreen,
  },
  'word-problems': {
    id: 'word-problems',
    label: 'Stories',
    icon: '📖',
    itemNoun: { singular: 'problem', plural: 'problems' },
    hasMarks: true,
    screen: WordProblemsScreen,
  },
  strategies: {
    id: 'strategies',
    label: 'Tricks',
    icon: '🧠',
    itemNoun: { singular: 'problem', plural: 'problems' },
    hasMarks: true,
    screen: StrategiesScreen,
  },
};

/** "37 characters", "1 phrase". */
export const countLabel = (type: PracticeType, count: number): string =>
  `${count} ${count === 1 ? type.itemNoun.singular : type.itemNoun.plural}`;

/**
 * How many items a practice type has in a session: a list's length for Chinese, the profile's "Problems per practice"
 * for math (a math lesson holds rules, not items, so the manifest's count is only the default size).
 */
export const itemsIn = (id: PracticeTypeId, itemCount: number, problemCount: number): number => (isRulesType(id) ? problemCount : itemCount);

/** "5 characters · 6 phrases": the sizes of a lesson's lists, one per practice type it offers (math: the profile's problem count). */
export const listCountsLabel = (lesson: Pick<LessonSummary, 'practiceTypes'>, problemCount: number = DEFAULT_PROBLEM_COUNT): string =>
  lesson.practiceTypes
    .map(({ id, itemCount }) => countLabel(PRACTICE_TYPES[id], itemsIn(id, itemCount, problemCount)))
    .join(' · ');

const SUBJECT_LABELS: Record<string, string> = { chinese: 'Chinese', math: 'Math' };

/** A subject's name as shown to people ("Math"); an unknown subject shows its id with a capital. */
export const subjectLabel = (subject: string): string =>
  SUBJECT_LABELS[subject] ?? subject.charAt(0).toUpperCase() + subject.slice(1);
