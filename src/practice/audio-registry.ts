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
let hidden = false;
let installed = false;

/** True while the app is in the background or closing: nothing may start playing then. */
export const audioHidden = (): boolean => hidden;

/** Call `listener` each time the app is hidden, e.g. to drop a timer that would start audio. Returns how to stop. */
export function onAudioHidden(listener: () => void): () => void {
  install();
  hiddenListeners.add(listener);
  return () => void hiddenListeners.delete(listener);
}

function hide(): void {
  hidden = true;
  for (const listener of [...hiddenListeners]) listener();
  for (const item of [...live]) item.release();
}

/** The page-level handler, installed once: by whichever of the first registration or listener comes first. */
function install(): void {
  if (installed) return;
  installed = true;
  hidden = document.visibilityState === 'hidden';
  // pagehide as well: it is not reliable when an iOS home-screen app is swiped away, nor visibilitychange alone.
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? hide() : (hidden = false)));
  addEventListener('pagehide', hide);
  // Coming back from the back-forward cache. Nothing replays: elements are made again on the next play.
  addEventListener('pageshow', () => (hidden = false));
}

/** Track `item` until it is unregistered. */
export function registerAudio(item: Releasable): void {
  install();
  live.add(item);
}

export function unregisterAudio(item: Releasable): void {
  live.delete(item);
}
