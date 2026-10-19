import { useState } from 'preact/hooks';

/**
 * One save (or erase, or export) at a time, with the outcome the screen needs: `busy` while it runs and
 * `failed` once it did not work. Calls made while one is running are ignored, so a double tap cannot act twice.
 */
export function useSave(): {
  busy: boolean;
  failed: boolean;
  /** Run `write`; if it succeeds, `then` runs next (after `busy` is cleared); if it fails, `failed` is set and `then` does not run. */
  run(write: () => Promise<unknown>, then?: () => void | Promise<void>): Promise<void>;
  clearFailed(): void;
} {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async (write: () => Promise<unknown>, then?: () => void | Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await write();
    } catch {
      setFailed(true);
      setBusy(false);
      return;
    }
    setBusy(false);
    await then?.();
  };

  return { busy, failed, run, clearFailed: () => setFailed(false) };
}
