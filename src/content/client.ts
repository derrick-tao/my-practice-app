import type { ListData, Manifest } from './types.ts';

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
 * A list together with the content version it belongs to. The manifest names the list's data file (which
 * is immutable, so the service worker serves it cache-first), so the two always come from the same
 * deploy: a manifest fetched after a new deploy points at the new file, never at a stale cached one.
 */
export async function fetchListWithVersion(id: string): Promise<{ list: ListData; contentVersion: string }> {
  const manifest = await fetchManifest();
  const summary = manifest.subjects
    .flatMap((subject) => subject.practiceTypes.flatMap((type) => type.lists))
    .find((entry) => entry.id === id);
  if (!summary) throw new Error(`No published list ${id}`);
  return { list: await getJson<ListData>(summary.file), contentVersion: manifest.contentVersion };
}

export const fetchList = async (id: string): Promise<ListData> => (await fetchListWithVersion(id)).list;
