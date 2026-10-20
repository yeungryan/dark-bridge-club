import { settings } from './settings.svelte';

// Spec S17: the "feel" in game feel, on phones that support it (Android browsers; iPhone
// browsers have no vibration API). Patterns are milliseconds of buzz, pause, buzz...
// Only your own actions and shared table moments buzz; other people's card plays don't.

const PATTERNS = {
  tap: 6,
  card: 10,
  lead: 14,
  trumpIn: [18, 35, 22],
  trick: 16,
  trumpTrick: [20, 40, 24],
  firstTrump: [30, 40, 30, 40, 60],
  sold: [25, 50, 45],
  no: [10, 30, 10],
  clinch: [40, 60, 90],
} as const;

export type Haptic = keyof typeof PATTERNS;

export function buzz(kind: Haptic): void {
  if (!settings.haptics || settings.effects === 'off') return;
  try {
    const p = PATTERNS[kind];
    navigator.vibrate?.(typeof p === 'number' ? p : [...p]);
  } catch {
    // Not supported: nothing to do.
  }
}
