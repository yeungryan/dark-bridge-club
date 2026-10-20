import { options } from '../session';
import { SPEED } from './timing';

// Spec S16/S17: per-player feel settings, remembered on this device.
//  - effects: full = everything; reduced = fades only (no shake, particles or movement); off = static.
//  - speed:   fast plays every animation at 0.6×.
//  - volume / muted: sound effects only; there is no music.

export type EffectsMode = 'full' | 'reduced' | 'off';
export type SpeedMode = keyof typeof SPEED;

const KEY = `dark.${options.slot}.settings`;

interface Saved {
  effects: EffectsMode;
  speed: SpeedMode;
  volume: number;
  muted: boolean;
}

function prefersReducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function load(): Saved {
  const defaults: Saved = { effects: prefersReducedMotion() ? 'reduced' : 'full', speed: 'normal', volume: 0.4, muted: false };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>) };
  } catch {
    return defaults;
  }
}

class Settings {
  effects = $state<EffectsMode>('full');
  speed = $state<SpeedMode>('normal');
  volume = $state(0.4);
  muted = $state(false);

  constructor() {
    Object.assign(this, load());
    $effect.root(() => {
      $effect(() => {
        const saved: Saved = { effects: this.effects, speed: this.speed, volume: this.volume, muted: this.muted };
        try {
          localStorage.setItem(KEY, JSON.stringify(saved));
        } catch {
          // Private mode: settings last for this visit only.
        }
        // CSS reads these: --speed scales durations; fx-* classes switch animation styles.
        const root = document.documentElement;
        root.style.setProperty('--speed', String(SPEED[this.speed]));
        root.classList.remove('fx-full', 'fx-reduced', 'fx-off');
        root.classList.add(`fx-${this.effects}`);
      });
    });
  }

  /** Duration at the current speed. */
  ms(base: number): number {
    return Math.round(base * SPEED[this.speed]);
  }

  get motion(): boolean {
    return this.effects === 'full';
  }

  get animated(): boolean {
    return this.effects !== 'off';
  }

  get effectiveVolume(): number {
    return this.muted ? 0 : this.volume;
  }
}

export const settings = new Settings();
