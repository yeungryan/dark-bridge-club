import type { Avatar } from './avatars';
import type { DealResult } from './deal';
import { matchupKey, type ScoreOverride } from './historyChanges';
import type { CompletedTrick } from './play';
import type { NightResult, PairId, ProfileId } from './session';
import type { Call, Card, Contract, PerSeat, Seat } from './types';

// Spec S20, the history the four of you share: every number here is worked out from the saved
// nights and games each time (nothing is kept as a running counter that could drift), starting
// from a matchup's agreed score where all four have set one by hand (historyChanges.ts).

/** One finished or passed-out game, as history keeps it. */
export interface SavedGame {
  readonly dealNumber: number;
  readonly dealer: Seat;
  /** null for a pass-out. */
  readonly contract: Contract | null;
  readonly result: DealResult | null;
  readonly winningPair: PairId | null;
  /** Whether the hands and sets were kept, so it can be replayed (not for a pass-out). */
  readonly replayable: boolean;
}

/** The night's top award, for the "Last time…" line (kind, who, its facts). */
export interface SavedAward {
  readonly kind: string;
  readonly profile: ProfileId;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** One night, as history keeps it. */
export interface SavedNight {
  /** An opaque id for asking for its games (not the night's seed). */
  readonly id: string;
  readonly startedAt: number;
  /** null while the night is still going. */
  readonly endedAt: number | null;
  readonly theme: string | null;
  readonly pairs: Readonly<Record<PairId, readonly [ProfileId, ProfileId]>>;
  readonly seating: PerSeat<ProfileId> | null;
  readonly avatars: Readonly<Record<ProfileId, Avatar>> | null;
  /** null while the night is still going. */
  readonly final: NightResult | null;
  readonly games: readonly SavedGame[];
  readonly topAward: SavedAward | null;
}

/** A saved game with everything the replay needs. */
export interface SavedGameDetail {
  readonly night: SavedNight;
  readonly game: SavedGame;
  readonly calls: readonly { readonly seat: Seat; readonly call: Call }[];
  readonly hands: PerSeat<readonly Card[]>;
  readonly tricks: readonly CompletedTrick[];
}

/** Games won by each pair in a night, counted from its saved games. */
export function gamesWonIn(night: SavedNight): Record<PairId, number> {
  const won = { A: 0, B: 0 };
  for (const g of night.games) if (g.winningPair) won[g.winningPair]++;
  return won;
}

/** Stats show "—" until there are at least this many games behind them (S20 rules). */
export const MIN_SAMPLE = 5;

/** A partnership, the same whichever order its two players are named in. */
export const pairKey = (pair: readonly [ProfileId, ProfileId] | readonly ProfileId[]): string => [...pair].sort().join('+');

/** The three ways four people can split into two pairs, for these four players. */
export function allMatchups(profiles: readonly ProfileId[]): [readonly [ProfileId, ProfileId], readonly [ProfileId, ProfileId]][] {
  const [first, ...rest] = profiles;
  if (!first || rest.length !== 3) return [];
  return rest.map((partner) => {
    const others = rest.filter((p) => p !== partner) as [ProfileId, ProfileId];
    return [[first, partner] as const, others];
  });
}

export interface SideRecord {
  readonly players: readonly [ProfileId, ProfileId];
  readonly nightsWon: number;
  readonly gamesWon: number;
}

export interface MatchupRecord {
  readonly sides: readonly [SideRecord, SideRecord];
  /** Finished nights this way round (ties count here but for neither side). */
  readonly nights: number;
  /** Games won by either side (pass-outs don't count). */
  readonly games: number;
  /** The last night this way round, if any. */
  readonly lastPlayed: number | null;
  /** When the four of you last set this matchup's score by hand, if ever. */
  readonly setAt: number | null;
}

/**
 * Head to head (S20 rivalry board): for each of the three matchups, nights and games won. Where
 * all four agreed a score for a matchup, it starts from that, and only nights begun since count on top.
 */
export function headToHead(profiles: readonly ProfileId[], nights: readonly SavedNight[], overrides: readonly ScoreOverride[] = []): MatchupRecord[] {
  return allMatchups(profiles).map(([a, b]) => {
    const ka = pairKey(a);
    const kb = pairKey(b);
    const set = overrides.find((o) => matchupKey(o.sides[0].players, o.sides[1].players) === matchupKey(a, b)) ?? null;
    const base = (k: string) => set?.sides.find((s) => pairKey(s.players) === k);
    let nightsA = base(ka)?.nightsWon ?? 0;
    let nightsB = base(kb)?.nightsWon ?? 0;
    let gamesA = base(ka)?.gamesWon ?? 0;
    let gamesB = base(kb)?.gamesWon ?? 0;
    let finished = nightsA + nightsB;
    let lastPlayed: number | null = null;
    for (const night of nights) {
      const keys = { A: pairKey(night.pairs.A), B: pairKey(night.pairs.B) };
      const isThis = (keys.A === ka && keys.B === kb) || (keys.A === kb && keys.B === ka);
      if (!isThis) continue;
      lastPlayed = Math.max(lastPlayed ?? 0, night.startedAt);
      if (set && night.startedAt < set.from) continue;
      const sideOf = (pair: PairId) => (keys[pair] === ka ? 'a' : 'b');
      const won = gamesWonIn(night);
      for (const pair of ['A', 'B'] as const) {
        if (sideOf(pair) === 'a') gamesA += won[pair];
        else gamesB += won[pair];
      }
      if (night.final) {
        finished++;
        if (night.final.winner !== 'tie') {
          if (sideOf(night.final.winner) === 'a') nightsA++;
          else nightsB++;
        }
      }
    }
    return {
      sides: [
        { players: a, nightsWon: nightsA, gamesWon: gamesA },
        { players: b, nightsWon: nightsB, gamesWon: gamesB },
      ],
      nights: finished,
      games: gamesA + gamesB,
      lastPlayed,
      setAt: set?.from ?? null,
    };
  });
}

export interface PartnerRecord {
  readonly partner: ProfileId;
  /** Finished nights together, and how many of them you won. */
  readonly nights: number;
  readonly nightsWon: number;
  /** Games played together (pass-outs aside) and won. */
  readonly games: number;
  readonly gamesWon: number;
}

/**
 * One player's record with each of the other three as partner: their side of the matchup that
 * partnership plays in (four players, so each partnership meets just one other pair).
 */
export function partnerRecords(
  profile: ProfileId,
  profiles: readonly ProfileId[],
  nights: readonly SavedNight[],
  overrides: readonly ScoreOverride[] = [],
): PartnerRecord[] {
  const board = headToHead(profiles, nights, overrides);
  return profiles
    .filter((p) => p !== profile)
    .map((partner) => {
      const key = pairKey([profile, partner]);
      const m = board.find((x) => x.sides.some((s) => pairKey(s.players) === key));
      const side = m?.sides.find((s) => pairKey(s.players) === key);
      return { partner, nights: m?.nights ?? 0, nightsWon: side?.nightsWon ?? 0, games: m?.games ?? 0, gamesWon: side?.gamesWon ?? 0 };
    });
}

export interface PartnershipRecord {
  readonly pair: readonly [ProfileId, ProfileId];
  readonly nights: number;
  readonly nightsWon: number;
  readonly games: number;
  readonly gamesWon: number;
}

/** Every partnership (six for four players), with its record together. */
export function partnershipRecords(profiles: readonly ProfileId[], nights: readonly SavedNight[], overrides: readonly ScoreOverride[] = []): PartnershipRecord[] {
  const out: PartnershipRecord[] = [];
  profiles.forEach((a, i) =>
    profiles.slice(i + 1).forEach((b) => {
      const r = partnerRecords(a, profiles, nights, overrides).find((x) => x.partner === b)!;
      out.push({ pair: [a, b], nights: r.nights, nightsWon: r.nightsWon, games: r.games, gamesWon: r.gamesWon });
    }),
  );
  return out;
}

/** A win rate as a whole percentage, or null ("—") while the sample is too small to mean much. */
export function winRate(won: number, played: number): number | null {
  return played >= MIN_SAMPLE ? Math.round((won / played) * 100) : null;
}

/** The last finished night before `beforeId` (S20 "Last time…" card): null if none. */
export function lastNight(nights: readonly SavedNight[], beforeId?: string): SavedNight | null {
  const finished = nights.filter((n) => n.final && n.id !== beforeId);
  return finished.reduce<SavedNight | null>((best, n) => (!best || (n.endedAt ?? 0) > (best.endedAt ?? 0) ? n : best), null);
}
