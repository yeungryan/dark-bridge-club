import {
  applyDealAction,
  declarerTarget,
  defenderTarget,
  legalCalls,
  legalPlays,
  newDealWithHands,
  perSeat,
  RANKS,
  Rng,
  seatToAct,
  sortHand,
  type Call,
  type Card,
  type DealAction,
  type DealState,
  type DealView,
  type PerSeat,
  type Seat,
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

/** One seat's DealView straight from a DealState (no session), for driving bots in tests and scripts. */
export function seatView(state: DealState, seat: Seat): DealView {
  const turn = seatToAct(state);
  const myTurn = turn === seat;
  const contract = state.contract;
  return {
    phase: state.phase,
    dealer: state.dealer,
    calls: state.auction.calls,
    contract,
    declarerTarget: contract ? declarerTarget(contract.level) : null,
    defenderTarget: contract ? defenderTarget(contract.level) : null,
    turn,
    hand: state.hands[seat],
    handCounts: perSeat((s) => state.hands[s].length),
    currentTrick: state.currentTrick,
    lastTrick: state.tricks[state.tricks.length - 1] ?? null,
    tricksPlayed: state.tricks.length,
    tricksWon: state.tricksWon,
    trickWinners: state.tricks.map((t) => t.winner),
    trumpTricksWon: 0,
    clinch: state.clinch,
    playingOn: state.playingOn,
    concession: state.concession,
    result: state.result,
    legalCalls: myTurn && state.phase === 'auction' ? legalCalls(state.auction) : [],
    legalPlays: myTurn && state.phase === 'play' ? legalPlays(state.hands[seat], state.currentTrick!.cards) : [],
    revealedHands: null,
    playedTricks: null,
  };
}
