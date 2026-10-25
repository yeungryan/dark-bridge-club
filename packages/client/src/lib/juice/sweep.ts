import { gameWorth, next, partner, suitSymbol, type Seat } from '@dark/engine';
import { avatarAtSeat, teamOf, type Team } from '../avatars';
import type { Connection } from '../connection.svelte';
import { nameAtSeat } from '../format';

// Ryan (round 15): a sweep (all 13 sets to one side) gets a 5 s takeover after the game-winning
// effects: Broom God when the declarers sweep, Dog Moorb when the defenders do (SweepTakeover).

export interface Sweeper {
  readonly name: string;
  readonly animal: string | undefined;
}

export interface SweepShow {
  readonly id: number;
  readonly kind: 'broomGod' | 'dogMoorb';
  /** Always the whole pair: the score bonus is the pair's, even when one partner swept alone. */
  readonly winners: readonly Sweeper[];
  readonly losers: readonly Sweeper[];
  readonly winnerTeam: Team;
  readonly loserTeam: Team;
  /** +10 or +100 (gameWorth). */
  readonly worth: number;
  /** The contract that was swept, e.g. "1♠". */
  readonly contract: string;
  /** Where the stamp sat (the middle of the table), and the sweepers' score for the night. */
  readonly from: { x: number; y: number } | null;
  readonly to: { x: number; y: number } | null;
}

export type Sweep = Omit<SweepShow, 'id' | 'from' | 'to'>;

/** The finished game's sweep, if one side won all 13 sets. */
export function sweepOf(conn: Pick<Connection, 'view' | 'room'>): Sweep | null {
  const view = conn.view;
  const deal = view?.deal;
  const result = deal?.result;
  const contract = deal?.contract;
  if (!view || !conn.room || !result || !contract) return null;
  const side = result.declarerTricks === 13 ? 'declarers' : result.defenderTricks === 13 ? 'defenders' : null;
  if (!side) return null;
  const declarers: Seat[] = [contract.declarer, partner(contract.declarer)];
  const defenders: Seat[] = [next(contract.declarer), partner(next(contract.declarer))];
  const [won, lost] = side === 'declarers' ? [declarers, defenders] : [defenders, declarers];
  const who = (s: Seat): Sweeper => ({ name: nameAtSeat(view, conn.room!.profiles, s), animal: avatarAtSeat(conn, s)?.animal });
  return {
    kind: side === 'declarers' ? 'broomGod' : 'dogMoorb',
    winners: won.map(who),
    losers: lost.map(who),
    winnerTeam: teamOf(conn, won[0]!),
    loserTeam: teamOf(conn, lost[0]!),
    worth: gameWorth(result),
    contract: `${contract.level}${contract.strain === 'NT' ? 'NT' : suitSymbol(contract.strain)}`,
  };
}
