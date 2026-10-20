import type { Card } from '@dark/engine';
import { sameCard } from '../format';

// Spec S11: where your card left your hand, so it can fly to the table from exactly there
// (the server's confirmation arrives a moment later; the trick area picks this up).

interface Launched {
  card: Card;
  rect: DOMRect;
  at: number;
}

class Launch {
  current = $state<Launched | null>(null);
  /** A card is being dragged and would play if let go now: the table glows. */
  armed = $state(false);

  set(card: Card, rect: DOMRect): void {
    this.current = { card, rect, at: performance.now() };
  }

  /** The launch point for this card, if it was just played from this device. */
  take(card: Card): DOMRect | null {
    const c = this.current;
    if (!c || !sameCard(c.card, card) || performance.now() - c.at > 4000) return null;
    this.current = null;
    return c.rect;
  }

  clear(): void {
    this.current = null;
  }
}

export const launch = new Launch();
