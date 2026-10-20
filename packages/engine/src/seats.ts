import type { PerSeat, Seat } from './types';

export const SEATS: readonly Seat[] = [0, 1, 2, 3];

/**
 * The next seat counter-clockwise: the seat on `s`'s right.
 *
 * This is the ONLY place in the codebase that encodes table direction (spec S01).
 * Dealer rotation, bidding order, the opening lead and play order all go through it.
 */
export function next(s: Seat): Seat {
  return ((s + 1) % 4) as Seat;
}

export function partner(s: Seat): Seat {
  return next(next(s));
}

/** The four seats in counter-clockwise order, starting with `start`. */
export function seatsFrom(start: Seat): [Seat, Seat, Seat, Seat] {
  const a = next(start);
  const b = next(a);
  return [start, a, b, next(b)];
}

export function perSeat<T>(make: (s: Seat) => T): PerSeat<T> {
  return { 0: make(0), 1: make(1), 2: make(2), 3: make(3) };
}
