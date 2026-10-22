import type { ProfileInfo } from '@dark/engine';

// Spec S07: exactly four fixed profiles, in D-A-R-K crest order.
export const PROFILES: readonly ProfileInfo[] = [
  { id: 'darren', name: 'Darren', color: '#e0703a' },
  { id: 'adrian', name: 'Adrian', color: '#3a8fe0' },
  { id: 'ryan', name: 'Ryan', color: '#3fb27f' },
  { id: 'kim', name: 'Kim', color: '#b45ad6' },
];

export const PROFILE_IDS = PROFILES.map((p) => p.id) as [string, string, string, string];

export const USUAL_PARTNER: Record<string, string> = {
  darren: 'kim',
  kim: 'darren',
  adrian: 'ryan',
  ryan: 'adrian',
};

/** Ryan: his pair trades seats every five games of a night (whoever his partner is). */
export const SWAP_ANCHOR = 'ryan';

export function isProfile(id: unknown): id is string {
  return typeof id === 'string' && PROFILE_IDS.includes(id);
}
