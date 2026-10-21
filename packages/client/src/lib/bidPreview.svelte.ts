import type { Strain } from '@dark/engine';

// The bid you've picked but not confirmed (Ryan): your hand raises the cards it's about, on
// your screen only. A suit raises that suit; NT raises your honours (A, K, Q, J).
export const bidPreview = $state<{ strain: Strain | null }>({ strain: null });
