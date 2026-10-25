import type { Element } from './avatars';
import { gameWorth } from './deal';
import type { Carried } from './carried';
import type { AwardKind } from './moments';
import type { SavedAward, SavedGame, SavedNight } from './rivalry';
import { MIN_SAMPLE } from './rivalry';
import type { PairId, ProfileId } from './session';
import type { Level, Seat, Strain } from './types';

// Spec S20, the rest of history (Ryan's designs): player cards, the leaderboard, the award
// tracker, animal and element records, and the moments wall. Like rivalry.ts, every number is
// worked out from the saved nights each time, plus the totals carried forward from games old
// enough to have been deleted (carried.ts).

export interface WinLoss {
  readonly won: number;
  readonly lost: number;
}

export interface PlayerStats {
  readonly profile: ProfileId;
  /** Finished nights played, and when the first one was. */
  readonly nights: number;
  readonly since: number | null;
  /** Sets (tricks) won by your own card (Ryan, round 10: not your partner's), of all the sets
   *  played in your games. */
  readonly sets: { readonly won: number; readonly played: number };
  /** Games won by your pair, of the games played out or conceded (pass-outs aside). */
  readonly games: { readonly won: number; readonly played: number };
  /** As declarer only (your partner's contracts don't count): contracts made and lost. */
  readonly declaring: WinLoss;
  /** As one of the two defenders: contracts beaten and made against you. */
  readonly defending: WinLoss;
  /** Contracts you declared, by trump suit and by level (counts). */
  readonly strains: Readonly<Record<Strain, number>>;
  readonly levels: Readonly<Record<Level, number>>;
  /** Games with each partner: played and won. */
  readonly partners: readonly { readonly partner: ProfileId; readonly played: number; readonly won: number }[];
  /** How many of each award you've won. */
  readonly awards: Readonly<Partial<Record<AwardKind, number>>>;
}

const STRAIN_KEYS: Strain[] = ['C', 'D', 'H', 'S', 'NT'];
const LEVEL_KEYS: Level[] = [1, 2, 3, 4, 5, 6, 7];

const seatOf = (night: SavedNight, game: SavedGame, profile: ProfileId): Seat | null => {
  const seating = game.seating ?? night.seating;
  if (!seating) return null;
  return (([0, 1, 2, 3] as Seat[]).find((s) => seating[s] === profile) ?? null) as Seat | null;
};
const pairOf = (night: SavedNight, profile: ProfileId): PairId | null =>
  night.pairs.A.includes(profile) ? 'A' : night.pairs.B.includes(profile) ? 'B' : null;
const partnerIn = (night: SavedNight, profile: ProfileId): ProfileId | null => {
  const pair = pairOf(night, profile);
  return pair ? (night.pairs[pair].find((p) => p !== profile) ?? null) : null;
};

/** One player's card: their saved nights, plus what was carried forward from deleted ones. */
export function playerStats(profile: ProfileId, profiles: readonly ProfileId[], nights: readonly SavedNight[], carried?: Carried): PlayerStats {
  const own = countPlayer(profile, profiles, nights);
  const old = carried?.players[profile];
  return old ? addStats(own, old) : own;
}

/** Two sets of a player's numbers added together (`since` is the earlier of the two). */
export function addStats(a: PlayerStats, b: PlayerStats): PlayerStats {
  const wl = (x: WinLoss, y: WinLoss) => ({ won: x.won + y.won, lost: x.lost + y.lost });
  const wp = (x: { won: number; played: number }, y: { won: number; played: number }) => ({ won: x.won + y.won, played: x.played + y.played });
  const sum = <K extends string | number>(x: Readonly<Record<K, number>>, y: Readonly<Record<K, number>>) =>
    Object.fromEntries([...new Set([...Object.keys(x), ...Object.keys(y)])].map((k) => [k, (x[k as K] ?? 0) + (y[k as K] ?? 0)])) as Record<K, number>;
  const partners = new Map(a.partners.map((p) => [p.partner, { ...p }]));
  for (const p of b.partners) {
    const r = partners.get(p.partner);
    partners.set(p.partner, r ? { partner: p.partner, played: r.played + p.played, won: r.won + p.won } : { ...p });
  }
  return {
    profile: a.profile,
    nights: a.nights + b.nights,
    since: a.since === null ? b.since : b.since === null ? a.since : Math.min(a.since, b.since),
    sets: wp(a.sets, b.sets),
    games: wp(a.games, b.games),
    declaring: wl(a.declaring, b.declaring),
    defending: wl(a.defending, b.defending),
    strains: sum(a.strains, b.strains),
    levels: sum(a.levels, b.levels),
    partners: [...partners.values()],
    awards: sum(a.awards as Record<string, number>, b.awards as Record<string, number>) as Partial<Record<AwardKind, number>>,
  };
}

