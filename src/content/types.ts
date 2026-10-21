// Shapes of the build output (public/content). Shared by the content pipeline (writer)
// and the app (reader). Plain JSON only.
import type { Rules } from '../math/rules.ts';

export type Script = 'simplified' | 'traditional';

/** Practice types whose lesson holds a list of items to practice (the Chinese subject). */
export const LIST_TYPE_IDS = ['dictation', 'stroke-order', 'phrase-recognition'] as const;
export type ListTypeId = (typeof LIST_TYPE_IDS)[number];

/** Practice types whose lesson holds rules; the items are generated when a session starts (the Math subject). */
export const RULES_TYPE_IDS = ['facts'] as const;
export type RulesTypeId = (typeof RULES_TYPE_IDS)[number];

/** The practice-type id space, in registry order (the order buttons appear in). */
export const PRACTICE_TYPE_IDS = [...LIST_TYPE_IDS, ...RULES_TYPE_IDS] as const;
export type PracticeTypeId = ListTypeId | RulesTypeId;

/** Every practice type belongs to exactly one subject; a lesson may only offer its own subject's practice types. */
export const PRACTICE_TYPE_SUBJECTS: Record<PracticeTypeId, string> = {
  dictation: 'chinese',
  'stroke-order': 'chinese',
  'phrase-recognition': 'chinese',
  facts: 'math',
};

export const isPracticeTypeId = (value: string): value is PracticeTypeId =>
  (PRACTICE_TYPE_IDS as readonly string[]).includes(value);

export const isListType = (id: PracticeTypeId): id is ListTypeId => (LIST_TYPE_IDS as readonly string[]).includes(id);
export const isRulesType = (id: PracticeTypeId): id is RulesTypeId => (RULES_TYPE_IDS as readonly string[]).includes(id);

/** The two recordings made of every item. */
export type Rendition = 'normal' | 'slow';

/** One practice type a lesson offers: the size of its list (for rules, the problems in a session). */
export interface PracticeTypeSummary {
  id: PracticeTypeId;
  itemCount: number;
}

export interface LessonSummary {
  id: string;
  /** The lesson's data file, relative to the content root (`<base>content/`), named by its content hash: `lessons/<id>.<hash>.json`. */
  file: string;
  title: string;
  /** Chinese lessons only. */
  script?: Script;
  testDates?: string;
  /** The practice types the lesson offers (the lists or rules it has), in registry order. */
  practiceTypes: PracticeTypeSummary[];
}

export interface Manifest {
  /** Hash of all lesson data; changes if and only if lesson data changes. */
  contentVersion: string;
  subjects: Array<{ id: string; lessons: LessonSummary[] }>;
}

export interface ItemData {
  target: string;
  clue?: string;
  /** Always present in build output (auto-generated when the author omitted it). */
  pinyin: string;
  /** Paths relative to the content root (`<base>content/`), e.g. `audio/<hash>.mp3`. */
  audio: { normal: string; slow: string };
  /** Stroke order items only: the character's stroke data, relative to the content root, e.g. `strokes/<hash>.json`. */
  strokes?: string;
}

export interface LessonData {
  id: string;
  title: string;
  subject: string;
  /** Chinese lessons only. */
  script?: Script;
  testDates?: string;
  /** A list of items per practice type the lesson offers (empty for a math lesson). */
  lists: Partial<Record<ListTypeId, ItemData[]>>;
  /** Math lessons only: the rules per practice type the lesson offers. */
  rules?: Partial<Record<RulesTypeId, Rules>>;
}

/** A lesson's lists as [practice type, value] pairs, in registry order (skipping practice types the lesson does not offer). */
export function listEntries<T>(lists: Partial<Record<ListTypeId, T>>): Array<[ListTypeId, T]> {
  return LIST_TYPE_IDS.flatMap((type) => (lists[type] === undefined ? [] : [[type, lists[type]] as [ListTypeId, T]]));
}

/** A lesson's rules as [practice type, rules] pairs, in registry order. */
export function rulesEntries<T>(rules: Partial<Record<RulesTypeId, T>> | undefined): Array<[RulesTypeId, T]> {
  return RULES_TYPE_IDS.flatMap((type) => (rules?.[type] === undefined ? [] : [[type, rules[type]] as [RulesTypeId, T]]));
}
