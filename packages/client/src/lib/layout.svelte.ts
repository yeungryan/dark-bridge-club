// Desktop layout B (Ryan, round 22): on a big enough screen the table and hand grow, and a side
// panel on the right holds the bids, the scoreboard and the previous set (or the bid box while
// you're bidding). Smaller screens keep the phone layout exactly as it is.

const QUERY = '(min-width: 1100px) and (min-height: 620px)';

class Layout {
  wide = $state(false);

  constructor() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    this.wide = mq.matches;
    mq.addEventListener('change', (e) => (this.wide = e.matches));
  }
}

export const layout = new Layout();

/** A card on the table, sized to the trick area (the phone keeps its 52px cap). */
export const tableCardWidth = (areaWidth: number): number => Math.max(34, Math.min(layout.wide ? 96 : 52, Math.floor(areaWidth * 0.29)));

/** A card in your hand, sized to the hand's width (the phone keeps its 76px cap). */
export const handCardWidth = (handWidth: number): number => Math.min(layout.wide ? 100 : 76, Math.max(46, Math.floor(handWidth / 6.2)));
