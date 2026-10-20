import { next } from './seats';
import { LEVELS, STRAINS, type Call, type Contract, type Level, type Seat, type Strain } from './types';

// Spec S02. Bidding starts with the dealer and goes counter-clockwise (house rule R3).

export interface AuctionCall {
  readonly seat: Seat;
  readonly call: Call;
}

export interface AuctionState {
  readonly dealer: Seat;
  readonly calls: readonly AuctionCall[];
}

export type AuctionStatus =
  | { kind: 'open'; turn: Seat }
  | { kind: 'contract'; contract: Contract }
  | { kind: 'passedOut' };

export const PASS: Call = { type: 'pass' };

export function bid(level: Level, strain: Strain): Call {
  return { type: 'bid', level, strain };
}

/** Bids ordered 1♣ (0) … 7NT (34). */
export function bidRank(level: Level, strain: Strain): number {
  return (level - 1) * STRAINS.length + STRAINS.indexOf(strain);
}

export function newAuction(dealer: Seat): AuctionState {
  return { dealer, calls: [] };
}

export function lastBid(auction: AuctionState): (AuctionCall & { call: { type: 'bid' } }) | null {
  for (let i = auction.calls.length - 1; i >= 0; i--) {
    const entry = auction.calls[i]!;
    if (entry.call.type === 'bid') return entry as AuctionCall & { call: { type: 'bid' } };
  }
  return null;
}

export function auctionStatus(auction: AuctionState): AuctionStatus {
  const { calls } = auction;
  const last = lastBid(auction);
  if (!last) {
    if (calls.length >= 4) return { kind: 'passedOut' };
  } else {
    const passesAfterBid = calls.length - 1 - calls.lastIndexOf(last);
    if (passesAfterBid >= 3) {
      const { level, strain } = last.call;
      return { kind: 'contract', contract: { level, strain, declarer: last.seat } };
    }
  }
  let turn = auction.dealer;
  for (let i = 0; i < calls.length; i++) turn = next(turn);
  return { kind: 'open', turn };
}

/** Every call the player to act may make: Pass plus every bid above the last one. */
export function legalCalls(auction: AuctionState): Call[] {
  if (auctionStatus(auction).kind !== 'open') return [];
  const last = lastBid(auction);
  const floor = last ? bidRank(last.call.level, last.call.strain) : -1;
  const calls: Call[] = [PASS];
  for (const level of LEVELS) {
    for (const strain of STRAINS) {
      if (bidRank(level, strain) > floor) calls.push(bid(level, strain));
    }
  }
  return calls;
}

export function isLegalCall(auction: AuctionState, call: Call): boolean {
  return legalCalls(auction).some(
    (c) => c.type === call.type && (c.type === 'pass' || (call.type === 'bid' && c.level === call.level && c.strain === call.strain)),
  );
}

/** Tricks declarers need to make the contract. */
export function declarerTarget(level: Level): number {
  return 6 + level;
}

/** Tricks defenders need to defeat the contract (13 − declarerTarget + 1). */
export function defenderTarget(level: Level): number {
  return 8 - level;
}
