import { fail, type Outcome } from './types';
import type { ProfileId } from './session';

// Ryan: the all-time head-to-head can be set by hand, but only with everyone's say-so: to add
// scores from nights played away from the app, to stop counting some wins, or to start again from
// zero. One player proposes new numbers for a matchup; they apply once all four have approved,
// and any one of them can turn it down. Nights played after the proposal count on top.

/** One pair's all-time numbers against the other pair. */
export interface ScoreSide {
  readonly players: readonly [ProfileId, ProfileId];
  readonly nightsWon: number;
  readonly gamesWon: number;
}

/** New numbers for one matchup, or (Ryan) a reset of every matchup and every all-time stat to zero. */
export type HistoryChange = { readonly kind: 'score'; readonly sides: readonly [ScoreSide, ScoreSide] } | { readonly kind: 'reset' };

/** An approved score: the matchup's numbers as of `from` (nights started from then on count on top). */
export interface ScoreOverride {
  readonly sides: readonly [ScoreSide, ScoreSide];
  readonly from: number;
}

export interface PendingChange {
  readonly id: string;
  readonly change: HistoryChange;
  readonly proposedBy: ProfileId;
  readonly approvals: readonly ProfileId[];
  readonly at: number;
}

export interface ChangeQueue {
  readonly pending: readonly PendingChange[];
  readonly seq: number;
}

export type ChangeAction =
  | { readonly type: 'propose'; readonly change: HistoryChange }
  | { readonly type: 'approve'; readonly id: string }
  | { readonly type: 'reject'; readonly id: string };

export const MAX_PENDING_CHANGES = 5;
const MAX_COUNT = 9999;

export const emptyChangeQueue = (): ChangeQueue => ({ pending: [], seq: 0 });

/** The result: the new queue, and the change that just got everyone's approval (to apply), if any. */
export interface ChangeOutcome {
  readonly queue: ChangeQueue;
  readonly applied: PendingChange | null;
}

/** The same key for a matchup whichever way round its pairs (and players) are named. */
export const matchupKey = (a: readonly ProfileId[], b: readonly ProfileId[]): string =>
  [[...a].sort().join('+'), [...b].sort().join('+')].sort().join(' vs ');

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_COUNT;

/** New numbers for a split of exactly these four players into two pairs. */
export function checkScoreChange(sides: unknown, players: readonly ProfileId[]): string | null {
  const s = sides as ScoreSide[] | null;
  if (!Array.isArray(s) || s.length !== 2) return 'Pick a matchup.';
  const all = s.flatMap((side) => (Array.isArray(side?.players) && side.players.length === 2 ? side.players : []));
  if (all.length !== 4 || new Set(all).size !== 4 || !players.every((id) => all.includes(id))) return 'Pick a matchup.';
  if (!s.every((side) => isCount(side.nightsWon) && isCount(side.gamesWon))) return 'Enter whole numbers, 0 or more.';
  return null;
}

/** Players approve their own proposal by making it; the change applies when all of `players` have approved. */
export function applyChangeAction(
  queue: ChangeQueue,
  by: ProfileId,
  action: ChangeAction,
  now: number,
  players: readonly ProfileId[],
): Outcome<ChangeOutcome, never> {
  const done = (q: ChangeQueue, applied: PendingChange | null = null): Outcome<ChangeOutcome, never> => ({ ok: true, state: { queue: q, applied }, events: [] });
  switch (action?.type) {
    case 'propose': {
      const change = action.change;
      if (change?.kind === 'reset') {
        if (queue.pending.length >= MAX_PENDING_CHANGES) return fail('TOO_MANY', 'Settle the changes already waiting first.');
        if (queue.pending.some((p) => p.change.kind === 'reset')) return fail('ALREADY', 'A reset is already waiting.');
        const seq = queue.seq + 1;
        const pending: PendingChange = { id: `c${seq}`, change: { kind: 'reset' }, proposedBy: by, approvals: [by], at: now };
        return settle({ pending: [...queue.pending, pending], seq }, pending.id, players, done);
      }
      if (change?.kind !== 'score') return fail('BAD_CHANGE', 'Unknown change.');
      const problem = checkScoreChange(change.sides, players);
      if (problem) return fail('BAD_SCORE', problem);
      if (queue.pending.length >= MAX_PENDING_CHANGES) return fail('TOO_MANY', 'Settle the changes already waiting first.');
      const key = matchupKey(change.sides[0].players, change.sides[1].players);
      if (queue.pending.some((p) => p.change.kind === 'score' && matchupKey(p.change.sides[0].players, p.change.sides[1].players) === key)) {
        return fail('ALREADY', 'A change to this matchup is already waiting.');
      }
      const seq = queue.seq + 1;
      const tidy = (s: ScoreSide): ScoreSide => ({ players: [s.players[0], s.players[1]], nightsWon: s.nightsWon, gamesWon: s.gamesWon });
      const clean: HistoryChange = { kind: 'score', sides: [tidy(change.sides[0]), tidy(change.sides[1])] };
      const pending: PendingChange = { id: `c${seq}`, change: clean, proposedBy: by, approvals: [by], at: now };
      return settle({ pending: [...queue.pending, pending], seq }, pending.id, players, done);
    }
    case 'approve': {
      const p = queue.pending.find((x) => x.id === action.id);
      if (!p) return fail('NO_CHANGE', 'That change has already been settled.');
      if (p.approvals.includes(by)) return done(queue);
      const updated = { ...p, approvals: [...p.approvals, by] };
      return settle({ ...queue, pending: queue.pending.map((x) => (x === p ? updated : x)) }, p.id, players, done);
    }
    case 'reject': {
      if (!queue.pending.some((x) => x.id === action.id)) return fail('NO_CHANGE', 'That change has already been settled.');
      return done({ ...queue, pending: queue.pending.filter((x) => x.id !== action.id) });
    }
    default:
      return fail('BAD_ACTION', 'Unknown action.');
  }
}

function settle(
  queue: ChangeQueue,
  id: string,
  players: readonly ProfileId[],
  done: (q: ChangeQueue, applied?: PendingChange | null) => Outcome<ChangeOutcome, never>,
): Outcome<ChangeOutcome, never> {
  const p = queue.pending.find((x) => x.id === id)!;
  if (!players.every((pl) => p.approvals.includes(pl))) return done(queue);
  return done({ ...queue, pending: queue.pending.filter((x) => x.id !== id) }, p);
}

/** The overrides after an approved change: it replaces any earlier one for the same matchup (a reset clears them all). */
export function withOverride(overrides: readonly ScoreOverride[], applied: PendingChange): ScoreOverride[] {
  if (applied.change.kind === 'reset') return [];
  const sides = applied.change.sides;
  const key = matchupKey(sides[0].players, sides[1].players);
  return [...overrides.filter((o) => matchupKey(o.sides[0].players, o.sides[1].players) !== key), { sides, from: applied.at }];
}
