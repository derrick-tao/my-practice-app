// Shapes of the build output (public/content). Shared by the content pipeline (writer)
// and the app (reader). Plain JSON only.

export type Script = 'simplified' | 'traditional';

/** The practice-type registry's id space. A lesson's data has a list for each of these it offers. */
export const PRACTICE_TYPE_IDS = ['dictation', 'phrase-recognition'] as const;
export type PracticeTypeId = (typeof PRACTICE_TYPE_IDS)[number];

export const isPracticeTypeId = (value: string): value is PracticeTypeId =>
  (PRACTICE_TYPE_IDS as readonly string[]).includes(value);

/** The two recordings made of every item. */
export type Rendition = 'normal' | 'slow';

/** One practice type a lesson offers: the size of its list. */
export interface PracticeTypeSummary {
  id: PracticeTypeId;
  itemCount: number;
}

export interface LessonSummary {
  id: string;
  /** The lesson's data file, relative to the content root (`<base>content/`), named by its content hash: `lessons/<id>.<hash>.json`. */
  file: string;
  title: string;
  script: Script;
  testDates?: string;
  /** The practice types the lesson offers (the lists it has), in registry order. */
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
}

export interface LessonData {
  id: string;
  title: string;
  subject: string;
  script: Script;
  testDates?: string;
  /** A list of items per practice type the lesson offers. */
  lists: Partial<Record<PracticeTypeId, ItemData[]>>;
}

/** A lesson's lists as [practice type, value] pairs, in registry order (skipping practice types the lesson does not offer). */
export function listEntries<T>(lists: Partial<Record<PracticeTypeId, T>>): Array<[PracticeTypeId, T]> {
  return PRACTICE_TYPE_IDS.flatMap((type) => (lists[type] === undefined ? [] : [[type, lists[type]] as [PracticeTypeId, T]]));
}
