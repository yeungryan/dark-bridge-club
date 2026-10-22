import { matchupKey, type ScoreOverride } from './historyChanges';
import { addPicks, addStats, pickCounts, playerStats, type PickCount, type PlayerStats } from './playerStats';
import { headToHead, pairKey, type SavedGame, type SavedNight } from './rivalry';
import type { ProfileId } from './session';

// Ryan: history keeps the last KEEP_GAMES games in full (replays, the night log); older games are
// deleted, but first their numbers are added to these totals, so every all-time stat (player
// cards, the leaderboard, award counts, the head-to-head and the lobby's score) keeps stacking.
// Like a bank statement: old lines drop off, the balance carries forward. Each game counts exactly
// once, from its saved record while it's kept and from here after, so nothing can drift.
//
// A game's own numbers are carried when it's deleted; its night's (nights played and won, awards,
// the animal picked) when the night's last game goes with it.

export const KEEP_GAMES = 300;

export interface CarriedMatchup {
  /** Nights and games won, by pairKey. */
  readonly wins: Readonly<Record<string, { readonly nightsWon: number; readonly gamesWon: number }>>;
  /** Finished nights this way round. */
  readonly nights: number;
  readonly lastPlayed: number | null;
}

export interface Carried {
  /** How many games have been carried forward (and deleted). */
  readonly games: number;
  readonly players: Readonly<Record<ProfileId, PlayerStats>>;
  /** By matchupKey. */
  readonly matchups: Readonly<Record<string, CarriedMatchup>>;
  readonly animals: Readonly<Record<ProfileId, Readonly<Record<string, PickCount>>>>;
  readonly elements: Readonly<Record<ProfileId, Readonly<Record<string, PickCount>>>>;
}

export const emptyCarried = (): Carried => ({ games: 0, players: {}, matchups: {}, animals: {}, elements: {} });

/**
 * The totals with some of a night's games added, and, when `wholeNight`, the night itself (it's
 * being deleted with them). A matchup whose score the four of you set by hand only takes nights
 * begun after that, as on the head-to-head board.
 */
export function carryForward(
  carried: Carried,
  profiles: readonly ProfileId[],
  night: SavedNight,
  games: readonly SavedGame[],
  wholeNight: boolean,
  overrides: readonly ScoreOverride[],
): Carried {
  // Just these games, and the night's own numbers only if it's going too.
  const part: SavedNight = { ...night, games, final: wholeNight ? night.final : null, awards: wholeNight ? (night.awards ?? []) : [], topAward: null };

  const players: Record<ProfileId, PlayerStats> = { ...carried.players };
  for (const p of profiles) {
    const add = playerStats(p, profiles, [part]);
    players[p] = players[p] ? addStats(players[p]!, add) : add;
  }

  const matchups: Record<string, CarriedMatchup> = { ...carried.matchups };
  for (const m of headToHead(profiles, [part])) {
    if (m.lastPlayed === null) continue; // not this night's matchup
    const key = matchupKey(m.sides[0].players, m.sides[1].players);
    const old = matchups[key] ?? { wins: {}, nights: 0, lastPlayed: null };
    const set = overrides.find((o) => matchupKey(o.sides[0].players, o.sides[1].players) === key);
    const counts = !set || night.startedAt >= set.from;
    const wins = { ...old.wins };
    if (counts) {
      for (const side of m.sides) {
        const k = pairKey(side.players);
        const w = wins[k] ?? { nightsWon: 0, gamesWon: 0 };
        wins[k] = { nightsWon: w.nightsWon + side.nightsWon, gamesWon: w.gamesWon + side.gamesWon };
      }
    }
    matchups[key] = { wins, nights: old.nights + (counts ? m.nights : 0), lastPlayed: Math.max(old.lastPlayed ?? 0, m.lastPlayed) };
  }

  return {
    games: carried.games + games.length,
    players,
    matchups,
    animals: addPicks(pickCounts(profiles, [part], 'animal', wholeNight), carried.animals),
    elements: addPicks(pickCounts(profiles, [part], 'element', wholeNight), carried.elements),
  };
}

/** After the four of you set a matchup's score by hand: what was carried for it is part of the old score. */
export function withoutMatchup(carried: Carried, override: ScoreOverride): Carried {
  const key = matchupKey(override.sides[0].players, override.sides[1].players);
  const old = carried.matchups[key];
  if (!old) return carried;
  return { ...carried, matchups: { ...carried.matchups, [key]: { wins: {}, nights: 0, lastPlayed: old.lastPlayed } } };
}

/** The nights that count toward all-time stats: those begun since the last reset to 0–0. */
export function countedNights(nights: readonly SavedNight[], statsFrom: number | null): SavedNight[] {
  return statsFrom === null ? [...nights] : nights.filter((n) => n.startedAt >= statsFrom);
}
