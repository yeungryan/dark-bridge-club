import { sameCard } from './cards';
import type { Card, Seat, Strain, Suit } from './types';

// Spec S03. Card-level rules for a single trick. No dummy: every seat plays its own hand.

export interface PlayedCard {
  readonly seat: Seat;
  readonly card: Card;
}

export interface Trick {
  readonly leader: Seat;
  /** In play order (counter-clockwise from the leader). */
  readonly cards: readonly PlayedCard[];
}

export interface CompletedTrick extends Trick {
  readonly winner: Seat;
  readonly winningCard: Card;
}

export function trumpSuit(strain: Strain): Suit | null {
  return strain === 'NT' ? null : strain;
}

/** You must follow the suit led if you can; otherwise any card is legal. */
export function legalPlays(hand: readonly Card[], trickSoFar: readonly PlayedCard[]): Card[] {
  const led = trickSoFar[0]?.card.suit;
  if (!led) return [...hand];
  const following = hand.filter((c) => c.suit === led);
  return following.length > 0 ? following : [...hand];
}

export function isLegalPlay(hand: readonly Card[], trickSoFar: readonly PlayedCard[], card: Card): boolean {
  return legalPlays(hand, trickSoFar).some((c) => sameCard(c, card));
}

/** The highest trump if any trump was played, otherwise the highest card of the suit led. */
export function winningPlay(cards: readonly PlayedCard[], trump: Suit | null): PlayedCard {
  const first = cards[0];
  if (!first) throw new Error('Empty trick has no winner');
  const led = first.card.suit;
  let best = first;
  for (const play of cards.slice(1)) {
    if (beats(play.card, best.card, led, trump)) best = play;
  }
  return best;
}

function beats(challenger: Card, current: Card, led: Suit, trump: Suit | null): boolean {
  if (challenger.suit === current.suit) return challenger.rank > current.rank;
  if (trump && challenger.suit === trump) return true;
  if (trump && current.suit === trump) return false;
  return challenger.suit === led && current.suit !== led;
}
