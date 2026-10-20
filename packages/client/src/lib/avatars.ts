import { animalById, ELEMENT_INFO, type Avatar, type ProfileId, type Seat } from '@dark/engine';
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

export const emojiOf = (a: Avatar | null) => (a ? (animalById(a.animal)?.emoji ?? '') : '');
export const glyphOf = (a: Avatar | null) => (a ? ELEMENT_INFO[a.element].glyph : '');

/**
 * During play, colour means partnership (Ryan's call): your pair wears the theme's accent,
 * the other pair silver. Personal colours stay for the lobby, crest and history.
 */
export function teamColor(conn: Link, seat: Seat): string {
  const me = conn.view?.mySeat;
  return me !== null && me !== undefined && (seat - me) % 2 === 0 ? 'var(--accent)' : 'var(--silver)';
}

/** Element ring colours for badges and cards. */
export const ELEMENT_RING: Record<Element, string> = {
  fire: '#ff7a2f',
  air: '#f4e7a1',
  water: '#2fa7d6',
  earth: '#8a9a4b',
};
