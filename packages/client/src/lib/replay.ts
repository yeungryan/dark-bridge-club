import { declarerTarget, defenderTarget, sameCard, type Card, type CompletedTrick, type Contract, type PerSeat, type Seat } from '@dark/engine';

// The replay (Ryan): after a game, step back through it set by set with every hand face up.
// Step 0 is the auction with the hands as dealt; step k shows set k on the table, who led it,
// who won it, and what each player still held afterwards.

export interface ReplayStep {
  /** 0 = the auction; otherwise the set number (1-based). */
  readonly set: number;
  /** What each player held after this set (as dealt, for the auction). */
  readonly hands: PerSeat<readonly Card[]>;
  /** This set's cards in play order, its leader and winner; null for the auction. */
  readonly trick: CompletedTrick | null;
  /** Sets won so far by each side. */
  readonly tally: { readonly declarers: number; readonly defenders: number };
  /** This set settled the game (the clinch). */
  readonly decisive: boolean;
  /** The game stopped after this set without playing the rest. */
  readonly stoppedHere: boolean;
}

export function replaySteps(dealt: PerSeat<readonly Card[]>, tricks: readonly CompletedTrick[], contract: Contract): ReplayStep[] {
  const decT = declarerTarget(contract.level);
  const defT = defenderTarget(contract.level);
  const onDeclarerSide = (seat: Seat) => seat % 2 === contract.declarer % 2;
  let hands = dealt;
  let tally = { declarers: 0, defenders: 0 };
  let settled = false;
  const steps: ReplayStep[] = [{ set: 0, hands, trick: null, tally, decisive: false, stoppedHere: tricks.length === 0 }];
  tricks.forEach((trick, i) => {
    const next = { ...hands };
    for (const play of trick.cards) next[play.seat] = next[play.seat].filter((c) => !sameCard(c, play.card));
    hands = next;
    tally = onDeclarerSide(trick.winner) ? { ...tally, declarers: tally.declarers + 1 } : { ...tally, defenders: tally.defenders + 1 };
    const decisive = !settled && (tally.declarers >= decT || tally.defenders >= defT);
    if (decisive) settled = true;
    steps.push({ set: i + 1, hands, trick, tally, decisive, stoppedHere: i === tricks.length - 1 && tricks.length < 13 });
  });
  return steps;
}
