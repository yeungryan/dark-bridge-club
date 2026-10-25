import { declarerTarget, defenderTarget } from './auction';
import { cardLabel, hcp } from './cards';
import type { DealResult } from './deal';
import { trumpSuit, type CompletedTrick } from './play';
import { next, partner } from './seats';
import type { PairId, ProfileId } from './session';
import type { Card, Contract, PerSeat, Seat, Side } from './types';

// Spec S19: moments (per game) and awards (per night), calculated only from saved history,
// so they can be re-run on old nights and always give the same answer.

/** One finished (or passed-out) game, as saved in the `deals` table. */
export interface DealHistory {
  readonly dealNumber: number;
  readonly dealer: Seat;
  /** null for a pass-out. */
  readonly contract: Contract | null;
  readonly result: DealResult | null;
  /** The hands as dealt; null if not saved. */
  readonly hands: PerSeat<readonly Card[]> | null;
  /** Every completed set, in order; null if not saved. */
  readonly tricks: readonly CompletedTrick[] | null;
  /** Total thinking time per seat in this game, in ms (M3+); null for older games. */
  readonly thinkMs: PerSeat<number> | null;
  /** Who sat where for this game (seats swap every few games); absent: the night's seating. */
  readonly seating?: PerSeat<ProfileId> | null;
}

/** A whole night: who sat where at the start, the pairs, and its games in order. */
export interface NightHistory {
  readonly seating: PerSeat<ProfileId>;
  readonly pairs: Readonly<Record<PairId, readonly [ProfileId, ProfileId]>>;
  readonly deals: readonly DealHistory[];
}

export type MomentKind =
  | 'grandAmbition'
  | 'robbery'
  | 'heartbreak'
  | 'decider'
  | 'trumpCard'
  | 'yarborough'
  | 'powerhouseBenched'
  | 'comebackNight'
  | 'streak';

export interface Moment {
  readonly kind: MomentKind;
  /** The game it happened in (for night-level moments: the game that completed it). */
  readonly dealNumber: number;
  /** The players it's about, as profile ids (never seats: captions must never misattribute). */
  readonly players: readonly ProfileId[];
  /** Numbers the caption or the award ranking needs, e.g. { level: 6 } or { hcpGap: 7 }. */
  readonly payload: Readonly<Record<string, number | string>>;
}

export type AwardKind =
  | 'mvp'
  | 'wall'
  | 'daredevil'
  | 'heist'
  | 'broomGod'
  // Dog Moorb (round 15; it was "Dog Mroob"). The id stays as saved, so past awards keep counting.
  | 'dogMroob'
  | 'heartbreakHotel'
  | 'epicAttic'
  | 'blogAboutIt'
  | 'bannerMoment'
  | 'tenDollars';

export interface Award {
  readonly kind: AwardKind;
  /** Who earned it. */
  readonly profile: ProfileId;
  /** How strongly it was earned (used to choose and order the awards shown). */
  readonly score: number;
  /** Numbers for the caption, e.g. { tricksShort: 4, contract: '4♠' } or { minutes: 12 }. */
  readonly payload: Readonly<Record<string, number | string>>;
}

// ---------------------------------------------------------------------------------------------
// Replaying a saved game
// ---------------------------------------------------------------------------------------------
// Everything below is derived from DealHistory alone. House rules: targets sum to 14
// (declarers level + 6, defenders 8 − level); the game is settled at the clinch, the first trick
// on which either side reaches its target. Partners sit opposite, so a seat is on declarer's
// side when it has the same parity as the declarer.

interface ClinchInfo {
  readonly side: Side;
  /** 1-based. */
  readonly trickNumber: number;
  readonly trick: CompletedTrick;
  /** Tricks each side had before the clinching trick. */
  readonly declarersBefore: number;
  readonly defendersBefore: number;
}

interface Replay {
  readonly contract: Contract;
  readonly declarerTarget: number;
  readonly defenderTarget: number;
  readonly clinch: ClinchInfo | null;
  /** Tricks won by the end of the saved play (the clinch, a concession, or trick 13). */
  readonly declarersEnd: number;
  readonly defendersEnd: number;
  /** Tricks won per seat across the saved play. */
  readonly tricksBySeat: PerSeat<number>;
}

