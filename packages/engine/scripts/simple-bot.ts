// Dev-only card-play heuristics (spec S22). Never used in real games.
import { legalPlays, partner, seatToAct, trumpSuit, winningPlay, type Card, type DealState } from '../src';

const lowest = (cards: Card[]) => cards.reduce((a, b) => (b.rank < a.rank ? b : a));
const highest = (cards: Card[]) => cards.reduce((a, b) => (b.rank > a.rank ? b : a));

export function simpleBotCard(s: DealState): Card {
  const me = seatToAct(s)!;
  const hand = s.hands[me];
  const trick = s.currentTrick!.cards;
  const trump = trumpSuit(s.contract!.strain);
  const legal = legalPlays(hand, trick);

  // Leading: top of the longest non-trump suit (trumps only if nothing else is left).
  if (trick.length === 0) {
    const nonTrump = hand.filter((c) => c.suit !== trump);
    const pool = nonTrump.length > 0 ? nonTrump : hand;
    const bySuit = new Map<string, Card[]>();
    for (const c of pool) bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c]);
    const longest = [...bySuit.values()].reduce((a, b) => (b.length > a.length ? b : a));
    return highest(longest);
  }

  const current = winningPlay(trick, trump);
  const partnerWinning = current.seat === partner(me);
  const winners = legal.filter((c) => winningPlay([...trick, { seat: me, card: c }], trump).seat === me);

  if (partnerWinning || winners.length === 0) {
    const discards = legal.filter((c) => c.suit !== trump);
    return lowest(discards.length > 0 ? discards : legal);
  }
  return lowest(winners);
}
