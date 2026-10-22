import {
  declarerTarget,
  defenderTarget,
  type AuctionCall,
  type Card,
  type CompletedTrick,
  type Contract,
  type PerSeat,
  type ProfileId,
  type ProfileInfo,
  type SavedGameDetail,
  type Seat,
  type ThemeId,
} from '@dark/engine';
import { avatarAtSeat, TEAM_COLOR, teamFor, teamOf, type Team } from './avatars';
import type { Connection } from './connection.svelte';
import { nameAtSeat, profileOf } from './format';

/** Everything the replay screen shows, whether tonight's game or one from history (S20). */
export interface ReplayGame {
  readonly title: string;
  readonly contract: Contract;
  readonly calls: readonly AuctionCall[];
  readonly dealt: PerSeat<readonly Card[]>;
  readonly tricks: readonly CompletedTrick[];
  /** The seat drawn at the bottom (yours, if you played). */
  readonly me: Seat;
  readonly theme: ThemeId;
  name(seat: Seat): string;
  animal(seat: Seat): string | null;
  /** Team Red (Ryan's pair) or Team Black, as a colour and by name. */
  color(seat: Seat): string;
  team(seat: Seat): Team;
}

/** The game just finished at the table. */
export function liveReplay(conn: Connection): ReplayGame {
  const view = conn.view!;
  const deal = view.deal!;
  const profiles = conn.room!.profiles;
  return {
    title: `Game ${view.dealNumber}`,
    contract: deal.contract!,
    calls: deal.calls,
    dealt: deal.revealedHands!,
    tricks: deal.playedTricks ?? [],
    me: view.mySeat!,
    theme: conn.room!.theme,
    name: (seat) => nameAtSeat(view, profiles, seat),
    animal: (seat) => avatarAtSeat(conn, seat)?.animal ?? null,
    color: (seat) => TEAM_COLOR[teamOf(conn, seat)],
    team: (seat) => teamOf(conn, seat),
  };
}

/** A saved game from history, seen from `viewer`'s seat that night, in tonight's `theme` (the
 *  page's colours are tonight's, so its scene is too). */
export function savedReplay(detail: SavedGameDetail, viewer: ProfileId | null, profiles: readonly ProfileInfo[], theme: ThemeId): ReplayGame {
  const { night, game } = detail;
  const seating = night.seating;
  const seatOf = (id: ProfileId | null) => (seating && id ? (([0, 1, 2, 3] as Seat[]).find((s) => seating[s] === id) ?? null) : null);
  const me = seatOf(viewer) ?? 0;
  const profileAt = (seat: Seat) => seating?.[seat];
  return {
    title: `Game ${game.dealNumber}`,
    contract: game.contract!,
    calls: detail.calls,
    dealt: detail.hands,
    tricks: detail.tricks,
    me,
    theme,
    name: (seat) => profileOf(profiles, profileAt(seat)).name,
    animal: (seat) => night.avatars?.[profileAt(seat) ?? '']?.animal ?? null,
    color: (seat) => TEAM_COLOR[teamFor(seating, seat, me)],
    team: (seat) => teamFor(seating, seat, me),
  };
}

export const targetsOf = (contract: Contract) => ({ declarers: declarerTarget(contract.level), defenders: defenderTarget(contract.level) });
