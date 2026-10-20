import {
  applyDealAction,
  legalPlays,
  newDealWithHands,
  RANKS,
  Rng,
  seatToAct,
  sortHand,
  type Call,
  type Card,
  type DealAction,
  type DealState,
  type PerSeat,
  type Suit,
} from '../src';

/** Each seat holds one complete suit. Makes trick winners fully predictable. */
export function suitHands(suits: PerSeat<Suit>): PerSeat<Card[]> {
  const hand = (suit: Suit) => sortHand(RANKS.map((rank) => ({ suit, rank })));
  return { 0: hand(suits[0]), 1: hand(suits[1]), 2: hand(suits[2]), 3: hand(suits[3]) };
}

export function act(state: DealState, action: DealAction): DealState {
  const outcome = applyDealAction(state, action);
  if (!outcome.ok) throw new Error(`${action.type} rejected: ${outcome.error.code} ${outcome.error.message}`);
  return outcome.state;
}

/** Run the auction with the given calls; each goes to whoever is due to act. */
export function runAuction(state: DealState, calls: Call[]): DealState {
  let s = state;
  for (const call of calls) s = act(s, { type: 'call', seat: seatToAct(s)!, call });
  return s;
}

/** Play the current seat's highest legal card until `stop` returns true or nobody is due to act. */
export function playUntil(state: DealState, stop: (s: DealState) => boolean, choose = highestLegal): DealState {
  let s = state;
  while (!stop(s) && s.phase === 'play') {
    const seat = seatToAct(s)!;
    s = act(s, { type: 'play', seat, card: choose(s) });
  }
  return s;
}

export function highestLegal(s: DealState): Card {
  const seat = seatToAct(s)!;
  const legal = legalPlays(s.hands[seat], s.currentTrick!.cards);
  return legal.reduce((a, b) => (b.rank > a.rank ? b : a));
}

export function randomLegal(rng: Rng) {
  return (s: DealState): Card => {
    const seat = seatToAct(s)!;
    return rng.pick(legalPlays(s.hands[seat], s.currentTrick!.cards));
  };
}

export { newDealWithHands };
