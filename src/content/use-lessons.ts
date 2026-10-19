import { useLoad, type Loadable } from '../use-async.ts';
import { fetchManifest } from './client.ts';
import type { LessonSummary, Manifest, PracticeTypeId } from './types.ts';

export interface PublishedLesson {
  subject: string;
  lesson: LessonSummary;
}

/** Every lesson in the manifest, flattened (the subject kept for building its route). */
export function publishedLessons(manifest: Manifest): PublishedLesson[] {
  return manifest.subjects.flatMap((subject) => subject.lessons.map((lesson) => ({ subject: subject.id, lesson })));
}

/** The published lessons, loaded from the content manifest. */
export function usePublishedLessons(): Loadable<PublishedLesson[]> {
  const manifest = useLoad(fetchManifest, []);
  return manifest.status === 'ready' ? { status: 'ready', value: publishedLessons(manifest.value) } : manifest;
}

/** How many items a lesson's list has for one practice type (0 when the lesson does not offer it). */
export function itemCountOf(lesson: LessonSummary, practiceType: PracticeTypeId): number {
  return lesson.practiceTypes.find((type) => type.id === practiceType)?.itemCount ?? 0;
}
