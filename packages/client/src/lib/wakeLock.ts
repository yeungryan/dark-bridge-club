// Ryan (QoL): the screen stays on during a night, so phones don't dim and lock while you wait
// for the others to bid. The browser lets go of the lock whenever the page is hidden (another app,
// the phone locked), so it's taken again each time the page comes back. Where the browser has no
// wake lock (older iPhones), nothing happens.

let wanted = false;
let lock: WakeLockSentinel | null = null;

async function take(): Promise<void> {
  if (!wanted || lock || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => (lock = null));
    if (!wanted) await release();
  } catch {
    // Refused (low battery, or the page lost focus first): try again on the next tap or return.
    lock = null;
  }
}

async function release(): Promise<void> {
  const l = lock;
  lock = null;
  await l?.release().catch(() => {});
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => void take());
  // Some browsers only grant it after a tap.
  window.addEventListener('pointerdown', () => void take(), { passive: true });
}

/** Keep the screen awake (true) or let it sleep again (false). */
export function keepAwake(on: boolean): void {
  wanted = on;
  if (on) void take();
  else void release();
}

/** For tests: whether the screen is being kept awake right now. */
export const awake = (): boolean => lock !== null;
