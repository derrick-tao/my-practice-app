// Keeps the session on screen and the session on disk in step: a change is saved through the
// StorageAdapter first and only then becomes the visible state ("persist before the UI advances").
//
// Changes run one at a time, in order, each computed from the last saved state. If a save fails the
// queue stops where it is, `saveFailed` is reported so the screen can say "Couldn't save — tap to
// retry", and the visible state stays at the last saved step. `retry()` tries the same change again.
import type { StorageAdapter } from '../storage/types.ts';
import type { Session } from './session.ts';

export interface SyncState {
  /** The last session state that is safely saved; this is what the screen shows. */
  session: Session;
  saveFailed: boolean;
}

/** A pure step: returns the same object when it does not apply (nothing is written then). */
export type Transition = (session: Session) => Session;

export interface SessionSync {
  state(): SyncState;
  /** A save is running or has failed: steps that depend on the visible state should wait (be ignored). */
  busy(): boolean;
  /** Queue a change. It is saved, and then shown. */
  dispatch(transition: Transition): void;
  /** After a failed save: try again. */
  retry(): void;
  /** Stop reporting to the screen (it went away). Already-queued changes are still saved. */
  detach(): void;
}

export function createSessionSync(
  storage: StorageAdapter,
  initial: Session,
  onChange: (state: SyncState) => void,
): SessionSync {
  let saved = initial;
  let saveFailed = false;
  let running = false;
  let attached = true;
  const queue: Transition[] = [];

  const report = (): void => {
    if (attached) onChange({ session: saved, saveFailed });
  };

  async function pump(): Promise<void> {
    if (running || saveFailed) return;
    running = true;
    try {
      while (queue.length > 0) {
        const next = queue[0]!(saved);
        if (next !== saved) {
          try {
            saved = await storage.putSession(next);
          } catch {
            saveFailed = true;
            report();
            return;
          }
        }
        queue.shift();
        report();
      }
    } finally {
      running = false;
    }
  }

  return {
    state: () => ({ session: saved, saveFailed }),
    busy: () => running || saveFailed,
    dispatch(transition) {
      queue.push(transition);
      void pump();
    },
    retry() {
      if (!saveFailed) return;
      saveFailed = false;
      report();
      void pump();
    },
    detach() {
      attached = false;
    },
  };
}
