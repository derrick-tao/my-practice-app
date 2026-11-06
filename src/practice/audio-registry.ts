/**
 * Every live audio player, so one page-level handler can let go of all the app's sound when the app goes to the
 * background or is closed. Otherwise the elements stay alive and iOS keeps showing its lock-screen Now Playing
 * control for them. Anything with `release()` can register.
 */
export interface Releasable {
  /** Stop and let go of every element. The owner stays usable and registers again when it makes a new one. */
  release(): void;
}

const live = new Set<Releasable>();
const hiddenListeners = new Set<() => void>();
let installed = false;

/**
 * True while the page is in the background: nothing may start playing then. Read from the browser each time so it
 * can never stick: `pagehide` only releases (the page may stay alive, e.g. an iOS handoff to mailto:), it sets no flag.
 */
export const audioHidden = (): boolean => document.visibilityState === 'hidden';

/** Call `listener` each time the app is hidden, e.g. to drop a timer that would start audio. Returns how to stop. */
export function onAudioHidden(listener: () => void): () => void {
  install();
  hiddenListeners.add(listener);
  return () => void hiddenListeners.delete(listener);
}

function releaseAll(): void {
  for (const item of [...live]) item.release();
}

/** The page went to the background: drop timers that would start audio, then let go of everything. */
function handleHidden(): void {
  for (const listener of [...hiddenListeners]) listener();
  releaseAll();
}

/** The page-level handler, installed once: by whichever of the first registration or listener comes first. */
function install(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handleHidden();
  });
  // pagehide as well: it is not reliable when an iOS home-screen app is swiped away, nor visibilitychange alone.
  // Release only: the page can survive it, so it must not block later sound. Nothing replays; elements are made
  // again on the next play.
  addEventListener('pagehide', releaseAll);
}

/** Track `item` until it is unregistered. */
export function registerAudio(item: Releasable): void {
  install();
  live.add(item);
}

export function unregisterAudio(item: Releasable): void {
  live.delete(item);
}
