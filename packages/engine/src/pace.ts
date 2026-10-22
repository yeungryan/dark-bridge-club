import type { DealEvent, DealState } from './deal';
import type { SessionEvent } from './session';

// Ryan (round 11, option A): after a set, the next card can't be led until that set's effects
// and sweep have played out, so nobody's effects are cut short by a quick lead. In ms at Normal
// speed, matching the client's timing (client lib/juice/timing.ts): card flight 220 + a beat to
// look 400 + hit-pause up to 90 + the set-win hold 800 + the sweep 280; the first trump set holds
// 450 more; the deciding set has its finisher (1600) and maybe a streak stamp (about 1400). The
// server enforces it; phones and bots wait for it.
export const LEAD_HOLD = { set: 1800, firstTrump: 2250, clinch: 3800 } as const;

/** How long after this move the next lead must wait, or null if it didn't complete a set. */
export function leadHoldAfter(events: readonly SessionEvent[], deal: DealState | null): number | null {
  const dealEvents = events.flatMap((e) => (e.type === 'deal' ? [e.event] : [])) as DealEvent[];
  const won = dealEvents.find((e) => e.type === 'trickWon');
  if (!won || won.type !== 'trickWon') return null;
  if (dealEvents.some((e) => e.type === 'clinched')) return LEAD_HOLD.clinch;
  const strain = deal?.contract?.strain;
  const trump = strain && strain !== 'NT' ? strain : null;
  const trumpWins = trump ? (deal?.tricks ?? []).filter((t) => t.winningCard.suit === trump).length : 0;
  return trump && won.card.suit === trump && trumpWins === 1 ? LEAD_HOLD.firstTrump : LEAD_HOLD.set;
}

/** Whether this play would lead a new set (not the first of the game). */
export function isLead(deal: DealState | null): boolean {
  return !!deal && deal.phase === 'play' && (deal.currentTrick?.cards.length ?? 0) === 0 && deal.tricks.length > 0;
}
