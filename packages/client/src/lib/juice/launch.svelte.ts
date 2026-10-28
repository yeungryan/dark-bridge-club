import type { Card } from '@dark/engine';
import { sameCard } from '../format';

// Spec S11: your card leaves your hand the moment you let go and keeps moving toward the table
// (round 19, Ryan: a flick should feel like an extension of the thumb). The server's
// confirmation arrives a moment later; the trick area then picks the card up from wherever it
// has got to and finishes the flight, so the motion never stops and restarts.

/** How the card was played: flicked (fast, a crisp slap) or placed (dragged or tapped, softer). */
export type Throw = 'flick' | 'place';

interface Flight {
  card: Card;
  /** Where the card left your hand. */
  from: DOMRect;
  /** Where it's heading: the centre of your spot on the table, and its size there (× from). */
  toX: number;
  toY: number;
  toScale: number;
  /** A small tilt it picks up on the way (degrees), from the flick's sideways speed. */
  spin: number;
  start: number;
  dur: number;
  how: Throw;
}

/** Decelerating (ease-out quad): the card leaves at the thumb's speed and slows into its spot. */
export const easeOut = (t: number) => t * (2 - t);
/** The same curve for CSS and the Web Animations API. */
export const EASE_OUT = 'cubic-bezier(0.5, 1, 0.89, 1)';

class Launch {
  current = $state<Flight | null>(null);
  /** The last card you played: when it lands and how it was thrown (for its sound). */
  private last: { card: Card; landAt: number; how: Throw } | null = null;
  /** A card is being dragged and would play if let go now: the table glows. */
  armed = $state(false);

  set(flight: Omit<Flight, 'start'>): void {
    const start = performance.now();
    this.current = { ...flight, start };
    this.last = { card: flight.card, landAt: start + flight.dur, how: flight.how };
  }

  /** Where the card is along its flight right now. */
  private at(f: Flight, now: number) {
    const t = Math.min(1, (now - f.start) / f.dur);
    const k = easeOut(t);
    const cx = f.from.left + f.from.width / 2;
    const cy = f.from.top + f.from.height / 2;
    const s = 1 + (f.toScale - 1) * k;
    const w = f.from.width * s;
    const h = f.from.height * s;
    const x = cx + (f.toX - cx) * k;
    const y = cy + (f.toY - cy) * k;
    return { rect: new DOMRect(x - w / 2, y - h / 2, w, h), spin: f.spin * k, remaining: Math.max(0, f.start + f.dur - now) };
  }

  /** This card's flight so far, if it was just played from this device (the trick area takes over). */
  take(card: Card): { rect: DOMRect; spin: number; remaining: number; how: Throw } | null {
    const f = this.current;
    if (!f || !sameCard(f.card, card) || performance.now() - f.start > 4000) return null;
    this.current = null;
    return { ...this.at(f, performance.now()), how: f.how };
  }

  /** How long until your card lands, and how it was thrown, for the landing sound. */
  landing(card: Card): { inMs: number; how: Throw } | null {
    const l = this.last;
    if (!l || !sameCard(l.card, card) || performance.now() - l.landAt > 4000) return null;
    return { inMs: Math.max(0, l.landAt - performance.now()), how: l.how };
  }

  clear(): void {
    this.current = null;
  }
}

export const launch = new Launch();
