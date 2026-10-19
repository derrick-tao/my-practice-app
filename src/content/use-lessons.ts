import { useLoad, type Loadable } from '../use-async.ts';
import { fetchManifest } from './client.ts';
import type { LessonSummary, Manifest } from './types.ts';

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
