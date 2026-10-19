// Hash-based routing (GitHub Pages has no SPA fallback). Routes follow the shape
// subject -> practice type -> lesson, so new subjects and practice types slot in:
//   #/                                  home
//   #/<subject>/<practiceType>/<lessonId> e.g. #/chinese/dictation/fall-2026-assessment
//   #/parent[/<section>[/...]]          the parent area (behind the gate), e.g. #/parent/assign-lessons
import { useEffect, useState } from 'preact/hooks';
import { isPracticeTypeId, type PracticeTypeId } from './content/types.ts';

export type Route =
  | { name: 'home' }
  | { name: 'lesson'; subject: string; practiceType: PracticeTypeId; lessonId: string }
  /** The parent area. `path` is what follows `#/parent/`: the section id, then that section's own sub-path. */
  | { name: 'parent'; path: string[] }
  /** Looks like a lesson address but names a practice type that does not exist. */
  | { name: 'not-found' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'parent') return { name: 'parent', path: parts.slice(1) };
  if (parts.length === 3) {
    const [subject, practiceType, lessonId] = parts as [string, string, string];
    return isPracticeTypeId(practiceType)
      ? { name: 'lesson', subject, practiceType, lessonId }
      : { name: 'not-found' };
  }
  return { name: 'home' };
}

export function lessonHref(subject: string, practiceType: PracticeTypeId, lessonId: string): string {
  return `#/${[subject, practiceType, lessonId].map(encodeURIComponent).join('/')}`;
}

export const HOME_HREF = '#/';

/** `#/parent`, or a section (and its own sub-path) inside it: `parentHref('progress', lessonId)`. */
export function parentHref(...path: string[]): string {
  return `#/${['parent', ...path].map(encodeURIComponent).join('/')}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = (): void => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
