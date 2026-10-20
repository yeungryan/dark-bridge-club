import type { Seat, Side } from '@dark/engine';
import type { Connection } from '../connection.svelte';
import { momentsFrom, type Moment } from './moments';
import { burst } from './particles';
import { settings } from './settings.svelte';
import { sound } from './sound';
import { DRAMA_BOOST, RESPONSES, TIMING } from './timing';

// Spec S16: the one place that decides how big each moment feels.
// Components never shake, burst or play sounds themselves; they read the state here.

export interface ClinchFx {
  side: Side;
  seat: Seat;
  drama: number;
  /** Increments each clinch so components can react to a new one. */
  id: number;
}

class Director {
  /** Current shake offset in px, applied to the trick area only. */
  shakeX = $state(0);
  shakeY = $state(0);
  /** Bumped on contract set, so the contract badge can pulse. */
  contractPulse = $state(0);
  /** Latest clinch, for the meters' glow and the trick area's freeze. */
  clinch = $state<ClinchFx | null>(null);
  /** True while the clinch hit-pause is holding (the payoff hasn't fired yet). */
  holding = $state(false);

  private clinchCount = 0;
  private stop: (() => void) | null = null;

  attach(conn: Connection): void {
    this.stop?.();
    this.stop = conn.onEvents((events) => {
      if (!conn.view) return;
      for (const m of momentsFrom(events, conn.view)) this.respond(m, conn);
    });
  }

  private respond(m: Moment, conn: Connection): void {
    switch (m.kind) {
      case 'call':
        sound.stamp(m.mine);
        break;
      case 'cardPlayed':
        sound.card(m.mine);
        break;
      case 'contractSet':
        this.contractPulse++;
        sound.accent();
        break;
      case 'trickWon':
        sound.pip(m.pip);
        if (m.trumpOver) setTimeout(() => sound.accent(), 60);
        break;
      case 'oneAway':
        sound.close();
        break;
      case 'decider':
        sound.decider();
        break;
      case 'clinch':
        this.playClinch(m, conn);
        break;
      case 'nightEnded':
        sound.fanfare();
        break;
      case 'passedOut':
      case 'dealComplete':
        break;
    }
  }

  /** Hit-pause → shake + burst + chord (level 5). */
  private playClinch(m: Extract<Moment, { kind: 'clinch' }>, conn: Connection): void {
    const id = ++this.clinchCount;
    this.clinch = { side: m.side, seat: m.seat, drama: m.drama, id };
    const base = RESPONSES[5];
    const pause = settings.animated ? settings.ms(base.hitPauseMs) : 0;
    this.holding = pause > 0;
    setTimeout(() => {
      if (this.clinch?.id !== id) return;
      this.holding = false;
      sound.clinch(m.drama);
      if (!settings.motion) return;
      this.shake(base.shakePx + DRAMA_BOOST.shakePx * m.drama);
      const el = document.querySelector<HTMLElement>(`.area [data-seat="${m.seat}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        const player = conn.room?.profiles.find((p) => p.id === conn.view?.seating?.[m.seat]);
        burst(r.left + r.width / 2, r.top + r.height / 2, base.particles + DRAMA_BOOST.particles * m.drama, [
          player?.color ?? '#e8c25a',
          '#e8c25a',
          '#fbf8f0',
        ]);
      }
    }, pause);
  }

  /** A decaying shake on the trick area (never on text you need to read or on your hand). */
  shake(px: number): void {
    if (!settings.motion || px <= 0) return;
    const start = performance.now();
    const duration = settings.ms(TIMING.shakeDecay);
    const frame = (now: number) => {
      const t = (now - start) / duration;
      if (t >= 1) {
        this.shakeX = 0;
        this.shakeY = 0;
        return;
      }
      const amp = px * (1 - t) ** 2;
      this.shakeX = (Math.random() * 2 - 1) * amp;
      this.shakeY = (Math.random() * 2 - 1) * amp;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

export const director = new Director();
