// One-time "Add to Home Screen" tip for the parent area (Chrome on iOS).
//
// NOT MOUNTED YET: the parent area does not exist at this point in the build. The ticket that creates it
// should render <AddToHomeScreenTip /> there. The component owns everything else: it hides itself when the
// app already runs from the home screen, and once dismissed it never comes back on this device.
import { useState } from 'preact/hooks';

const DISMISSED_KEY = 'practice.installTipDismissed';

/** True when the app was launched from the home screen (standalone), where the tip is pointless. */
export function isInstalled(): boolean {
  const standaloneMedia = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  return standaloneMedia || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function readDismissed(storage: Storage): boolean {
  try {
    return storage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remember the dismissal. If the browser refuses to store it, the tip simply shows again next visit. */
function writeDismissed(storage: Storage): void {
  try {
    storage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Nothing to do: dismissal still hides the tip for this visit.
  }
}

export function AddToHomeScreenTip({
  storage = localStorage,
  installed = isInstalled(),
}: {
  /** Where the dismissal is remembered. */
  storage?: Storage;
  /** Already running from the home screen. */
  installed?: boolean;
}) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storage));
  if (installed || dismissed) return null;
  return (
    <section class="install-tip" aria-label="Add to Home Screen" data-testid="install-tip">
      <p class="install-tip__text">
        <strong>Add this app to your Home Screen.</strong> Tap the Share button next to the address bar, then{' '}
        <strong>Add to Home Screen</strong>. It will open like an app, work without internet, and its saved
        progress is better protected.
      </p>
      <button
        type="button"
        class="install-tip__dismiss"
        onClick={() => {
          writeDismissed(storage);
          setDismissed(true);
        }}
      >
        Got it
      </button>
    </section>
  );
}
