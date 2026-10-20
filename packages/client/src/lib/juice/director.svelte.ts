import { trumpSuit, type Seat, type Side, type Suit } from '@dark/engine';
import type { Connection } from '../connection.svelte';
import { buzz } from './haptics';
import { intensityOf, momentsFrom, type Moment } from './moments';
import { burst, comet } from './particles';
import { settings } from './settings.svelte';
import { sound } from './sound';
import { DRAMA_BOOST, RESPONSES, TIMING, type Level } from './timing';

// Spec S16: the one place that decides how big each moment feels, and when.
// Components never shake, burst or play sounds for table moments themselves; they read the
// state here. Beats are timed to the visuals: a card's sound plays when it lands, a trick's
// payoff when its last card lands, a score pip when the trick's orb reaches the score bar.

export interface ClinchFx {
  side: Side;
  seat: Seat;
  drama: number;
  /** Increments each clinch so components can react to a new one. */
  id: number;
}

/** The trick-won sequence, by trick number: win (pulse), then sweep, then done. */
export interface TrickFx {
  trick: number;
  winner: Seat;
  kind: 'normal' | 'trump' | 'first';
  phase: 'landing' | 'win' | 'sweep' | 'done';
}

type Link = Pick<Connection, 'view' | 'room' | 'onEvents'>;

class Director {
  /** Current shake offset in px, applied to the trick area only. */
  shakeX = $state(0);
  shakeY = $state(0);
  /** Bumped when the auction is won ("Sold!"), so the contract badge can stamp in. */
  contractPulse = $state(0);
  /** "Going once" (1) / "going twice" (2) after the last bid; 0 otherwise. */
  going = $state(0);
  /** Latest clinch, for the meters' glow and the trick area's freeze. */
  clinch = $state<ClinchFx | null>(null);
  /** True while the clinch hit-pause is holding (the payoff hasn't fired yet). */
  holding = $state(false);
  /** The finished trick being celebrated. */
  trickFx = $state<TrickFx | null>(null);
  /** A big translucent suit symbol behind the trick (trump-in, trump tricks). */
  flash = $state<{ suit: Suit; big: boolean; id: number } | null>(null);
  /** A stamped word across the trick area ("First trump!"). */
  banner = $state<{ text: string; id: number } | null>(null);
  /** Score-bar pips shown, per side, while a trick's orb is still flying there. */
  pipHold = $state<Record<Side, number | null>>({ declarers: null, defenders: null });

  /** Trick sequences; a newer trick cancels an older one's remaining beats. */
  private seq = 0;
  /** Ids for one-off effects (flashes, banners, clinches). */
  private fxId = 0;
  private stop: (() => void) | null = null;

  attach(conn: Link): void {
    this.stop?.();
    this.reset();
    this.stop = conn.onEvents((events) => {
      if (!conn.view) return;
      const moments = momentsFrom(events, conn.view);
      const settles = moments.some((m) => m.kind === 'clinch');
      for (const m of moments) this.respond(m, conn, settles);
      if (events.some((e) => e.type === 'dealStarted')) this.reset();
    });
  }

  private reset(): void {
    this.going = 0;
    this.trickFx = null;
    this.banner = null;
    this.flash = null;
    this.pipHold = { declarers: null, defenders: null };
  }

  private respond(m: Moment, conn: Link, settles: boolean): void {
    const fly = settings.animated ? settings.ms(TIMING.cardFly) : 0;
    const level = intensityOf(m);
    switch (m.kind) {
      case 'call':
        if (m.call.type === 'bid') {
          this.going = 0;
          sound.stamp(m.call.level, m.mine);
        } else {
          sound.pass(m.mine);
          if (m.going > 0) {
            this.going = m.going;
            setTimeout(() => sound.going(m.going), 140);
          }
        }
        if (m.mine) buzz('tap');
        break;
      case 'contractSet':
        this.going = 0;
        this.contractPulse++;
        sound.sold();
        buzz('sold');
        setTimeout(() => this.burstAt('.contract', 26, [this.colorOf(conn, m.declarer), '#e8c25a', '#fbf8f0']), 60);
        break;
      case 'passedOut':
        this.going = 0;
        sound.passedOut();
        break;
      case 'cardPlayed':
        // The sound and the payoff land with the card, not when the message arrives.
        setTimeout(() => {
          sound.card(m.mine);
          if (m.mine) buzz('card');
          if (m.trumpIn) {
            sound.trumpIn();
            buzz('trumpIn');
            this.flashSuit(conn, false);
          } else if (m.lead > 0 && !m.completes) {
            sound.lead(m.lead);
            if (m.mine) buzz('lead');
          }
          if (m.lead > 0 && !m.completes) this.hit(level, `.area [data-seat="${m.seat}"]`, this.colorOf(conn, m.seat));
        }, fly);
        break;
      case 'trickWon':
        this.playTrick(m, conn, settles, fly);
        break;
      case 'oneAway':
        setTimeout(() => sound.close(), fly + 200);
        break;
      case 'decider':
        setTimeout(() => sound.decider(), fly + 300);
        break;
      case 'clinch':
        setTimeout(() => this.playClinch(m, conn), fly);
        break;
      case 'nightEnded':
        sound.fanfare();
        break;
      case 'dealComplete':
        break;
    }
  }

