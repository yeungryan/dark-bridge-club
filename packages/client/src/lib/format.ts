import { next, partner, rankLabel, suitSymbol, type Call, type Card, type ProfileInfo, type Seat, type Strain, type TableView } from '@dark/engine';

export const isRed = (card: Card) => card.suit === 'H' || card.suit === 'D';

export function strainLabel(strain: Strain): string {
  return strain === 'NT' ? 'NT' : suitSymbol(strain);
}

export function callLabel(call: Call): string {
  return call.type === 'pass' ? 'Pass' : `${call.level}${strainLabel(call.strain)}`;
}

export function cardText(card: Card): { rank: string; suit: string } {
  return { rank: rankLabel(card.rank), suit: suitSymbol(card.suit) };
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Where each seat appears on your screen: you at the bottom, the next player (your right) on the right. */
export type Spot = 'bottom' | 'right' | 'top' | 'left';

export function spotOf(seat: Seat, mySeat: Seat): Spot {
  if (seat === mySeat) return 'bottom';
  if (seat === next(mySeat)) return 'right';
  if (seat === partner(mySeat)) return 'top';
  return 'left';
}

export function seatAt(spot: Spot, mySeat: Seat): Seat {
  switch (spot) {
    case 'bottom':
      return mySeat;
    case 'right':
      return next(mySeat);
    case 'top':
      return partner(mySeat);
    case 'left':
      return next(partner(mySeat));
  }
}

export function profileOf(profiles: readonly ProfileInfo[], id: string | undefined): ProfileInfo {
  return profiles.find((p) => p.id === id) ?? { id: id ?? '?', name: id ?? '?', color: '#888' };
}

export function nameAtSeat(view: TableView, profiles: readonly ProfileInfo[], seat: Seat): string {
  return profileOf(profiles, view.seating?.[seat]).name;
}

export function pairNames(view: TableView, profiles: readonly ProfileInfo[], pair: 'A' | 'B'): string {
  return (view.pairs?.[pair] ?? []).map((id) => profileOf(profiles, id).name).join(' & ');
}
