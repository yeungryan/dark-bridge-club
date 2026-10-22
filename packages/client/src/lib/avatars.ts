import { ELEMENT_INFO, type Avatar, type ProfileId, type Seat } from '@dark/engine';
import type { Connection } from './connection.svelte';
import type { Element } from './juice/particles';

// Spec S24 helpers for the screens: who is which animal tonight (once revealed).

type Link = Pick<Connection, 'view' | 'room'>;

export function avatarOf(conn: Link, profile: ProfileId | undefined | null): Avatar | null {
  return (profile && conn.room?.avatars?.[profile]) || null;
}

export function avatarAtSeat(conn: Link, seat: Seat): Avatar | null {
  return avatarOf(conn, conn.view?.seating?.[seat]);
}

export function elementAtSeat(conn: Link, seat: Seat): Element | null {
  return avatarAtSeat(conn, seat)?.element ?? null;
}

export const glyphOf = (a: Avatar | null) => (a ? ELEMENT_INFO[a.element].glyph : '');

export type Team = 'red' | 'black';

/** Team Red is the pair Ryan sits in (Ryan: Adrian & Ryan are Team Red), the same on every phone. */
export const RED_ANCHOR: ProfileId = 'ryan';

/** Which team a seat is on, given the night's seating (without Ryan seated, your own pair is red). */
export function teamFor(seating: Readonly<Record<Seat, ProfileId>> | null | undefined, seat: Seat, fallback: Seat): Team {
  const anchor = seating ? ([0, 1, 2, 3] as Seat[]).find((s) => seating[s] === RED_ANCHOR) : undefined;
  return (seat - (anchor ?? fallback)) % 2 === 0 ? 'red' : 'black';
}

/**
 * During play, colour means partnership (Ryan): Team Red and Team Black, like the cards' suits.
 * Gold is kept for winning and leading. Personal colours stay for the lobby, crest and history.
 */
export function teamOf(conn: Link, seat: Seat): Team {
  return teamFor(conn.view?.seating, seat, conn.view?.mySeat ?? 0);
}

export const TEAM_COLOR: Record<Team, string> = { red: 'var(--team-red)', black: 'var(--team-black)' };

export const teamColor = (conn: Link, seat: Seat): string => TEAM_COLOR[teamOf(conn, seat)];

/** The outline Team Black's shapes wear on dark panels, so they don't vanish (none for red). */
export const rimFor = (team: Team): string | null => (team === 'black' ? 'rgba(255, 255, 255, 0.9)' : null);

/** Element ring colours for badges and cards. */
/** Each element's primary colour (Ryan): red fire, yellow air, blue water, green earth. */
export const ELEMENT_RING: Record<Element, string> = {
  fire: '#e53935',
  air: '#f5c518',
  water: '#1e88e5',
  earth: '#43a047',
};
