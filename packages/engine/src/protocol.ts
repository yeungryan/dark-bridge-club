// Spec S06: messages between a browser and the table server. Types only.
import type { PlayerDealAction, ProfileId, SessionEvent } from './session';
import type { TableView } from './views';

/** What a player may ask for; the server fills in who sent it. */
export type ClientIntent =
  | { type: 'pickPartner'; partner: ProfileId }
  | { type: 'deal'; action: PlayerDealAction }
  | { type: 'readyForNext' }
  | { type: 'voteEndNight' }
  | { type: 'cancelEndNight' };

export type ClientMessage =
  | { type: 'intent'; intent: ClientIntent }
  /** Ask for a full resend, e.g. after spotting a gap in `seq`. */
  | { type: 'snapshot' }
  /** After a night has ended: open a fresh lobby. */
  | { type: 'newNight' };

export type Presence = 'connected' | 'reconnecting' | 'away';

export interface ProfileInfo {
  readonly id: ProfileId;
  readonly name: string;
  readonly color: string;
}

export interface RoomInfo {
  readonly profiles: readonly ProfileInfo[];
  readonly presence: Readonly<Record<ProfileId, Presence>>;
  /** True while play is frozen because someone is away (S08). */
  readonly paused: boolean;
  /** Epoch ms when the night auto-closes if the away player doesn't return (R13). */
  readonly autoCloseAt: number | null;
  /** Epoch ms when the "Play it out?" window closes (R11). */
  readonly clinchDeadline: number | null;
  /** Epoch ms when a pending concession expires (S04). */
  readonly concessionDeadline: number | null;
  /** The server's clock, so countdowns are correct even if a phone's clock is off. */
  readonly serverTime: number;
}

/** Session events with anything secret (deal seeds) removed. */
export type PublicEvent = SessionEvent;

export type ServerMessage =
  | { type: 'state'; seq: number; view: TableView; room: RoomInfo; events: readonly PublicEvent[] }
  | { type: 'error'; code: string; message: string }
  /** This profile connected from another device; this one should stop. */
  | { type: 'replaced' };
