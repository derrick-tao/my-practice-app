// The app record (profiles, active profile, assigned lessons) as the whole UI sees it. App loads it once
// and provides it; screens read it with `useAppRecord()` and change it with `update()`.
import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { loadAppRecord, updateApp } from './profiles.ts';
import { NewerSchemaError } from './storage/index.ts';
import type { AppRecord } from './storage/types.ts';

export type AppState =
  | { status: 'loading' }
  /** Saved data could not be read. */
  | { status: 'error' }
  /** Saved data was written by a newer version of the app: it is left untouched. */
  | { status: 'newer' }
  | { status: 'ready'; app: AppRecord };

export interface AppRecordApi {
  app: AppRecord;
  /**
   * Change and save the app record (changes are applied one after another). Resolves once saved, with
   * the new record; rejects if the save fails, leaving everything as it was.
   */
  update(change: (app: AppRecord) => AppRecord): Promise<AppRecord>;
  /** Read the record again from the device (after something replaced it, e.g. a backup import). */
  reload(): Promise<void>;
}

const Context = createContext<AppRecordApi | undefined>(undefined);

/** Loads the app record; `api` is set once it is ready. */
export function useAppState(): { state: AppState; api: AppRecordApi | undefined } {
  const [state, setState] = useState<AppState>({ status: 'loading' });

  const reload = useCallback(async (): Promise<void> => {
    try {
      setState({ status: 'ready', app: await loadAppRecord() });
    } catch (error) {
      setState({ status: error instanceof NewerSchemaError ? 'newer' : 'error' });
    }
  }, []);
  useEffect(() => void reload(), [reload]);

  const update = useCallback(async (change: (app: AppRecord) => AppRecord): Promise<AppRecord> => {
    const app = await updateApp(change);
    setState({ status: 'ready', app });
    return app;
  }, []);

  return { state, api: state.status === 'ready' ? { app: state.app, update, reload } : undefined };
}

export function AppRecordProvider({ api, children }: { api: AppRecordApi; children: ComponentChildren }) {
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

export function useAppRecord(): AppRecordApi {
  const api = useContext(Context);
  if (!api) throw new Error('useAppRecord must be used inside the app (after the app record has loaded)');
  return api;
}