function onDeclarerSide(seat: Seat, contract: Contract): boolean {
  return seat % 2 === contract.declarer % 2;
}

function replay(deal: DealHistory): Replay | null {
  const { contract, tricks } = deal;
  if (!contract || !tricks) return null;
  const decT = declarerTarget(contract.level);
  const defT = defenderTarget(contract.level);
  let dec = 0;
  let def = 0;
  let clinch: ClinchInfo | null = null;
  const bySeat: PerSeat<number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < tricks.length; i++) {
    const trick = tricks[i]!;
    const before = { dec, def };
    bySeat[trick.winner] += 1;
    if (onDeclarerSide(trick.winner, contract)) dec += 1;
    else def += 1;
    if (!clinch && (dec >= decT || def >= defT)) {
      clinch = {
        side: dec >= decT ? 'declarers' : 'defenders',
        trickNumber: i + 1,
        trick,
        declarersBefore: before.dec,
        defendersBefore: before.def,
      };
    }
  }
  return {
    contract,
    declarerTarget: decT,
    defenderTarget: defT,
    clinch,
    declarersEnd: dec,
    defendersEnd: def,
    tricksBySeat: bySeat,
  };
}

/** Which side won the game: the clinch if the tricks show one, otherwise the saved result (a concession). */
function winningSide(deal: DealHistory, r: Replay | null): Side | null {
  if (!deal.contract) return null;
  if (r?.clinch) return r.clinch.side;
  return deal.result?.winner ?? null;
}

function sideSeats(contract: Contract, side: Side): [Seat, Seat] {
  const d = contract.declarer;
  const decl: [Seat, Seat] = [d, partner(d)];
  const defs: [Seat, Seat] = [next(d), partner(next(d))];
  return side === 'declarers' ? decl : defs;
}

function pairOfProfile(night: NightHistory, profile: ProfileId): PairId | null {
  if (night.pairs.A.includes(profile)) return 'A';
  if (night.pairs.B.includes(profile)) return 'B';
  return null;
}

/** Who sat where for one game: its own seating, or the night's for games saved before seat swaps. */
export function seatingOf(deal: DealHistory, night: NightHistory): PerSeat<ProfileId> {
  return deal.seating ?? night.seating;
}

function pairOfSeat(night: NightHistory, deal: DealHistory, seat: Seat): PairId {
  // Fallback by parity only if the saved pairs don't name the occupant (should not happen).
  return pairOfProfile(night, seatingOf(deal, night)[seat]) ?? (seat % 2 === 0 ? 'A' : 'B');
}

/** The pair that won each game, in order; null for pass-outs and unfinished games. */
function gameWinners(night: NightHistory): { dealNumber: number; pair: PairId }[] {
  const out: { dealNumber: number; pair: PairId }[] = [];
  for (const deal of night.deals) {
    if (!deal.contract || !deal.result) continue;
    const side = winningSide(deal, replay(deal));
    if (!side) continue;
    const declarerPair = pairOfSeat(night, deal, deal.contract.declarer);
    out.push({ dealNumber: deal.dealNumber, pair: side === 'declarers' ? declarerPair : otherPair(declarerPair) });
  }
  return out;
}

function otherPair(p: PairId): PairId {
  return p === 'A' ? 'B' : 'A';
}

function contractPayload(c: Contract): { level: number; strain: string } {
  return { level: c.level, strain: c.strain };
}

// ---------------------------------------------------------------------------------------------
// Per-game moments
// ---------------------------------------------------------------------------------------------

/**
 * Moments in one game, in a fixed kind order. `players` are profile ids; the first one is the
 * player the caption is mainly about.
 */