function countPlayer(profile: ProfileId, profiles: readonly ProfileId[], nights: readonly SavedNight[]): PlayerStats {
  let nightsPlayed = 0;
  let since: number | null = null;
  const sets = { won: 0, played: 0 };
  const games = { won: 0, played: 0 };
  const declaring = { won: 0, lost: 0 };
  const defending = { won: 0, lost: 0 };
  const strains = Object.fromEntries(STRAIN_KEYS.map((s) => [s, 0])) as Record<Strain, number>;
  const levels = Object.fromEntries(LEVEL_KEYS.map((l) => [l, 0])) as Record<Level, number>;
  const partners = new Map<ProfileId, { played: number; won: number }>(profiles.filter((p) => p !== profile).map((p) => [p, { played: 0, won: 0 }]));
  const awards: Partial<Record<AwardKind, number>> = {};

  for (const night of nights) {
    const pair = pairOf(night, profile);
    if (!pair) continue;
    if (night.final) {
      nightsPlayed++;
      since = Math.min(since ?? night.startedAt, night.startedAt);
    }
    for (const a of night.awards ?? []) if (a.profile === profile) awards[a.kind as AwardKind] = (awards[a.kind as AwardKind] ?? 0) + 1;
    const partner = partnerIn(night, profile);
    for (const g of night.games) {
      const seat = seatOf(night, g, profile);
      if (!g.winningPair) continue;
      const won = g.winningPair === pair;
      // A sweep counts as 10 games (a reverse one 100) for everyone at the table, won by the
      // sweepers and lost by the others, so win rates stay true (round 15).
      const worth = gameWorth(g.result);
      games.played += worth;
      if (won) games.won += worth;
      if (partner && partners.has(partner)) {
        const rec = partners.get(partner)!;
        rec.played += worth;
        if (won) rec.won += worth;
      }
      if (seat === null || !g.contract || !g.result) continue;
      const declarerSide = seat % 2 === g.contract.declarer % 2;
      sets.won += g.setsBySeat?.[seat] ?? 0;
      sets.played += g.result.declarerTricks + g.result.defenderTricks;
      if (seat === g.contract.declarer) {
        strains[g.contract.strain]++;
        levels[g.contract.level]++;
        if (g.result.winner === 'declarers') declaring.won++;
        else declaring.lost++;
      } else if (!declarerSide) {
        if (g.result.winner === 'defenders') defending.won++;
        else defending.lost++;
      }
    }
  }
  return {
    profile,
    nights: nightsPlayed,
    since,
    sets,
    games,
    declaring,
    defending,
    strains,
    levels,
    partners: [...partners].map(([partner, r]) => ({ partner, ...r })),
    awards,
  };
}

/** Whole-number shares of a set of counts (all zero when there's nothing yet). */
export function shares<K extends string | number>(counts: Readonly<Record<K, number>>): { key: K; pct: number }[] {
  const keys = Object.keys(counts) as unknown as K[];
  const total = keys.reduce((t, k) => t + counts[k], 0);
  return keys.map((k) => ({ key: k, pct: total ? Math.round((counts[k] / total) * 100) : 0 })).sort((a, b) => b.pct - a.pct);
}

export type LeaderStat = 'sets' | 'games' | 'declaring' | 'defending';

export interface LeaderRow {
  readonly profile: ProfileId;
  /** What's shown: a count ("431") or a win–loss ("21–9"). */
  readonly value: string;
  /** What it's ranked by: sets and games by how many were won; declaring and defending by how
   *  many games were played in that role (Ryan), not by wins. */
  readonly rank: number;
}

/** The leaderboard (S20, LB2): for each stat, all four players, best first. */
export function leaderboard(all: readonly PlayerStats[]): Record<LeaderStat, LeaderRow[]> {
  const rows = (f: (s: PlayerStats) => Omit<LeaderRow, 'profile'>) =>
    all.map((s) => ({ profile: s.profile, ...f(s) })).sort((a, b) => b.rank - a.rank);
  return {
    sets: rows((s) => ({ value: String(s.sets.won), rank: s.sets.won })),
    games: rows((s) => ({ value: String(s.games.won), rank: s.games.won })),
    declaring: rows((s) => ({ value: `${s.declaring.won}–${s.declaring.lost}`, rank: s.declaring.won + s.declaring.lost })),
    defending: rows((s) => ({ value: `${s.defending.won}–${s.defending.lost}`, rank: s.defending.won + s.defending.lost })),
  };
}

/** The award tracker: how many times each player has won an award, most first. */
export function awardCounts(kind: AwardKind, all: readonly PlayerStats[]): { profile: ProfileId; count: number }[] {
  return all.map((s) => ({ profile: s.profile, count: s.awards[kind] ?? 0 })).sort((a, b) => b.count - a.count);
}

/** One animal's (or element's) record for a player: nights picked, games played and won with it. */
export interface PickCount {
  readonly nights: number;
  readonly played: number;
  readonly won: number;
}
type PickCounts = Record<ProfileId, Record<string, PickCount>>;

