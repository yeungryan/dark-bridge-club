import { seatToAct } from './deal';
import type { SessionState } from './session';
import type { PerSeat, Seat } from './types';

// Spec S19 ("That's 10 Dollars"): how long each player spends thinking, per game. The clock
// runs for whoever is due to call or play; it stops while the table is paused, and one very
// long turn counts as at most MAX_TURN_MS (someone stepping away isn't thinking).

export const MAX_TURN_MS = 3 * 60_000;

export interface ThinkClock {
  /** The game these totals belong to. */
  readonly dealNumber: number;
  /** Whose turn is being timed, and since when (null while nobody's or while paused). */
  readonly turn: Seat | null;
  readonly since: number | null;
  /** Thinking time so far this game, per seat, in ms. */
  readonly totals: PerSeat<number>;
}

export function newThinkClock(dealNumber = 0): ThinkClock {
  return { dealNumber, turn: null, since: null, totals: { 0: 0, 1: 0, 2: 0, 3: 0 } };
}

/**
 * Call after every change to the table (a move, a pause or resume, a new game). Credits the
 * turn that just ended, then starts timing whoever is due to act now.
 */
export function tickThinkClock(clock: ThinkClock, session: SessionState, paused: boolean, now: number): ThinkClock {
  // A new game starts its own totals (the old game's were saved when it finished).
  const base = session.dealNumber === clock.dealNumber ? clock : newThinkClock(session.dealNumber);
  let totals = base.totals;
  if (base === clock && clock.turn !== null && clock.since !== null) {
    const spent = Math.max(0, Math.min(MAX_TURN_MS, now - clock.since));
    totals = { ...totals, [clock.turn]: totals[clock.turn] + spent };
  }
  const deal = session.phase === 'inDeal' ? session.deal : null;
  const turn = deal && !paused ? seatToAct(deal) : null;
  // Time so far is credited above, so the clock always restarts now (never counted twice).
  return { dealNumber: base.dealNumber, turn, since: turn === null ? null : now, totals };
}
