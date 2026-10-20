import {
  auctionStatus,
  declarerTarget,
  defenderTarget,
  isLegalCall,
  newAuction,
  type AuctionState,
} from './auction';
import { dealHands, sameCard } from './cards';
import { isLegalPlay, trumpSuit, winningPlay, type CompletedTrick, type PlayedCard } from './play';
import type { Seed } from './rng';
import { next, partner, perSeat } from './seats';
import { fail, type Call, type Card, type Contract, type Outcome, type PerSeat, type Seat, type Side } from './types';

// Specs S02–S04: one deal from the first call to the result.
// Pure reducer: (state, action) -> new state + events. The server owns all timers and sends
// `endAtClinch` / `expireConcession` when they fire.

export type DealPhase =
  | 'auction'
  /** Cards are being played. Also used while playing on after the clinch. */
  | 'play'
  /** The result is settled; waiting for anyone to choose "Play on" (R11). */
  | 'awaitingPlayOn'
  | 'complete'
  | 'passedOut';

export interface Clinch {
  readonly side: Side;
  /** 1-based number of the trick that settled the deal. */
  readonly trickNumber: number;
  /** The card that won the clinching trick, and who played it (drives the signature effect). */
  readonly card: Card;
  readonly seat: Seat;
}

export interface DealResult {
  readonly winner: Side;
  readonly reason: 'made' | 'defeated' | 'conceded';
  readonly declarerTricks: number;
  readonly defenderTricks: number;
  /** True only when all 13 tricks were played. */
  readonly playedOut: boolean;
  /** Declarer tricks minus target when played out (e.g. +1 overtrick, −2 down); otherwise null. */
  readonly overUnder: number | null;
}

export interface PendingConcession {
  readonly by: Seat;
  readonly side: Side;
}

export interface DealState {
  readonly seed: Seed | null;
  readonly dealer: Seat;
  readonly originalHands: PerSeat<readonly Card[]>;
  readonly hands: PerSeat<readonly Card[]>;
  readonly auction: AuctionState;
  readonly phase: DealPhase;
  readonly contract: Contract | null;
  readonly tricks: readonly CompletedTrick[];
  readonly currentTrick: { readonly leader: Seat; readonly cards: readonly PlayedCard[] } | null;
  readonly tricksWon: { readonly declarers: number; readonly defenders: number };
  readonly clinch: Clinch | null;
  readonly playingOn: boolean;
  readonly concession: PendingConcession | null;
  readonly result: DealResult | null;
}

export type DealAction =
  | { type: 'call'; seat: Seat; call: Call }
  | { type: 'play'; seat: Seat; card: Card }
  | { type: 'playOn'; seat: Seat }
  | { type: 'endAtClinch' }
  | { type: 'proposeConcession'; seat: Seat }
  | { type: 'acceptConcession'; seat: Seat }
  | { type: 'declineConcession'; seat: Seat }
  | { type: 'expireConcession' };

export type DealEvent =
  | { type: 'callMade'; seat: Seat; call: Call }
  | { type: 'contractSet'; contract: Contract; declarerTarget: number; defenderTarget: number; openingLeader: Seat }
  | { type: 'passedOut' }
  | { type: 'cardPlayed'; seat: Seat; card: Card }
  | { type: 'trickWon'; trickNumber: number; winner: Seat; card: Card; side: Side; tricksWon: DealState['tricksWon'] }
  | { type: 'clinched'; clinch: Clinch }
  | { type: 'playOnChosen'; seat: Seat }
  | { type: 'concessionProposed'; seat: Seat; side: Side }
  | { type: 'concessionDeclined'; seat: Seat }
  | { type: 'concessionExpired' }
  | { type: 'concessionCancelled' }
  | { type: 'dealComplete'; result: DealResult };

type DealOutcome = Outcome<DealState, DealEvent>;

export function newDeal(seed: Seed, dealer: Seat): DealState {
  return newDealWithHands(dealHands(seed, dealer), dealer, seed);
}

/** For tests and replays: start a deal from known hands. */
export function newDealWithHands(hands: PerSeat<readonly Card[]>, dealer: Seat, seed: Seed | null = null): DealState {
  const count = hands[0].length + hands[1].length + hands[2].length + hands[3].length;
  if (count !== 52 || [0, 1, 2, 3].some((s) => hands[s as Seat].length !== 13)) {
    throw new Error('A deal needs 13 cards per seat');
  }
  return {
    seed,
    dealer,
    originalHands: hands,
    hands,
    auction: newAuction(dealer),
    phase: 'auction',
    contract: null,
    tricks: [],
    currentTrick: null,
    tricksWon: { declarers: 0, defenders: 0 },
    clinch: null,
    playingOn: false,
    concession: null,
    result: null,
  };
}

