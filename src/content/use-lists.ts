import { useLoad, type Loadable } from '../use-async.ts';
import { fetchManifest } from './client.ts';
import type { ListSummary, Manifest, PracticeTypeId } from './types.ts';

export interface PublishedList {
  subject: string;
  practiceType: PracticeTypeId;
  list: ListSummary;
}

/** Every list in the manifest, flattened (subject and practice type kept for building its route). */
export function publishedLists(manifest: Manifest): PublishedList[] {
  return manifest.subjects.flatMap((subject) =>
    subject.practiceTypes.flatMap((type) =>
      type.lists.map((list) => ({ subject: subject.id, practiceType: type.id, list })),
    ),
  );
}

/** The published lists, loaded from the content manifest. */
export function usePublishedLists(): Loadable<PublishedList[]> {
  const manifest = useLoad(fetchManifest, []);
  return manifest.status === 'ready' ? { status: 'ready', value: publishedLists(manifest.value) } : manifest;
}
