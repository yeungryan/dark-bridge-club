import { suitSymbol } from './cards';
import type { Award, AwardKind, Moment, MomentKind } from './moments';
import type { ProfileId } from './session';
import type { Suit } from './types';

// Spec S19: caption templates. These are data: edit the words freely, but keep every name coming
// from the moment's / award's profile ids (never from seats) so nobody is misattributed.

type Name = (id: ProfileId) => string;
type Payload = Readonly<Record<string, number | string>>;

/** "4♠", "3NT". */
export function contractLabel(level: number | string | undefined, strain: number | string | undefined): string {
  const s = String(strain);
  return `${level}${s === 'NT' ? 'NT' : suitSymbol(s as Suit)}`;
}

const contractOf = (p: Payload) => contractLabel(p.level, p.strain);

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];
const word = (n: number | string | undefined) => WORDS[Number(n)] ?? String(n);
const plural = (n: number | string | undefined, one: string, many: string) => (Number(n) === 1 ? one : many);

/** "Kim", "Kim & Ryan". */
function names(ids: readonly ProfileId[], name: Name): string {
  return ids.map(name).join(' & ');
}

export const MOMENT_CAPTIONS: Record<MomentKind, (m: Moment, name: Name) => string> = {
  grandAmbition: (m, name) =>
    `Grand ambition! ${names(m.players, name)} went for ${contractOf(m.payload)}${m.payload.made ? ' and made it.' : '.'}`,
  robbery: (m, name) =>
    `Robbery! ${names(m.players, name)} made ${contractOf(m.payload)} with ${m.payload.hcpGap} fewer points.`,
  heartbreak: (m, name) => `Heartbreak. ${names(m.players, name)} fell one trick short in ${contractOf(m.payload)}.`,
  decider: (m, name) => `The decider! Both sides one away, and ${name(m.players[0]!)} took it.`,
  trumpCard: (m, name) => `Trump card! ${name(m.players[0]!)} ruffed in with ${m.payload.card} to settle it.`,
  yarborough: (m, name) => `Yarborough! ${name(m.players[0]!)} was dealt nothing above a 9.`,
  powerhouseBenched: (m, name) =>
    `Powerhouse benched: ${name(m.players[0]!)} held ${m.payload.hcp} points and still lost.`,
  comebackNight: (m, name) =>
    `Comeback night! ${names(m.players, name)} were ${m.payload.maxDeficit} down and won it.`,
  streak: (m, name) => `On a roll: ${names(m.players, name)} won ${m.payload.length} in a row.`,
};

/**
 * Each award's wording. `caption` is the full sentence (with the player's name); on the award
 * card (Ryan: trim the fat) the house awards lead with their joke `headline`, and every card
 * then shows one plain line: the player · `detail`.
 */
export const AWARDS: Record<
  AwardKind,
  { title: string; emoji: string; headline?: string; detail: (a: Award) => string; caption: (a: Award, name: Name) => string }
> = {
  mvp: {
    title: 'MVP',
    emoji: '🏆',
    detail: (a) => `${a.payload.clinches} clinching ${plural(a.payload.clinches, 'card', 'cards')}`,
    caption: (a, name) => `${name(a.profile)} played ${a.payload.clinches} clinching cards.`,
  },
  wall: {
    title: 'The Wall',
    emoji: '🧱',
    detail: (a) => `${a.payload.sets} ${plural(a.payload.sets, 'contract', 'contracts')} set`,
    caption: (a, name) => `${name(a.profile)} set ${a.payload.sets} contracts.`,
  },
  daredevil: {
    title: 'Daredevil',
    emoji: '🎢',
    detail: (a) => `level ${Number(a.payload.averageLevel).toFixed(1).replace(/\.0$/, '')} on average`,
    caption: (a, name) =>
      `${name(a.profile)} declared at level ${Number(a.payload.averageLevel).toFixed(1).replace(/\.0$/, '')} on average.`,
  },
  heist: {
    title: 'Heist of the Night',
    emoji: '🦹',
    detail: (a) => `${contractOf(a.payload)} made with ${a.payload.hcpGap} fewer points`,
    caption: (a, name) =>
      `${name(a.profile)} made ${contractOf(a.payload)} with ${a.payload.hcpGap} fewer points than the defenders.`,
  },
  heartbreakHotel: {
    title: 'Heartbreak Hotel',
    emoji: '💔',
    detail: (a) => `${a.payload.heartbreaks} ${plural(a.payload.heartbreaks, 'contract', 'contracts')} lost by one set`,
    caption: (a, name) =>
      `${name(a.profile)}: ${a.payload.heartbreaks} ${plural(a.payload.heartbreaks, 'contract', 'contracts')} lost by a single trick.`,
  },
  epicAttic: {
    title: 'Epic Attic',
    emoji: '🏚️',
    headline: 'Epic attic levels na yan!',
    detail: (a) => `${contractOf(a.payload)}, ${word(a.payload.tricksShort)} short. Booked for ten, delivered an attic.`,
    caption: (a, name) =>
      `${name(a.profile)}: ${contractOf(a.payload)}, ${word(a.payload.tricksShort)} short. Booked for ten, delivered an attic. Epic attic levels na yan!`,
  },
  blogAboutIt: {
    title: "Why Don't You Blog About It",
    emoji: '📝',
    headline: "Why don't you blog about that?",
    detail: (a) => `settled game ${a.payload.dealNumber}`,
    caption: (a, name) => `${name(a.profile)} settled game ${a.payload.dealNumber}. Why don't you blog about that?`,
  },
  bannerMoment: {
    title: 'Banner Moment',
    emoji: '🪧',
    headline: 'Banner moment na ba yan?',
    detail: (a) => `${contractOf(a.payload)}, ${Number(a.payload.spare) === 0 ? 'made exactly' : 'one to spare'}`,
    caption: (a, name) =>
      `${name(a.profile)}: ${contractOf(a.payload)}, ${Number(a.payload.spare) === 0 ? 'made exactly' : 'one to spare'}. Banner moment na ba yan?`,
  },
  tenDollars: {
    title: "That's 10 Dollars",
    emoji: '💵',
    headline: 'Oh, 10 dollars na yan!',
    detail: (a) => `${a.payload.minutes} ${plural(a.payload.minutes, 'minute', 'minutes')} of thinking`,
    caption: (a, name) =>
      `${name(a.profile)}: ${a.payload.minutes} ${plural(a.payload.minutes, 'minute', 'minutes')} of thinking. Oh, 10 dollars na yan!`,
  },
};
