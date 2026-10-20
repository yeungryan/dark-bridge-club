import { suitSymbol, trumpSuit, type Seat, type Side, type Suit } from '@dark/engine';
import { elementAtSeat } from '../avatars';
import { cssColor } from '../themes';
import type { Connection } from '../connection.svelte';
import { buzz } from './haptics';
import { intensityOf, momentsFrom, streak, type Moment } from './moments';
import { comet, elementBurst, elementStrike, elementWin, flash, freeze, glyphs, lightBurst, pop, puff, ring, screenFlash, sparks } from './particles';
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

/** Trump moments share one colour, so "that was a trump" reads at a glance. */
const TRUMP_COLOR = '#c58bff';
/** The theme's accent (gold in the Clubhouse). */
const gold = () => cssColor('--accent', '#e8c25a');

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
  /**
   * The deal was settled on its very last trick, so it ended in the same moment: keep the
   * table up long enough for the clinch to land before the reveal takes over.
   */
  revealHold = $state(false);
  /** Score-bar pips shown, per side, while a trick's orb is still flying there. */
  pipHold = $state<Record<Side, number | null>>({ declarers: null, defenders: null });
  /** True during a hit-stop: the table's freeze-frame on a big impact. */
  frozen = $state(false);
  /** Sets won in a row by one side (shown as "×n" once its orb lands); n ≥ 2 is a combo. */
  combo = $state<{ side: Side; n: number; id: number } | null>(null);

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
      if (settles && moments.some((m) => m.kind === 'dealComplete') && settings.animated) {
        this.revealHold = true;
        const fly = settings.ms(TIMING.cardFly);
        setTimeout(() => (this.revealHold = false), fly + settings.ms(RESPONSES[5].hitPauseMs + TIMING.clinchShow));
      }
      if (events.some((e) => e.type === 'dealStarted')) this.reset();
    });
  }

  private reset(): void {
    this.going = 0;
    this.trickFx = null;
    this.banner = null;
    this.flash = null;
    this.pipHold = { declarers: null, defenders: null };
    this.combo = null;
  }

  /**
   * A hit-stop (Balatro): on a big impact everything holds for a beat on the brightest frame,
   * with a punchy thump, then bursts on. `power` 0–3. Input is never frozen.
   */
  private impact(power: number, color?: string): void {
    sound.impact(power);
    if (!settings.motion) return;
    const ms = settings.ms([55, 75, 100, 130][Math.max(0, Math.min(3, power))]!);
    freeze(ms);
    if (color && power >= 2) screenFlash(color, 0.14 + power * 0.07);
    this.frozen = true;
    clearTimeout(this.unfreeze);
    this.unfreeze = setTimeout(() => (this.frozen = false), ms);
  }
  private unfreeze: ReturnType<typeof setTimeout> | undefined;

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
        // An ink-stamp puff behind the contract as it slams into the header.
        setTimeout(() => {
          const c = this.centerOf('.contract');
          if (c) {
            puff(c.x, c.y, 12, '#d8c38f');
            pop(c.x, c.y, gold());
          }
        }, 60);
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
          const at = this.centerOf(`.area [data-seat="${m.seat}"]`);
          if (m.trumpIn) {
            // A shockwave and shards of the trump suit, on a freeze-frame.
            sound.trumpIn();
            buzz('trumpIn');
            this.flashSuit(conn, false);
            this.shake(RESPONSES[level].shakePx);
            if (at) {
              ring(at.x, at.y, TRUMP_COLOR, { radius: 80, width: 4 });
              glyphs(at.x, at.y, 8, this.trumpGlyph(conn), [TRUMP_COLOR, '#f2e6ff'], 'shower');
              lightBurst(at.x, at.y, [TRUMP_COLOR, '#f2e6ff'], 0);
            }
            this.impact(1, TRUMP_COLOR);
          } else if (m.lead > 0 && !m.completes) {
            // Quick sparks: it's ahead now.
            sound.lead(m.lead);
            if (m.mine) buzz('lead');
            this.shake(RESPONSES[level].shakePx);
            if (at) sparks(at.x, at.y, RESPONSES[level].particles, [this.colorOf(conn, m.seat), gold(), '#fff6d8']);
          }
        }, fly);
        break;
      case 'trickWon':
        this.playTrick(m, conn, settles, fly);
        break;
      case 'oneAway':
        setTimeout(() => sound.close(), fly + 200);
        break;
      case 'decider':
        // Both sides one away: the tension swells.
        setTimeout(() => {
          sound.decider();
          sound.riser(0.9);
        }, fly + 300);
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
    // Sets in a row for this side: a combo from the second one, bigger each time.
    const run = streak(deal?.trickWinners ?? []);

    setTimeout(() => {
      if (!alive()) return;
      this.trickFx = { ...this.trickFx!, phase: 'win' };
      const at = this.centerOf(`.area [data-seat="${m.winner}"]`);
      this.shake(RESPONSES[level].shakePx);
      // The winner's element plays out on the winning card (S24): its everyday form (fireball,
      // tornado, tsunami, rock smash) for a normal win; its sub-element (lightning, sound, ice,
      // metal) for a win by trumping a different suit. No avatar: the plain versions.
      const element = elementAtSeat(conn, m.winner);
      const signature = (power: number) => {
        if (!at) return;
        if (!element) return m.trumpOver ? glyphs(at.x, at.y, 7, this.trumpGlyph(conn), [TRUMP_COLOR, '#f2e6ff'], 'rise') : flash(at.x, at.y, gold(), 42);
        if (m.trumpOver) elementStrike(element, at.x, at.y, power);
        else elementWin(element, at.x, at.y);
      };
      if (kind === 'first') {
        // The first trump set: the banner, a big ring and a shower of the trump suit, on top.
        sound.firstTrump();
        buzz('firstTrump');
        this.banner = { text: 'First trump!', id: ++this.fxId };
        this.flashSuit(conn, true);
        signature(2);
        if (at) {
          ring(at.x, at.y, TRUMP_COLOR, { radius: 120, width: 5, frames: 30 });
          glyphs(at.x, at.y, RESPONSES[level].particles / 3, this.trumpGlyph(conn), [TRUMP_COLOR, '#f2e6ff', gold()], 'shower');
        }
        this.impact(2, TRUMP_COLOR);
      } else if (kind === 'trump') {
        sound.trumpTrick();
        if (mineWon) buzz('trumpTrick');
        this.flashSuit(conn, true);
        signature(0);
        this.impact(1, TRUMP_COLOR);
      } else {
        sound.lead(2);
        if (mineWon) buzz('trick');
        signature(0);
      }
      // A combo: the same side again. A rising chime on top, and more light each time.
      if (run >= 2) {
        // A beat after the set-win sound, so the ladder reads as separate notes.
        setTimeout(() => sound.combo(run - 1), 90);
        if (at) lightBurst(at.x, at.y, [this.colorOf(conn, m.winner), gold(), '#fff6d8'], Math.min(3, run - 2));
      }
    }, fly + pause);

    setTimeout(() => {
      if (!alive()) return;
      this.trickFx = { ...this.trickFx!, phase: 'sweep' };
      if (sweep > 0) sound.sweep();
    }, fly + pause + hold);

    setTimeout(() => {
      if (this.seq === id && this.trickFx) this.trickFx = { ...this.trickFx, phase: 'done' };
      this.sendOrb(conn, m.winner, side, m.pip, kind, run);
    }, fly + pause + hold + sweep);
  }

  /** The orb from the winner's name to their side's next score pip. */
  private sendOrb(conn: Link, winner: Seat, side: Side, pip: number, kind: TrickFx['kind'], run = 1): void {
    let landed = false;
    const from = this.centerOf(`[data-badge-seat="${winner}"]`);
    const to = this.centerOf(`.meters [data-side="${side}"] .pips > :nth-child(${pip + 1})`);
    const color = kind === 'normal' ? this.colorOf(conn, winner) : '#c58bff';
    const land = () => {
      if (landed) return;
      landed = true;
      if (this.pipHold[side] === pip) this.pipHold = { ...this.pipHold, [side]: null };
      sound.pip(pip);
      if (to) pop(to.x, to.y, color);
      this.combo = { side, n: run, id: ++this.fxId };
    };
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
      this.impact(Math.min(3, 1 + m.drama), gold());
      this.shake(base.shakePx + DRAMA_BOOST.shakePx * m.drama);
      // The signature effect of whoever played the deciding card (S24): fire, air, water or earth.
      const at = this.centerOf(`.area [data-seat="${m.seat}"]`);
      if (!at) return;
      const element = elementAtSeat(conn, m.seat);
      lightBurst(at.x, at.y, [this.colorOf(conn, m.seat), gold(), '#fffbe8'], Math.min(3, 1 + m.drama));
      if (element) elementBurst(element, at.x, at.y, m.drama);
      else {
        ring(at.x, at.y, gold(), { radius: 110, width: 5 });
        sparks(at.x, at.y, base.particles, [this.colorOf(conn, m.seat), gold(), '#fbf8f0']);
      }
    }, pause);
  }

  private trumpGlyph(conn: Link): string {
    const contract = conn.view?.deal?.contract;
    const suit = contract ? trumpSuit(contract.strain) : null;
    return suit ? suitSymbol(suit) : '★';
  }

  private flashSuit(conn: Link, big: boolean): void {
    const contract = conn.view?.deal?.contract;
    const suit = contract ? trumpSuit(contract.strain) : null;
    if (suit && settings.animated) this.flash = { suit, big, id: ++this.fxId };
  }

  /** Effects take the team colour, like the avatar rings: your pair's accent, the other pair's silver. */
  private colorOf(conn: Link, seat: Seat): string {
    const me = conn.view?.mySeat;
    const mine = me !== null && me !== undefined && (seat - me) % 2 === 0;
    return mine ? gold() : cssColor('--silver', '#c9ced6');
  }

  private centerOf(selector: string): { x: number; y: number } | null {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
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