export function sideOf(seat: Seat, contract: Contract): Side {
  return seat === contract.declarer || seat === partner(contract.declarer) ? 'declarers' : 'defenders';
}

/** Whose turn it is to call or play, or null when nobody is due to act. */
export function seatToAct(state: DealState): Seat | null {
  if (state.phase === 'auction') {
    const status = auctionStatus(state.auction);
    return status.kind === 'open' ? status.turn : null;
  }
  if (state.phase !== 'play' || !state.currentTrick) return null;
  let seat = state.currentTrick.leader;
  for (let i = 0; i < state.currentTrick.cards.length; i++) seat = next(seat);
  return seat;
}

export function applyDealAction(state: DealState, action: DealAction): DealOutcome {
  switch (action.type) {
    case 'call':
      return applyCall(state, action.seat, action.call);
    case 'play':
      return applyPlay(state, action.seat, action.card);
    case 'playOn':
      return applyPlayOn(state, action.seat);
    case 'endAtClinch':
      return applyEndAtClinch(state);
    case 'proposeConcession':
      return applyProposeConcession(state, action.seat);
    case 'acceptConcession':
      return applyAcceptConcession(state, action.seat);
    case 'declineConcession':
      return applyDeclineConcession(state, action.seat);
    case 'expireConcession':
      return applyExpireConcession(state);
  }
}

function applyCall(state: DealState, seat: Seat, call: Call): DealOutcome {
  if (state.phase !== 'auction') return fail('NOT_AUCTION', 'The auction is over.');
  if (seatToAct(state) !== seat) return fail('NOT_YOUR_TURN', 'It is not your turn to call.');
  if (!isLegalCall(state.auction, call)) return fail('ILLEGAL_CALL', 'That bid does not outrank the last bid.');

  const auction: AuctionState = { ...state.auction, calls: [...state.auction.calls, { seat, call }] };
  const events: DealEvent[] = [{ type: 'callMade', seat, call }];
  const status = auctionStatus(auction);

  if (status.kind === 'open') return { ok: true, state: { ...state, auction }, events };
  if (status.kind === 'passedOut') {
    events.push({ type: 'passedOut' });
    return { ok: true, state: { ...state, auction, phase: 'passedOut' }, events };
  }

  const { contract } = status;
  // House rule R4: the player on declarer's right (the next seat counter-clockwise) leads.
  const openingLeader = next(contract.declarer);
  events.push({
    type: 'contractSet',
    contract,
    declarerTarget: declarerTarget(contract.level),
    defenderTarget: defenderTarget(contract.level),
    openingLeader,
  });
  return {
    ok: true,
    state: { ...state, auction, phase: 'play', contract, currentTrick: { leader: openingLeader, cards: [] } },
    events,
  };
}

function applyPlay(state: DealState, seat: Seat, card: Card): DealOutcome {
  if (state.phase !== 'play' || !state.contract || !state.currentTrick) {
    return fail('NOT_PLAYING', 'Cards cannot be played right now.');
  }
  if (seatToAct(state) !== seat) return fail('NOT_YOUR_TURN', 'It is not your turn to play.');
  const hand = state.hands[seat];
  if (!hand.some((c) => sameCard(c, card))) return fail('NOT_IN_HAND', 'That card is not in your hand.');
  if (!isLegalPlay(hand, state.currentTrick.cards, card)) {
    return fail('MUST_FOLLOW_SUIT', 'You must follow the suit led.');
  }

  const contract = state.contract;
  const hands = perSeat((s) => (s === seat ? hand.filter((c) => !sameCard(c, card)) : state.hands[s]));
  const cards = [...state.currentTrick.cards, { seat, card }];
  const events: DealEvent[] = [{ type: 'cardPlayed', seat, card }];

  if (cards.length < 4) {
    return { ok: true, state: { ...state, hands, currentTrick: { leader: state.currentTrick.leader, cards } }, events };
  }

  // The trick is complete.
  const win = winningPlay(cards, trumpSuit(contract.strain));
  const trick: CompletedTrick = { leader: state.currentTrick.leader, cards, winner: win.seat, winningCard: win.card };
  const tricks = [...state.tricks, trick];
  const side = sideOf(win.seat, contract);
  const tricksWon = { ...state.tricksWon, [side]: state.tricksWon[side] + 1 };
  events.push({ type: 'trickWon', trickNumber: tricks.length, winner: win.seat, card: win.card, side, tricksWon });

  let updated: DealState = { ...state, hands, tricks, tricksWon, currentTrick: { leader: win.seat, cards: [] } };

  if (!state.clinch) {
    const settled =
      tricksWon.declarers >= declarerTarget(contract.level)
        ? 'declarers'
        : tricksWon.defenders >= defenderTarget(contract.level)
          ? 'defenders'
          : null;
    if (settled) {
      const clinch: Clinch = { side: settled, trickNumber: tricks.length, card: win.card, seat: win.seat };
      events.push({ type: 'clinched', clinch });
      if (state.concession) events.push({ type: 'concessionCancelled' });
      updated = { ...updated, clinch, concession: null };
      if (tricks.length === 13) return complete(updated, events, true);
      return { ok: true, state: { ...updated, phase: 'awaitingPlayOn', currentTrick: null }, events };
    }
  }

  if (tricks.length === 13) return complete(updated, events, true);
  return { ok: true, state: updated, events };
}

