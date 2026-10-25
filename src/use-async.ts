import { useEffect, useState } from 'preact/hooks';

export type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };

/** The last result of each `cacheKey`, kept for the life of the page. */
const cache = new Map<string, unknown>();

/**
 * Run `load` when the component appears and whenever `deps` change.
 * With a `cacheKey`, the last result under that key is shown straight away while `load` runs again to refresh it, so
 * coming back to a screen does not wait for the same data twice. A failed refresh keeps what is shown.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], cacheKey?: string): Loadable<T> {
  const cached = (): Loadable<T> =>
    cacheKey !== undefined && cache.has(cacheKey) ? { status: 'ready', value: cache.get(cacheKey) as T } : { status: 'loading' };
  const [state, setState] = useState<Loadable<T>>(cached);
  useEffect(() => {
    let cancelled = false;
    setState(cached());
    load().then(
      (value) => {
        if (cacheKey !== undefined) cache.set(cacheKey, value);
        if (!cancelled) setState({ status: 'ready', value });
      },
      () => !cancelled && setState((now) => (now.status === 'ready' ? now : { status: 'error' })),
    );
    return () => {
      cancelled = true;
    };
  }, deps);
  return state;
}
