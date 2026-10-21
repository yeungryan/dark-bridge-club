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

/**
 * During play, colour means partnership (Ryan's call): your pair wears the theme's accent,
 * the other pair silver. Personal colours stay for the lobby, crest and history.
 */
export function teamColor(conn: Link, seat: Seat): string {
  const me = conn.view?.mySeat;
  return me !== null && me !== undefined && (seat - me) % 2 === 0 ? 'var(--gold)' : 'var(--silver)';
}

/** Element ring colours for badges and cards. */
/** Each element's primary colour (Ryan): red fire, yellow air, blue water, green earth. */
export const ELEMENT_RING: Record<Element, string> = {
  fire: '#e53935',
  air: '#f5c518',
  water: '#1e88e5',
  earth: '#43a047',
};