  /**
   * A trick is won: its last card lands → (hit-pause) → the winner pulses with sound, sparks
   * and shake → the trick sweeps to the winner → an orb flies to the score bar → the pip pops.
   * The trick that settles the deal skips all that; the clinch is its moment.
   */
  private playTrick(m: Extract<Moment, { kind: 'trickWon' }>, conn: Link, settles: boolean, fly: number): void {
    const deal = conn.view?.deal;
    const trick = deal?.tricksPlayed ?? 0;
    const side = m.side;
    if (settles) {
      this.trickFx = { trick, winner: m.winner, kind: 'normal', phase: 'win' };
      return;
    }
    const kind: TrickFx['kind'] = m.firstTrump ? 'first' : m.trump ? 'trump' : 'normal';
    const level = intensityOf(m) as Level;
    const id = ++this.seq;
    const alive = () => this.trickFx?.trick === trick && this.seq === id;
    const pause = settings.animated ? settings.ms(RESPONSES[level].hitPauseMs) : 0;
    const hold = settings.animated ? settings.ms(TIMING.trickHold + (kind === 'first' ? TIMING.firstTrumpHold : 0)) : 900;
    const sweep = settings.motion ? settings.ms(TIMING.sweep) : 0;

    this.trickFx = { trick, winner: m.winner, kind, phase: 'landing' };
    this.pipHold = { ...this.pipHold, [side]: m.pip };
    const mineWon = conn.view?.mySeat !== null && conn.view?.mySeat !== undefined && (m.winner - conn.view.mySeat) % 2 === 0;

    setTimeout(() => {
      if (!alive()) return;
      this.trickFx = { ...this.trickFx!, phase: 'win' };
      if (kind === 'first') {
        sound.firstTrump();
        buzz('firstTrump');
        this.banner = { text: 'First trump!', id: ++this.fxId };
        this.flashSuit(conn, true);
      } else if (kind === 'trump') {
        sound.trumpTrick();
        if (mineWon) buzz('trumpTrick');
        this.flashSuit(conn, true);
      } else {
        sound.lead(2);
        if (mineWon) buzz('trick');
      }
      this.hit(level, `.area [data-seat="${m.winner}"]`, this.colorOf(conn, m.winner));
    }, fly + pause);

    setTimeout(() => {
      if (!alive()) return;
      this.trickFx = { ...this.trickFx!, phase: 'sweep' };
      if (sweep > 0) sound.sweep();
    }, fly + pause + hold);

    setTimeout(() => {
      if (this.seq === id && this.trickFx) this.trickFx = { ...this.trickFx, phase: 'done' };
      this.sendOrb(conn, m.winner, side, m.pip, kind);
    }, fly + pause + hold + sweep);
  }

  /** The orb from the winner's name to their side's next score pip. */
  private sendOrb(conn: Link, winner: Seat, side: Side, pip: number, kind: TrickFx['kind']): void {
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      if (this.pipHold[side] === pip) this.pipHold = { ...this.pipHold, [side]: null };
      sound.pip(pip);
    };
    const from = this.centerOf(`[data-badge-seat="${winner}"]`);
    const to = this.centerOf(`.meters [data-side="${side}"] .pips i:nth-child(${pip + 1})`);
    const color = kind === 'normal' ? this.colorOf(conn, winner) : '#c58bff';
    const duration = settings.ms(TIMING.orbFly);
    if (from && to) comet(from, to, duration, color, land);
    else land();
    // If the page was hidden mid-flight, don't leave the score bar behind.
    setTimeout(land, duration + 600);
  }

  /** Hit-pause → shake + burst + chord (level 5). */
  private playClinch(m: Extract<Moment, { kind: 'clinch' }>, conn: Link): void {
    const id = ++this.fxId;
    this.seq++;
    this.clinch = { side: m.side, seat: m.seat, drama: m.drama, id };
    this.pipHold = { declarers: null, defenders: null };
    const base = RESPONSES[5];
    const pause = settings.animated ? settings.ms(base.hitPauseMs) : 0;
    this.holding = pause > 0;
    setTimeout(() => {
      if (this.clinch?.id !== id) return;
      this.holding = false;
      sound.clinch(m.drama);
      buzz('clinch');
      this.shake(base.shakePx + DRAMA_BOOST.shakePx * m.drama);
      this.burstAt(`.area [data-seat="${m.seat}"]`, base.particles + DRAMA_BOOST.particles * m.drama, [
        this.colorOf(conn, m.seat),
        '#e8c25a',
        '#fbf8f0',
      ]);
    }, pause);
  }

  /** The shared response for a level: shake the trick area and burst at an element. */
  private hit(level: Level, selector: string, color: string): void {
    const r = RESPONSES[level];
    this.shake(r.shakePx);
    this.burstAt(selector, r.particles, [color, '#e8c25a', '#fbf8f0']);
  }

  private flashSuit(conn: Link, big: boolean): void {
    const contract = conn.view?.deal?.contract;
    const suit = contract ? trumpSuit(contract.strain) : null;
    if (suit && settings.animated) this.flash = { suit, big, id: ++this.fxId };
  }

  private colorOf(conn: Link, seat: Seat): string {
    const id = conn.view?.seating?.[seat];
    return conn.room?.profiles.find((p) => p.id === id)?.color ?? '#e8c25a';
  }

  private centerOf(selector: string): { x: number; y: number } | null {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  private burstAt(selector: string, count: number, colors: string[]): void {
    const c = this.centerOf(selector);
    if (c) burst(c.x, c.y, count, colors);
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
