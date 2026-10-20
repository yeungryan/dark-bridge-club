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

export function awardText(a: Award, profiles: readonly ProfileInfo[]): { title: string; emoji: string; caption: string } {
  const def = AWARDS[a.kind];
  return { title: def.title, emoji: def.emoji, caption: def.caption(a, namer(profiles)) };
}
