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
export const fetchList = (id: string): Promise<ListData> =>
  getJson<ListData>(`lists/${encodeURIComponent(id)}.json`);