export function dealMoments(deal: DealHistory, night: NightHistory): Moment[] {
  const who = (s: Seat): ProfileId => seatingOf(deal, night)[s];
  const out: Moment[] = [];
  const add = (kind: MomentKind, seats: readonly Seat[], payload: Moment['payload'] = {}) =>
    out.push({ kind, dealNumber: deal.dealNumber, players: seats.map(who), payload });

  const contract = deal.contract;
  const r = replay(deal);
  const finished = deal.result !== null || r?.clinch != null;
  const winner = finished ? winningSide(deal, r) : null;
  const hcpBySeat = deal.hands ? ([0, 1, 2, 3] as const).map((s) => hcp(deal.hands![s])) : null;

  if (contract) {
    const declarers = sideSeats(contract, 'declarers');
    const defenders = sideSeats(contract, 'defenders');

    // Grand Ambition: a level-6 or -7 contract, made or not.
    if (contract.level >= 6) {
      add('grandAmbition', declarers, { ...contractPayload(contract), made: winner === 'declarers' ? 1 : 0 });
    }

    // Robbery: declarers won with fewer combined HCP than the defenders.
    if (hcpBySeat && winner === 'declarers') {
      const decHcp = hcpBySeat[declarers[0]]! + hcpBySeat[declarers[1]]!;
      const defHcp = hcpBySeat[defenders[0]]! + hcpBySeat[defenders[1]]!;
      if (decHcp < defHcp) {
        add('robbery', declarers, { ...contractPayload(contract), hcpGap: defHcp - decHcp, declarerHcp: decHcp, defenderHcp: defHcp });
      }
    }

    if (r?.clinch) {
      const c = r.clinch;
      // Heartbreak: set on the trick that would have been their last needed one
      // (declarers had exactly target − 1 when the defenders clinched).
      if (c.side === 'defenders' && c.declarersBefore === r.declarerTarget - 1) {
        add('heartbreak', declarers, { ...contractPayload(contract), trickNumber: c.trickNumber });
      }
      // The Decider: both sides were one trick away when the clinching trick was played.
      if (c.declarersBefore === r.declarerTarget - 1 && c.defendersBefore === r.defenderTarget - 1) {
        const [a, b] = sideSeats(contract, c.side);
        const first = c.trick.winner;
        add('decider', [first, first === a ? b : a], { ...contractPayload(contract), trickNumber: c.trickNumber, side: c.side });
      }
      // Trump Card: the clinching trick was won by a trump on a trick led in another suit.
      const trump = trumpSuit(contract.strain);
      const led = c.trick.cards[0]?.card.suit;
      if (trump && c.trick.winningCard.suit === trump && led !== trump) {
        add('trumpCard', [c.trick.winner], {
          ...contractPayload(contract),
          card: cardLabel(c.trick.winningCard),
          trickNumber: c.trickNumber,
          side: c.side,
        });
      }
    }
  }

  // Yarborough: a hand with no card above a 9 (shown at the reveal, so pass-outs count too).
  if (deal.hands) {
    for (const s of [0, 1, 2, 3] as const) {
      if (deal.hands[s].length > 0 && deal.hands[s].every((card) => card.rank <= 9)) add('yarborough', [s]);
    }
  }

  // Powerhouse Benched: the single highest-HCP player was a defender, and the contract was made.
  if (contract && hcpBySeat && winner === 'declarers') {
    const max = Math.max(...hcpBySeat);
    const top = ([0, 1, 2, 3] as const).filter((s) => hcpBySeat[s] === max);
    if (top.length === 1 && !onDeclarerSide(top[0]!, contract)) {
      add('powerhouseBenched', [top[0]!], { ...contractPayload(contract), hcp: max });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------------------------
// Night moments
// ---------------------------------------------------------------------------------------------

/**
 * Session-level moments. Pass-outs and unfinished games are skipped entirely (they neither
 * extend nor break a streak).
 */
export function nightMoments(night: NightHistory): Moment[] {
  const games = gameWinners(night);
  const out: Moment[] = [];
  if (games.length === 0) return out;

  // Comeback Night: the pair that won the night (more game wins) trailed by 3+ at some point.
  const wins: Record<PairId, number> = { A: 0, B: 0 };
  const worst: Record<PairId, number> = { A: 0, B: 0 };
  for (const g of games) {
    wins[g.pair] += 1;
    worst.A = Math.max(worst.A, wins.B - wins.A);
    worst.B = Math.max(worst.B, wins.A - wins.B);
  }
  const nightWinner: PairId | null = wins.A > wins.B ? 'A' : wins.B > wins.A ? 'B' : null;
  if (nightWinner && worst[nightWinner] >= 3) {
    out.push({
      kind: 'comebackNight',
      dealNumber: games[games.length - 1]!.dealNumber,
      players: [...night.pairs[nightWinner]],
      payload: { maxDeficit: worst[nightWinner], wins: wins[nightWinner], losses: wins[otherPair(nightWinner)] },
    });
  }

  // Streak: each pair's longest run of 4+ wins (the first such run if two are equally long).
  for (const pair of ['A', 'B'] as const) {
    let best = { length: 0, end: 0 };
    let run = 0;
    for (const g of games) {
      run = g.pair === pair ? run + 1 : 0;
      if (run > best.length) best = { length: run, end: g.dealNumber };
    }
    if (best.length >= 4) {
      out.push({ kind: 'streak', dealNumber: best.end, players: [...night.pairs[pair]], payload: { length: best.length } });
    }
  }
  return out;
}

/** Every game's moments in game order, then the night moments. Deterministic. */
export function allMoments(night: NightHistory): Moment[] {
  return [...night.deals.flatMap((d) => dealMoments(d, night)), ...nightMoments(night)];
}

// ---------------------------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------------------------

/** Awards both partners can share in one night (Ryan, round 10): a clean sweep is the pair's. */
export const SHARED_AWARDS: readonly AwardKind[] = ['broomGod', 'dogMroob'];

/** House awards (Ryan's inside jokes) get a selection bonus: they're the fun ones. */
export const HOUSE_AWARDS: readonly AwardKind[] = ['epicAttic', 'blogAboutIt', 'bannerMoment', 'tenDollars'];

/** Fixed tie-break order for selection (earlier wins). Never random. */
export const AWARD_ORDER: readonly AwardKind[] = [
  'blogAboutIt',
  'epicAttic',
  'bannerMoment',
  'tenDollars',
  'heist',
  'broomGod',
  'dogMroob',
  'mvp',
  'heartbreakHotel',
  'wall',
  'daredevil',
];

/**
 * The score at which an award counts as "clearly earned" (strength 1). Strength is
 * min(1, score / STRONG_AT[kind]), which puts every kind on a 0–1 scale for selection.
 * A kind given out last night is only repeated when it is clearly earned tonight.
 */
export const STRONG_AT: Readonly<Record<AwardKind, number>> = {
  mvp: 4, // clinching cards
  wall: 4, // contracts set
  daredevil: 5, // 8 − the declarer's HCP (3 or fewer is clearly earned)
  heist: 5, // 8 − the winner's HCP (3 or fewer is clearly earned)
  broomGod: 13, // all 13 sets: always clearly earned
  dogMroob: 13,
  heartbreakHotel: 2, // heartbreaks
  epicAttic: 4, // contract level (any made 4+ contract is clearly earned)
  blogAboutIt: 4, // drama points (e.g. a Decider that was also a Heartbreak)
  bannerMoment: 8, // = a level-2 (or lower) contract made exactly with no moments
  tenDollars: 900, // seconds of thinking (15 minutes)
};

const HOUSE_BONUS = 0.5;

export function awardStrength(a: Award): number {
  return Math.min(1, a.score / STRONG_AT[a.kind]);
}

function awardPriority(a: Award): number {
  return awardStrength(a) + (HOUSE_AWARDS.includes(a.kind) ? HOUSE_BONUS : 0);
}

/** Drama points per moment kind, for "Why don't you blog about it". */
const DRAMA: Partial<Record<MomentKind, number>> = { decider: 2, heartbreak: 2, trumpCard: 1, grandAmbition: 1, robbery: 1 };

interface Entry {
  readonly profile: ProfileId;
  /** Sort keys, compared in order, higher first. */
  readonly keys: readonly number[];
}

/** The best entry by keys (higher first), then by seat order. Deterministic. */
function best(entries: readonly Entry[], night: NightHistory): Entry | null {
  const seatIdx = (p: ProfileId) => ([0, 1, 2, 3] as const).findIndex((s) => night.seating[s] === p);
  let top: Entry | null = null;
  for (const e of entries) {
    if (!top) {
      top = e;
      continue;
    }
    let cmp = 0;
    for (let i = 0; i < e.keys.length && cmp === 0; i++) cmp = (e.keys[i] ?? 0) - (top.keys[i] ?? 0);
    if (cmp > 0 || (cmp === 0 && seatIdx(e.profile) < seatIdx(top.profile))) top = e;
  }
  return top;
}

/** Counts per profile, remembering when each count was reached (earlier reach wins ties). */
class Tally {
  private readonly rows = new Map<ProfileId, { count: number; reachedAt: number; extra: number }>();
  add(profile: ProfileId, at: number, amount = 1, extra = 0): void {
    const row = this.rows.get(profile) ?? { count: 0, reachedAt: at, extra: 0 };
    row.count += amount;
    if (amount > 0) row.reachedAt = at;
    row.extra += extra;
    this.rows.set(profile, row);
  }
  /** keys: count, then `extra`, then the earlier reach. */
  entries(): Entry[] {
    return [...this.rows].map(([profile, r]) => ({ profile, keys: [r.count, r.extra, -r.reachedAt] }));
  }
}

/**
 * The best candidate for every award kind that qualifies tonight (at most one per kind),
 * in AWARD_ORDER. Scoring, within each kind:
 * - mvp: clinching cards played (the card that won the clinching trick). Needs 2+.
 * - wall: contracts set as a defender. Needs 2+. Partners tie by definition; the one who won
 *   more tricks in those games gets it.
 * - daredevil (Ryan): a contract won as declarer holding 7 or fewer HCP. Score 8 − HCP, so the
 *   thinnest hand wins; then the higher contract.
 * - heist (Ryan): a game won by a player on the winning side who is not the declarer (the
 *   declarer's partner, or a defender), holding 7 or fewer HCP. Score 8 − HCP; then the higher contract.
 * - heartbreakHotel: Heartbreaks suffered as declarer. Needs 1+.
 * - epicAttic (Ryan; no longer a roast): a contract at level 4 or higher, won by the declarer.
 *   Score: the level; the higher contract wins, then the earlier game.
 * - blogAboutIt: drama points of the most dramatic game (decider 2, heartbreak 2, trumpCard 1,
 *   grandAmbition 1, robbery 1; ties → the later game), to whoever played its clinching card. Needs 2+.
 * - bannerMoment: 10 − 4 × tricks to spare − level, for a level ≤ 2 contract made with no
 *   moments at all and at most one trick to spare; the declarer earns it.
 * - broomGod / dogMroob (Ryan, round 10): the declaring side / the defending side won all 13
 *   sets (sets won after playing on count). Both partners get it (SHARED_AWARDS), unless one of
 *   them won all 13 with their own cards: then only them. The night's first such game. Score 13.
 * - tenDollars: total thinking seconds. Needs 60 s+ and at least 20% more than the median player.
 * Remaining ties: the earlier achiever, then seat order.
 */
export function awardCandidates(night: NightHistory): Award[] {
  const out: Award[] = [];
  const push = (kind: AwardKind, e: Entry | null, payload: (e: Entry) => Award['payload']) => {
    if (e) out.push({ kind, profile: e.profile, score: e.keys[0]!, payload: payload(e) });
  };

  const mvp = new Tally();
  const wall = new Tally();
  const heartbreaks = new Tally();
  const daredevils: (Entry & { payload: Award['payload'] })[] = [];
  const heists: (Entry & { payload: Award['payload'] })[] = [];
  const attics: (Entry & { payload: Award['payload'] })[] = [];
  const blogs: (Entry & { payload: Award['payload'] })[] = [];
  const banners: (Entry & { payload: Award['payload'] })[] = [];
  // The night's first clean sweep by each side: who gets it, and the game's facts.
  const sweeps: Partial<Record<Side, { profiles: ProfileId[]; payload: Award['payload'] }>> = {};

  night.deals.forEach((deal, i) => {
    const contract = deal.contract;
    if (!contract) return;
    const r = replay(deal);
    const moments = dealMoments(deal, night);
    const who = (s: Seat): ProfileId => seatingOf(deal, night)[s];
    const declarer = who(contract.declarer);
    const winner = deal.result || r?.clinch ? winningSide(deal, r) : null;
    const hcpOf = deal.hands ? (s: Seat) => hcp(deal.hands![s]) : null;
    const facts = { ...contractPayload(contract), dealNumber: deal.dealNumber };

    if (r?.clinch) mvp.add(who(r.clinch.trick.winner), i);

    if (winner === 'defenders') {
      for (const s of sideSeats(contract, 'defenders')) wall.add(who(s), i, 1, r ? r.tricksBySeat[s] : 0);
    }

    for (const m of moments) {
      if (m.kind === 'heartbreak') heartbreaks.add(m.players[0]!, i);
    }

    // Epic Attic and Daredevil: the declarer won it, at 4+ or on 7 or fewer HCP of their own.
    if (winner === 'declarers') {
      if (contract.level >= 4) attics.push({ profile: declarer, keys: [contract.level, -i], payload: facts });
      const h = hcpOf?.(contract.declarer);
      if (h !== undefined && h <= 7) daredevils.push({ profile: declarer, keys: [8 - h, contract.level, -i], payload: { hcp: h, ...facts } });
    }
    // A clean sweep: one side won all 13 sets.
    const swept = deal.result?.declarerTricks === 13 ? 'declarers' : deal.result?.defenderTricks === 13 ? 'defenders' : null;
    if (swept && !sweeps[swept]) {
      const seats = sideSeats(contract, swept);
      const alone = r ? seats.find((s) => r.tricksBySeat[s] === 13) : undefined;
      sweeps[swept] = { profiles: (alone !== undefined ? [alone] : seats).map(who), payload: facts };
    }
    // Heist Master: anyone else on the winning side, on 7 or fewer HCP.
    if (winner && hcpOf) {
      for (const s of sideSeats(contract, winner)) {
        if (s === contract.declarer) continue;
        const h = hcpOf(s);
        if (h <= 7) heists.push({ profile: who(s), keys: [8 - h, contract.level, -i], payload: { hcp: h, ...facts } });
      }
    }

    if (r?.clinch) {
      const drama = moments.reduce((sum, m) => sum + (DRAMA[m.kind] ?? 0), 0);
      if (drama >= 2) {
        const top = [...moments].sort((a, b) => (DRAMA[b.kind] ?? 0) - (DRAMA[a.kind] ?? 0))[0]!;
        blogs.push({
          profile: who(r.clinch.trick.winner),
          keys: [drama, i],
          payload: { drama, dealNumber: deal.dealNumber, moment: top.kind, ...contractPayload(contract) },
        });
      }
    }

    if (r?.clinch && r.clinch.side === 'declarers' && contract.level <= 2 && moments.length === 0) {
      const spare = r.declarersEnd - r.declarerTarget;
      if (spare <= 1) {
        banners.push({
          profile: declarer,
          keys: [10 - 4 * spare - contract.level, -i],
          payload: { spare, ...contractPayload(contract), dealNumber: deal.dealNumber },
        });
      }
    }
  });

  const mvpBest = best(mvp.entries().filter((e) => e.keys[0]! >= 2), night);
  push('mvp', mvpBest, (e) => ({ clinches: e.keys[0]! }));

  const wallBest = best(wall.entries().filter((e) => e.keys[0]! >= 2), night);
  push('wall', wallBest, (e) => ({ sets: e.keys[0]! }));

  const pick = (kind: AwardKind, list: (Entry & { payload: Award['payload'] })[]) => {
    const b = best(list, night) as (Entry & { payload: Award['payload'] }) | null;
    push(kind, b, () => b!.payload);
  };
  pick('daredevil', daredevils);
  pick('heist', heists);
  for (const [kind, side] of [['broomGod', 'declarers'], ['dogMroob', 'defenders']] as const) {
    for (const profile of sweeps[side]?.profiles ?? []) out.push({ kind, profile, score: 13, payload: sweeps[side]!.payload });
  }

  const hbBest = best(heartbreaks.entries(), night);
  push('heartbreakHotel', hbBest, (e) => ({ heartbreaks: e.keys[0]! }));

  pick('epicAttic', attics);
  pick('blogAboutIt', blogs);
  pick('bannerMoment', banners);

  // That's 10 Dollars: total thinking time.
  const withTiming = night.deals.filter((d) => d.thinkMs);
  if (withTiming.length > 0) {
    const totals = new Map<ProfileId, number>();
    for (const s of [0, 1, 2, 3] as const) totals.set(night.seating[s], 0);
    for (const d of withTiming)
      for (const s of [0, 1, 2, 3] as const) {
        const p = seatingOf(d, night)[s];
        totals.set(p, totals.get(p)! + d.thinkMs![s]);
      }
    const sorted = [...totals.values()].sort((a, b) => a - b);
    const mid = sorted.length / 2;
    const median = sorted.length % 2 ? sorted[Math.floor(mid)]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
    const top = best([...totals].map(([profile, ms]) => ({ profile, keys: [ms] })), night)!;
    const ms = top.keys[0]!;
    if (ms >= 60_000 && ms >= 1.2 * median) {
      const seconds = Math.round(ms / 1000);
      out.push({ kind: 'tenDollars', profile: top.profile, score: seconds, payload: { minutes: Math.round(ms / 60_000), seconds } });
    }
  }

  return out.sort((a, b) => AWARD_ORDER.indexOf(a.kind) - AWARD_ORDER.indexOf(b.kind));
}

export const MAX_AWARDS = 5;
export const MIN_AWARDS = 3;
export const MAX_AWARDS_PER_PLAYER = 2;

/**
 * Choose which awards to show, highest priority first.
 * - Priority = strength (score / STRONG_AT, capped at 1) + 0.5 for house awards; ties → AWARD_ORDER.
 * - At most one award per kind (a sweep: both partners, together, in one place), at most MAX_AWARDS places.
 * - A kind shown last night (`previous`) is skipped unless clearly earned (strength 1).
 * - Each player at most twice; relaxed only if needed to reach MIN_AWARDS.
 */
export function selectAwards(candidates: readonly Award[], previous: readonly AwardKind[] = []): Award[] {
  // One award per kind, the strongest; a shared kind (a sweep) keeps everyone who earned it,
  // and they're chosen or left out together, taking one place.
  const byKind = new Map<AwardKind, Award[]>();
  for (const a of candidates) {
    const cur = byKind.get(a.kind);
    if (SHARED_AWARDS.includes(a.kind)) byKind.set(a.kind, [...(cur ?? []), a]);
    else if (!cur || a.score > cur[0]!.score) byKind.set(a.kind, [a]);
  }
  const ranked = [...byKind.values()]
    .filter((g) => !previous.includes(g[0]!.kind) || awardStrength(g[0]!) >= 1)
    .sort((a, b) => awardPriority(b[0]!) - awardPriority(a[0]!) || AWARD_ORDER.indexOf(a[0]!.kind) - AWARD_ORDER.indexOf(b[0]!.kind));

  const chosen: Award[][] = [];
  const perPlayer = new Map<ProfileId, number>();
  for (const g of ranked) {
    if (chosen.length >= MAX_AWARDS) break;
    if (g.some((a) => (perPlayer.get(a.profile) ?? 0) >= MAX_AWARDS_PER_PLAYER)) continue;
    chosen.push(g);
    for (const a of g) perPlayer.set(a.profile, (perPlayer.get(a.profile) ?? 0) + 1);
  }
  for (const g of ranked) {
    if (chosen.length >= MIN_AWARDS) break;
    if (!chosen.includes(g)) chosen.push(g);
  }
  return chosen.sort((a, b) => ranked.indexOf(a) - ranked.indexOf(b)).flat();
}

/** The awards to show at the end of the night (3–5 when that many qualify). */
export function nightAwards(night: NightHistory, previous: readonly AwardKind[] = []): Award[] {
  return selectAwards(awardCandidates(night), previous);
}
