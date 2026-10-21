import { fail, type Outcome } from './types';
import type { PairId, ProfileId } from './session';

// Ryan: the all-time scores can take nights played away from the app, but only with everyone's
// say-so. A change (add an offline night, or take one back out) is proposed by one player, and
// applies once all four have approved it; any one of them can turn it down.

export interface OfflineNight {
  /** When it was played (UTC ms). */
  readonly playedAt: number;
  readonly pairs: Readonly<Record<PairId, readonly [ProfileId, ProfileId]>>;
  /** Games won by each pair. */
  readonly wins: Readonly<Record<PairId, number>>;
  readonly note?: string;
}

export type HistoryChange = { readonly kind: 'add'; readonly night: OfflineNight } | { readonly kind: 'remove'; readonly nightId: string };

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
const MAX_GAMES = 99;
const EARLIEST = Date.UTC(2000, 0, 1);

export const emptyChangeQueue = (): ChangeQueue => ({ pending: [], seq: 0 });

/** The result: the new queue, and the change that just got everyone's approval (to apply), if any. */
export interface ChangeOutcome {
  readonly queue: ChangeQueue;
  readonly applied: HistoryChange | null;
}

const isInt = (n: unknown, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;

/** A split of exactly these four players into two pairs. */
function validPairs(pairs: unknown, players: readonly ProfileId[]): boolean {
  const p = pairs as Record<PairId, unknown> | null;
  if (!p || !Array.isArray(p.A) || !Array.isArray(p.B) || p.A.length !== 2 || p.B.length !== 2) return false;
  const all = [...p.A, ...p.B];
  return new Set(all).size === 4 && all.every((id) => players.includes(id as ProfileId)) && players.every((id) => all.includes(id));
}

export function checkOfflineNight(night: unknown, now: number, players: readonly ProfileId[]): string | null {
  const n = night as OfflineNight | null;
  if (!n || typeof n !== 'object') return 'Missing the night.';
  if (typeof n.playedAt !== 'number' || !Number.isFinite(n.playedAt) || n.playedAt < EARLIEST || n.playedAt > now + 36 * 60 * 60 * 1000) {
    return 'Pick the date it was played.';
  }
  if (!validPairs(n.pairs, players)) return 'Pick who partnered whom.';
  if (!n.wins || !isInt(n.wins.A, MAX_GAMES) || !isInt(n.wins.B, MAX_GAMES) || n.wins.A + n.wins.B < 1) return 'Enter the games each pair won.';
  if (n.note !== undefined && (typeof n.note !== 'string' || n.note.length > 140)) return 'Keep the note short.';
  return null;
}

/**
 * `offlineIds`: the offline nights that exist (a removal must name one). Players approve their
 * own proposal by making it; the change applies when all of `players` have approved.
 */
export function applyChangeAction(
  queue: ChangeQueue,
  by: ProfileId,
  action: ChangeAction,
  now: number,
  players: readonly ProfileId[],
  offlineIds: readonly string[],
): Outcome<ChangeOutcome, never> {
  const done = (q: ChangeQueue, applied: HistoryChange | null = null): Outcome<ChangeOutcome, never> => ({ ok: true, state: { queue: q, applied }, events: [] });
  switch (action?.type) {
    case 'propose': {
      const change = action.change;
      if (queue.pending.length >= MAX_PENDING_CHANGES) return fail('TOO_MANY', 'Settle the changes already waiting first.');
      if (change?.kind === 'add') {
        const problem = checkOfflineNight(change.night, now, players);
        if (problem) return fail('BAD_NIGHT', problem);
      } else if (change?.kind === 'remove') {
        if (!offlineIds.includes(change.nightId)) return fail('NOT_OFFLINE', 'Only nights added by hand can be taken out.');
        if (queue.pending.some((p) => p.change.kind === 'remove' && p.change.nightId === change.nightId)) return fail('ALREADY', 'That is already waiting.');
      } else return fail('BAD_CHANGE', 'Unknown change.');
      const seq = queue.seq + 1;
      const clean: HistoryChange =
        change.kind === 'add'
          ? {
              kind: 'add',
              night: {
                playedAt: change.night.playedAt,
                pairs: { A: [...change.night.pairs.A] as [ProfileId, ProfileId], B: [...change.night.pairs.B] as [ProfileId, ProfileId] },
                wins: { A: change.night.wins.A, B: change.night.wins.B },
                ...(change.night.note ? { note: change.night.note } : {}),
              },
            }
          : { kind: 'remove', nightId: change.nightId };
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
  done: (q: ChangeQueue, applied?: HistoryChange | null) => Outcome<ChangeOutcome, never>,
): Outcome<ChangeOutcome, never> {
  const p = queue.pending.find((x) => x.id === id)!;
  if (!players.every((pl) => p.approvals.includes(pl))) return done(queue);
  return done({ ...queue, pending: queue.pending.filter((x) => x.id !== id) }, p.change);
}
