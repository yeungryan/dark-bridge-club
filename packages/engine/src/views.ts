import { declarerTarget, defenderTarget, legalCalls, type AuctionCall } from './auction';
import { seatToAct, type Clinch, type DealPhase, type DealResult, type PendingConcession } from './deal';
import { legalPlays, trumpSuit, type CompletedTrick, type PlayedCard } from './play';
import { perSeat } from './seats';
import { seatOf, type NightResult, type PairId, type ProfileId, type SessionPhase, type SessionState } from './session';
import type { Call, Card, Contract, PerSeat, Seat } from './types';

// Spec S06: what one player is allowed to see. The server sends only this, never SessionState.
// - Other players' cards are never included until the deal is complete (the reveal, S14).
// - Only the most recent completed trick is included (R8: card memory is a skill), until the
//   deal is complete: then every trick is included for the replay, alongside the revealed hands.
// - Seeds are never included (they would let a client recompute every hand).

export interface DealView {
  readonly phase: DealPhase;
  readonly dealer: Seat;
  readonly calls: readonly AuctionCall[];
  readonly contract: Contract | null;
  readonly declarerTarget: number | null;
  readonly defenderTarget: number | null;
  /** Whose turn it is to call or play, if anyone's. */
  readonly turn: Seat | null;
  /** Your own remaining cards. */
  readonly hand: readonly Card[];
  readonly handCounts: PerSeat<number>;
  readonly currentTrick: { readonly leader: Seat; readonly cards: readonly PlayedCard[] } | null;
  readonly lastTrick: CompletedTrick | null;
  readonly tricksPlayed: number;
  readonly tricksWon: { readonly declarers: number; readonly defenders: number };
  /** Tricks so far won by a trump card (public: everyone saw them played). Drives "first trump" (S16). */
  readonly trumpTricksWon: number;
  /** Who won each trick so far, in order (public: everyone saw them). Drives the scoreboard's silhouettes. */
  readonly trickWinners: readonly Seat[];
  readonly clinch: Clinch | null;
  readonly playingOn: boolean;
  readonly concession: PendingConcession | null;
  readonly result: DealResult | null;
  /** Your legal options, only when it is your turn. */
  readonly legalCalls: readonly Call[];
  readonly legalPlays: readonly Card[];
  /** All four original hands, only once the deal is complete. */
  readonly revealedHands: PerSeat<readonly Card[]> | null;
  /** Every trick in order, only once the deal is complete (the replay). */
  readonly playedTricks: readonly CompletedTrick[] | null;
}

export interface TableView {
  readonly me: ProfileId;
  readonly mySeat: Seat | null;
  readonly phase: SessionPhase;
  readonly profiles: readonly ProfileId[];
  readonly captain: ProfileId | null;
  readonly suggestedPartner: ProfileId | null;
  readonly pairs: Readonly<Record<PairId, readonly [ProfileId, ProfileId]>> | null;
  readonly seating: PerSeat<ProfileId> | null;
  readonly dealNumber: number;
  readonly wins: Readonly<Record<PairId, number>>;
  readonly passOuts: number;
  readonly readyForNext: readonly ProfileId[];
  readonly endNightVotes: readonly ProfileId[];
  readonly final: NightResult | null;
  readonly deal: DealView | null;
}

export function tableView(state: SessionState, me: ProfileId): TableView {
  const mySeat = seatOf(state, me);
  return {
    me,
    mySeat,
    phase: state.phase,
    profiles: state.config.profiles,
    captain: state.captain,
    suggestedPartner: state.suggestedPartner,
    pairs: state.pairs,
    seating: state.seating,
    dealNumber: state.dealNumber,
    wins: state.wins,
    passOuts: state.passOuts,
    readyForNext: state.readyForNext,
    endNightVotes: state.endNightVotes,
    final: state.final,
    deal: state.deal ? dealView(state, mySeat) : null,
  };
}

function dealView(state: SessionState, mySeat: Seat | null): DealView {
  const deal = state.deal!;
  const turn = seatToAct(deal);
  const myTurn = mySeat !== null && turn === mySeat;
  const contract = deal.contract;
  return {
    phase: deal.phase,
    dealer: deal.dealer,
    calls: deal.auction.calls,
    contract,
    declarerTarget: contract ? declarerTarget(contract.level) : null,
    defenderTarget: contract ? defenderTarget(contract.level) : null,
    turn,
    hand: mySeat === null ? [] : deal.hands[mySeat],
    handCounts: perSeat((s) => deal.hands[s].length),
    currentTrick: deal.currentTrick,
    lastTrick: deal.tricks[deal.tricks.length - 1] ?? null,
    tricksPlayed: deal.tricks.length,
    tricksWon: deal.tricksWon,
    trickWinners: deal.tricks.map((t) => t.winner),
    trumpTricksWon: contract ? deal.tricks.filter((t) => t.winningCard.suit === trumpSuit(contract.strain)).length : 0,
    clinch: deal.clinch,
    playingOn: deal.playingOn,
    concession: deal.concession,
    result: deal.result,
    legalCalls: myTurn && deal.phase === 'auction' ? legalCalls(deal.auction) : [],
    legalPlays: myTurn && deal.phase === 'play' ? legalPlays(deal.hands[mySeat], deal.currentTrick!.cards) : [],
    revealedHands: deal.phase === 'complete' ? deal.originalHands : null,
    playedTricks: deal.phase === 'complete' ? deal.tricks : null,
  };
}