function applyPlayOn(state: DealState, seat: Seat): DealOutcome {
  if (state.phase !== 'awaitingPlayOn') return fail('NO_CLINCH_CHOICE', 'There is nothing to play on from.');
  const leader = state.tricks[state.tricks.length - 1]!.winner;
  return {
    ok: true,
    state: { ...state, phase: 'play', playingOn: true, currentTrick: { leader, cards: [] } },
    events: [{ type: 'playOnChosen', seat }],
  };
}

function applyEndAtClinch(state: DealState): DealOutcome {
  if (state.phase !== 'awaitingPlayOn') return fail('NO_CLINCH_CHOICE', 'There is no clinch choice open.');
  return complete(state, [], false);
}

function complete(state: DealState, events: DealEvent[], playedOut: boolean): DealOutcome {
  const contract = state.contract!;
  const clinch = state.clinch!;
  const result: DealResult = {
    winner: clinch.side,
    reason: clinch.side === 'declarers' ? 'made' : 'defeated',
    declarerTricks: state.tricksWon.declarers,
    defenderTricks: state.tricksWon.defenders,
    playedOut,
    overUnder: playedOut ? state.tricksWon.declarers - declarerTarget(contract.level) : null,
  };
  events.push({ type: 'dealComplete', result });
  return { ok: true, state: { ...state, phase: 'complete', currentTrick: null, concession: null, result }, events };
}

function applyProposeConcession(state: DealState, seat: Seat): DealOutcome {
  // Concessions are only possible while the result is still open (S04).
  if (state.phase !== 'play' || state.clinch || !state.contract) {
    return fail('CANNOT_CONCEDE', 'You can only concede during play, before the deal is decided.');
  }
  if (state.concession) return fail('CONCESSION_PENDING', 'A concession is already waiting for an answer.');
  const side = sideOf(seat, state.contract);
  return {
    ok: true,
    state: { ...state, concession: { by: seat, side } },
    events: [{ type: 'concessionProposed', seat, side }],
  };
}

function applyAcceptConcession(state: DealState, seat: Seat): DealOutcome {
  const pending = state.concession;
  if (!pending) return fail('NO_CONCESSION', 'There is no concession to accept.');
  if (seat !== partner(pending.by)) return fail('NOT_PARTNER', "Only the proposer's partner can accept.");
  const winner: Side = pending.side === 'declarers' ? 'defenders' : 'declarers';
  const result: DealResult = {
    winner,
    reason: 'conceded',
    declarerTricks: state.tricksWon.declarers,
    defenderTricks: state.tricksWon.defenders,
    playedOut: false,
    overUnder: null,
  };
  return {
    ok: true,
    state: { ...state, phase: 'complete', currentTrick: null, concession: null, result },
    events: [{ type: 'dealComplete', result }],
  };
}

function applyDeclineConcession(state: DealState, seat: Seat): DealOutcome {
  const pending = state.concession;
  if (!pending) return fail('NO_CONCESSION', 'There is no concession to decline.');
  if (seat !== partner(pending.by)) return fail('NOT_PARTNER', "Only the proposer's partner can decline.");
  return { ok: true, state: { ...state, concession: null }, events: [{ type: 'concessionDeclined', seat }] };
}

function applyExpireConcession(state: DealState): DealOutcome {
  if (!state.concession) return fail('NO_CONCESSION', 'There is no concession to expire.');
  return { ok: true, state: { ...state, concession: null }, events: [{ type: 'concessionExpired' }] };
}
