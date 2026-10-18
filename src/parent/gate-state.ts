// Whether the parent area is unlocked. In memory only: a reload, leaving the parent area (App locks it
// whenever the route is not #/parent...) or 5 idle minutes locks it again.
import { useEffect, useState } from 'preact/hooks';

export const IDLE_LOCK_MS = 5 * 60 * 1000;

let unlocked = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let lastActivity = 0;
const listeners = new Set<() => void>();

const ACTIVITY_EVENTS = ['pointerdown', 'keydown'] as const;

function notify(): void {
  for (const listener of listeners) listener();
}

function armIdleTimer(): void {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(lockParentArea, IDLE_LOCK_MS);
}

function onActivity(): void {
  lastActivity = Date.now();
  armIdleTimer();
}

/** Timers can be suspended while the device sleeps: when the page is seen again, check the real time. */
function onVisible(): void {
  if (document.visibilityState === 'visible' && Date.now() - lastActivity >= IDLE_LOCK_MS) lockParentArea();
}

export function unlockParentArea(): void {
  if (unlocked) return;
  unlocked = true;
  lastActivity = Date.now();
  armIdleTimer();
  for (const type of ACTIVITY_EVENTS) document.addEventListener(type, onActivity, true);
  document.addEventListener('visibilitychange', onVisible);
  notify();
}

export function lockParentArea(): void {
  if (!unlocked) return;
  unlocked = false;
  clearTimeout(idleTimer);
  for (const type of ACTIVITY_EVENTS) document.removeEventListener(type, onActivity, true);
  document.removeEventListener('visibilitychange', onVisible);
  notify();
}

export function useParentAreaUnlocked(): boolean {
  const [value, setValue] = useState(unlocked);
  useEffect(() => {
    const sync = (): void => setValue(unlocked);
    listeners.add(sync);
    sync();
    return () => void listeners.delete(sync);
  }, []);
  return value;
}
