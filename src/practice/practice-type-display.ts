// What a child sees for a practice type: its icon and kid label ("✏️ Write"). A minimal stand-in for the
// practice-type registry (ticket 25), which replaces it; being a Record keeps every practice type covered.
import type { PracticeTypeId } from '../content/types.ts';

export interface PracticeTypeDisplay {
  icon: string;
  label: string;
}

export const PRACTICE_TYPE_DISPLAY: Record<PracticeTypeId, PracticeTypeDisplay> = {
  dictation: { icon: '✏️', label: 'Write' },
  'phrase-recognition': { icon: '🗣️', label: 'Say' },
};
