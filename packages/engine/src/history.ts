import type { DealState } from './deal';
import type { DealHistory } from './moments';
import type { DealRecord } from './session';
import type { PerSeat } from './types';

// Spec S19: the one way a finished game becomes history for the moment detectors, used by
// the server (from its saved rows) and the practice table (from memory) alike.

/** A finished game as history. `deal` is its full final state when available (not for a pass-out). */
export function dealHistory(record: DealRecord, deal: DealState | null, thinkMs: PerSeat<number> | null): DealHistory {
  return {
    dealNumber: record.dealNumber,
    dealer: record.dealer,
    contract: record.contract,
    result: record.result,
    hands: deal ? deal.originalHands : null,
    tricks: deal ? deal.tricks : null,
    thinkMs,
    seating: record.seating ?? null,
  };
}
