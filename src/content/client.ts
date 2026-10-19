import type { LessonData, Manifest } from './types.ts';

/** Content lives at `<base>content/` (the base path is `/my-practice-app/` in production). */
export function contentUrl(path: string): string {
  return `${import.meta.env.BASE_URL}content/${path}`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(contentUrl(path));
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return (await response.json()) as T;
}

export const fetchManifest = (): Promise<Manifest> => getJson<Manifest>('manifest.json');

/**
 * A lesson together with the content version it belongs to. The manifest names the lesson's data file (which
 * is immutable, so the service worker serves it cache-first), so the two always come from the same
 * deploy: a manifest fetched after a new deploy points at the new file, never at a stale cached one.
 */
export async function fetchLessonWithVersion(id: string): Promise<{ lesson: LessonData; contentVersion: string }> {
  const manifest = await fetchManifest();
  const summary = manifest.subjects.flatMap((subject) => subject.lessons).find((entry) => entry.id === id);
  if (!summary) throw new Error(`No published lesson ${id}`);
  return { lesson: await getJson<LessonData>(summary.file), contentVersion: manifest.contentVersion };
}

export const fetchLesson = async (id: string): Promise<LessonData> => (await fetchLessonWithVersion(id)).lesson;
