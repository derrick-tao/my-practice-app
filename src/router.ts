// Hash-based routing (GitHub Pages has no SPA fallback). Routes follow the shape
// subject -> practice type -> list, so new subjects and practice types slot in:
//   #/                                  home
//   #/<subject>/<practiceType>/<listId> e.g. #/chinese/dictation/fall-2026-assessment
import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'home' }
  | { name: 'list'; subject: string; practiceType: string; listId: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 3) {
    const [subject, practiceType, listId] = parts as [string, string, string];
    return { name: 'list', subject, practiceType, listId };
  }
  return { name: 'home' };
}

export function listHref(subject: string, practiceType: string, listId: string): string {
  return `#/${[subject, practiceType, listId].map(encodeURIComponent).join('/')}`;
}

export const HOME_HREF = '#/';

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = (): void => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
