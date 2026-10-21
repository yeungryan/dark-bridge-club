import type { Award, ChangeAction, PairId, PendingChange, ProfileInfo, SavedGameDetail, SavedNight, ScoreOverride } from '@dark/engine';
import { profileOf } from './format';
import { token } from './session';

// Spec S20: history comes from the server for the four of you only (your login token), and
// every number is worked out from the saved games in the engine (rivalry.ts).

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ token: token() ?? '', ...params });
  const res = await fetch(`${path}?${query}`);
  if (!res.ok) throw new Error(`history ${res.status}`);
  return (await res.json()) as T;
}

export interface HistoryData {
  readonly nights: SavedNight[];
  /** All-time scores the four of you set by hand (headToHead starts from these). */
  readonly overrides: ScoreOverride[];
  /** New all-time scores waiting for everyone's approval. */
  readonly pending: PendingChange[];
}

/** Every night so far, newest first, the scores set by hand, and the changes waiting. */
export const loadHistory = () => get<HistoryData>('/api/history');
export const loadNights = () => loadHistory().then((r) => r.nights);

/** Propose, approve or turn down a new all-time score; resolves to the updated history. */
export async function sendChange(action: ChangeAction): Promise<HistoryData> {
  const res = await fetch('/api/history/change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token(), action }),
  });
  const body = (await res.json().catch(() => ({}))) as HistoryData & { message?: string };
  if (!res.ok) throw new Error(body.message ?? 'That didn’t go through. Try again.');
  return body;
}

/** One saved game in full, for the replay. */
export const loadGame = (night: string, game: number) => get<SavedGameDetail>('/api/history/game', { night, game: String(game) });

export const pairName = (profiles: readonly ProfileInfo[], pair: readonly string[]) => pair.map((id) => profileOf(profiles, id).name).join(' & ');

/** "Tue 14 Oct". */
export const shortDate = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** How a finished night went, in a line: "Darren & Kim won 3–2" or "A dead heat, 2–2". */
export function nightLine(night: SavedNight, profiles: readonly ProfileInfo[]): string {
  const final = night.final;
  if (!final) return 'Still going';
  if (final.winner === 'tie') return `A dead heat, ${final.wins.A}–${final.wins.B}`;
  const loser: PairId = final.winner === 'A' ? 'B' : 'A';
  return `${pairName(profiles, night.pairs[final.winner])} won ${final.wins[final.winner]}–${final.wins[loser]}`;
}

/** The night's top award, as the award card shows it. */
export const topAwardOf = (night: SavedNight): Award | null =>
  night.topAward ? ({ ...night.topAward, score: 0 } as unknown as Award) : null;
