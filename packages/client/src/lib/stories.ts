import { AWARDS, MOMENT_CAPTIONS, type Award, type Moment, type MomentKind, type ProfileId, type ProfileInfo } from '@dark/engine';
import { profileOf } from './format';

// Spec S19 on screen: the emoji for each moment, and captions with real names filled in.

export const MOMENT_EMOJI: Record<MomentKind, string> = {
  grandAmbition: '🏔️',
  robbery: '🦹',
  heartbreak: '💔',
  decider: '⚖️',
  trumpCard: '🃏',
  yarborough: '🗑️',
  powerhouseBenched: '🪑',
  comebackNight: '🔄',
  streak: '🔥',
};

const namer = (profiles: readonly ProfileInfo[]) => (id: ProfileId) => profileOf(profiles, id).name;

export function momentCaption(m: Moment, profiles: readonly ProfileInfo[]): string {
  return MOMENT_CAPTIONS[m.kind](m, namer(profiles));
}

/** An award card (Ryan: trim the fat): the joke (or the award's name) as the headline, then one plain line. */
export function awardText(a: Award, profiles: readonly ProfileInfo[]): { headline: string; emoji: string; title: string; line: string } {
  const def = AWARDS[a.kind];
  return { headline: def.headline ?? def.title, emoji: def.emoji, title: def.title, line: `${profileOf(profiles, a.profile).name} · ${def.detail(a)}` };
}