/** Per player, per animal (or element): nights picked, and games played and won with it. Nights
 *  are counted only when `countNights` (the carry-forward adds a night's pick once, with the night). */
export function pickCounts(profiles: readonly ProfileId[], nights: readonly SavedNight[], of: 'animal' | 'element', countNights = true): PickCounts {
  const out: PickCounts = Object.fromEntries(profiles.map((p) => [p, {}]));
  for (const night of nights) {
    for (const profile of profiles) {
      const pick = night.avatars?.[profile]?.[of];
      const pair = pairOf(night, profile);
      if (!pick || !pair) continue;
      const rec = { ...(out[profile]![pick] ?? { nights: 0, played: 0, won: 0 }) };
      if (countNights) rec.nights++;
      for (const g of night.games) {
        if (!g.winningPair) continue;
        const worth = gameWorth(g.result);
        rec.played += worth;
        if (g.winningPair === pair) rec.won += worth;
      }
      out[profile]![pick] = rec;
    }
  }
  return out;
}

/** Two sets of pick counts added together. */
export function addPicks(a: PickCounts, b: Readonly<Record<ProfileId, Readonly<Record<string, PickCount>>>> | undefined): PickCounts {
  if (!b) return a;
  const out: PickCounts = { ...a };
  for (const [profile, picks] of Object.entries(b)) {
    const mine = { ...(out[profile] ?? {}) };
    for (const [pick, r] of Object.entries(picks)) {
      const m = mine[pick];
      mine[pick] = m ? { nights: m.nights + r.nights, played: m.played + r.played, won: m.won + r.won } : r;
    }
    out[profile] = mine;
  }
  return out;
}

export interface AnimalRecord {
  readonly profile: ProfileId;
  /** The animal picked for the most nights, and how many. */
  readonly mostPicked: { readonly animal: string; readonly nights: number } | null;
  /** The animal with the best share of games won, among those with enough games behind them. */
  readonly luckiest: { readonly animal: string; readonly pct: number } | null;
}

/** Each player's most-picked and luckiest animal. */
export function animalRecords(profiles: readonly ProfileId[], nights: readonly SavedNight[], carried?: Carried): AnimalRecord[] {
  const counts = addPicks(pickCounts(profiles, nights, 'animal'), carried?.animals);
  return profiles.map((profile) => {
    const recs = Object.entries(counts[profile] ?? {});
    const most = recs.filter(([, r]) => r.nights > 0).sort((a, b) => b[1].nights - a[1].nights || a[0].localeCompare(b[0]))[0];
    const lucky = recs
      .filter(([, r]) => r.played >= MIN_SAMPLE)
      .map(([animal, r]) => ({ animal, pct: Math.round((r.won / r.played) * 100) }))
      .sort((a, b) => b.pct - a.pct || a.animal.localeCompare(b.animal))[0];
    return { profile, mostPicked: most ? { animal: most[0], nights: most[1].nights } : null, luckiest: lucky ?? null };
  });
}

/** Each player's share of games won with each element ("—", null, until there are 5 games). */
export function elementRecords(profiles: readonly ProfileId[], nights: readonly SavedNight[], carried?: Carried): { profile: ProfileId; pct: Record<Element, number | null> }[] {
  const ELEMENTS: Element[] = ['fire', 'water', 'air', 'earth'];
  const counts = addPicks(pickCounts(profiles, nights, 'element'), carried?.elements);
  return profiles.map((profile) => {
    const pct = Object.fromEntries(
      ELEMENTS.map((e) => {
        const r = counts[profile]?.[e];
        return [e, r && r.played >= MIN_SAMPLE ? Math.round((r.won / r.played) * 100) : null];
      }),
    ) as Record<Element, number | null>;
    return { profile, pct };
  });
}

/** The moments wall's order (Ryan): these first, the rest alphabetically by title. */
export const MOMENT_PRIORITY: readonly AwardKind[] = ['epicAttic', 'heist', 'daredevil', 'tenDollars', 'heartbreakHotel'];
export const MOMENTS_PER_NIGHT = 2;

/** Each night's top moments, newest night first: at most two, by priority (S20 moments wall). */
export function momentsWall(
  nights: readonly SavedNight[],
  titleOf: (kind: string) => string,
  profile: ProfileId | null = null,
): { night: SavedNight; awards: SavedAward[] }[] {
  const rank = (a: SavedAward) => {
    const i = MOMENT_PRIORITY.indexOf(a.kind as AwardKind);
    return i === -1 ? MOMENT_PRIORITY.length : i;
  };
  return [...nights]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((night) => ({
      night,
      awards: [...(night.awards ?? [])]
        .filter((a) => !profile || a.profile === profile)
        .sort((a, b) => rank(a) - rank(b) || titleOf(a.kind).localeCompare(titleOf(b.kind)))
        .slice(0, MOMENTS_PER_NIGHT),
    }))
    .filter((n) => n.awards.length > 0);
}
