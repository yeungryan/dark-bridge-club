import { Rng, type Seed } from './rng';
import { next, perSeat } from './seats';
import { RANKS, SUITS, type Card, type PerSeat, type Rank, type Seat, type Suit } from './types';

export function fullDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Compact id such as "SA", "H10", "C2". */
export function cardId(card: Card): string {
  return `${card.suit}${rankLabel(card.rank)}`;
}

export function rankLabel(rank: Rank): string {
  return rank <= 10 ? String(rank) : (['J', 'Q', 'K', 'A'] as const)[rank - 11]!;
}

const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOL[suit];
}

/** "♠K", "♥10". */
export function cardLabel(card: Card): string {
  return `${SUIT_SYMBOL[card.suit]}${rankLabel(card.rank)}`;
}

/** High-card points: A=4, K=3, Q=2, J=1. */
export function hcp(hand: readonly Card[]): number {
  return hand.reduce((sum, c) => sum + Math.max(0, c.rank - 10), 0);
}

/** Display order: suits alternate colors (♠ ♥ ♣ ♦), high to low within each suit. */
const DISPLAY_SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, C: 2, D: 3 };

export function sortHand(hand: readonly Card[]): Card[] {
  return [...hand].sort(
    (a, b) => DISPLAY_SUIT_ORDER[a.suit] - DISPLAY_SUIT_ORDER[b.suit] || b.rank - a.rank,
  );
}

/**
 * Shuffle with the seed and deal one card at a time, starting with the seat after the dealer.
 * The same seed and dealer always produce the same hands.
 */
export function dealHands(seed: Seed, dealer: Seat): PerSeat<Card[]> {
  const deck = Rng.fromSeed(seed).shuffle(fullDeck());
  const hands = perSeat<Card[]>(() => []);
  let seat = next(dealer);
  for (const card of deck) {
    hands[seat].push(card);
    seat = next(seat);
  }
  return perSeat((s) => sortHand(hands[s]));
}
