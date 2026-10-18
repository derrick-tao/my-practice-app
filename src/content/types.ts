// Shapes of the build output (public/content). Shared by the content pipeline (writer)
// and the app (reader). Plain JSON only.

export type Script = 'simplified' | 'traditional';

/** One entry in the practice-type registry's id space. Dictation is the only one in v1. */
export type PracticeTypeId = 'dictation';

export interface ListSummary {
  id: string;
  title: string;
  script: Script;
  testDates?: string;
  itemCount: number;
}

export interface Manifest {
  /** Hash of all list data; changes if and only if list data changes. */
  contentVersion: string;
  subjects: Array<{
    id: string;
    practiceTypes: Array<{ id: PracticeTypeId; lists: ListSummary[] }>;
  }>;
}

export interface ItemData {
  target: string;
  clue?: string;
  /** Always present in build output (auto-generated when the author omitted it). */
  pinyin: string;
  lesson?: string;
  /** Paths relative to the content root (`<base>content/`), e.g. `audio/<hash>.mp3`. */
  audio: { normal: string; slow: string };
}

export interface ListData {
  id: string;
  title: string;
  subject: string;
  practiceTypes: PracticeTypeId[];
  script: Script;
  testDates?: string;
  items: ItemData[];
}
