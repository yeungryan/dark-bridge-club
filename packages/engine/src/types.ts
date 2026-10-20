// Core vocabulary shared by every part of the engine.

/** Suits in bidding rank order, lowest first. */
export type Suit = 'C' | 'D' | 'H' | 'S';
export const SUITS: readonly Suit[] = ['C', 'D', 'H', 'S'];

/** 2..10, then J=11, Q=12, K=13, A=14. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

/** Seats are numbered in counter-clockwise order; see seats.ts. */
export type Seat = 0 | 1 | 2 | 3;

/** One value per seat, indexable by Seat without undefined checks. */
export type PerSeat<T> = { 0: T; 1: T; 2: T; 3: T };

/** Strains in bidding rank order, lowest first. */
export type Strain = Suit | 'NT';
export const STRAINS: readonly Strain[] = ['C', 'D', 'H', 'S', 'NT'];

export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5, 6, 7];

/** House rules: only bids and passes. No double or redouble. */
export type Call = { type: 'pass' } | { type: 'bid'; level: Level; strain: Strain };

export interface Contract {
  readonly level: Level;
  readonly strain: Strain;
  /** House rule R4: the seat that made the final bid. */
  readonly declarer: Seat;
}

export type Side = 'declarers' | 'defenders';

export interface EngineError {
  readonly code: string;
  readonly message: string;
}

export type Outcome<S, E> =
  | { ok: true; state: S; events: E[] }
  | { ok: false; error: EngineError };

export function fail<S, E>(code: string, message: string): Outcome<S, E> {
  return { ok: false, error: { code, message } };
}
