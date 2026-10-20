import type { DealResult } from './deal';
import type { CompletedTrick } from './play';
import type { PairId, ProfileId } from './session';
import type { Card, Contract, PerSeat, Seat } from './types';

// Spec S19: moments (per game) and awards (per night), calculated only from saved history,
// so they can be re-run on old nights and always give the same answer.

/** One finished (or passed-out) game, as saved in the `deals` table. */
export interface DealHistory {
  readonly dealNumber: number;
  readonly dealer: Seat;
  /** null for a pass-out. */
  readonly contract: Contract | null;
  readonly result: DealResult | null;
  /** The hands as dealt; null if not saved. */
  readonly hands: PerSeat<readonly Card[]> | null;
  /** Every completed set, in order; null if not saved. */
  readonly tricks: readonly CompletedTrick[] | null;
  /** Total thinking time per seat in this game, in ms (M3+); null for older games. */
  readonly thinkMs: PerSeat<number> | null;
}

/** A whole night: who sat where, the pairs, and its games in order. */
export interface NightHistory {
  readonly seating: PerSeat<ProfileId>;
  readonly pairs: Readonly<Record<PairId, readonly [ProfileId, ProfileId]>>;
  readonly deals: readonly DealHistory[];
}

export type MomentKind =
  | 'grandAmbition'
  | 'robbery'
  | 'heartbreak'
  | 'decider'
  | 'trumpCard'
  | 'yarborough'
  | 'powerhouseBenched'
  | 'comebackNight'
  | 'streak';

export interface Moment {
  readonly kind: MomentKind;
  /** The game it happened in (for night-level moments: the game that completed it). */
  readonly dealNumber: number;
  /** The players it's about, as profile ids (never seats: captions must never misattribute). */
  readonly players: readonly ProfileId[];
  /** Numbers the caption or the award ranking needs, e.g. { level: 6 } or { hcpGap: 7 }. */
  readonly payload: Readonly<Record<string, number | string>>;
}

export type AwardKind =
  | 'mvp'
  | 'wall'
  | 'daredevil'
  | 'heist'
  | 'heartbreakHotel'
  | 'epicAttic'
  | 'blogAboutIt'
  | 'bannerMoment'
  | 'tenDollars';

export interface Award {
  readonly kind: AwardKind;
  /** Who earned it. */
  readonly profile: ProfileId;
  /** How strongly it was earned (used to choose and order the awards shown). */
  readonly score: number;
  /** Numbers for the caption, e.g. { tricksShort: 4, contract: '4♠' } or { minutes: 12 }. */
  readonly payload: Readonly<Record<string, number | string>>;
}
