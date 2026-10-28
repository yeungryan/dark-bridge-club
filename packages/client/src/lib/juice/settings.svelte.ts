import { options } from '../session';
import { installSprings } from './spring';
import { SPEED, speedFactor } from './timing';

// Spec S16/S17: per-player feel settings, remembered on this device.
//  - effects: full = everything; reduced = fades only (no shake, particles or movement); off = static.
//  - speed:   fast plays every animation at 0.6×.
//  - volume / muted: sound effects only; there is no music.
//  - haptics: phone vibration on big moments (Android; iPhone browsers can't vibrate).

export type EffectsMode = 'full' | 'reduced' | 'off';
export type SpeedMode = keyof typeof SPEED;

const KEY = `dark.${options.slot}.settings`;

interface Saved {
  effects: EffectsMode;
  speed: SpeedMode;
  volume: number;
  muted: boolean;
  haptics: boolean;
  /** Saved-settings version; v1 (M2) had a much quieter default volume. */
  v: number;
}

const VERSION = 2;

function prefersReducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function load(): Saved {
  const defaults: Saved = {
    effects: prefersReducedMotion() ? 'reduced' : 'full',
    speed: 'normal',
    volume: 0.7,
    muted: false,
    haptics: true,
    v: VERSION,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved> & { playStyle?: unknown };
    // Round 19: one way to play cards for everyone, so the old "Play cards" choice is gone.
    delete saved.playStyle;
    // M2 saved its too-quiet default on every phone; start those over at the new volume.
    if ((saved.v ?? 1) < VERSION) delete saved.volume;
    return { ...defaults, ...saved, v: VERSION };
  } catch {
    return defaults;
  }
}

class Settings {
  effects = $state<EffectsMode>('full');
  speed = $state<SpeedMode>('normal');
  volume = $state(0.7);
  muted = $state(false);
  haptics = $state(true);

  constructor() {
    const { v: _v, ...saved } = load();
    Object.assign(this, saved);
    $effect.root(() => {
      $effect(() => {
        const saved: Saved = {
          effects: this.effects,
          speed: this.speed,
          volume: this.volume,
          muted: this.muted,
          haptics: this.haptics,
          v: VERSION,
        };
        try {
          localStorage.setItem(KEY, JSON.stringify(saved));
        } catch {
          // Private mode: settings last for this visit only.
        }
        // CSS reads these: --speed scales durations; fx-* classes switch animation styles.
        const root = document.documentElement;
        root.style.setProperty('--speed', String(speedFactor(this.speed)));
        root.classList.remove('fx-full', 'fx-reduced', 'fx-off');
        root.classList.add(`fx-${this.effects}`);
        if (!root.style.getPropertyValue('--spring-pop')) installSprings(root);
      });
    });
  }

  /** Duration at the current speed. */
  ms(base: number): number {
    return Math.round(base * speedFactor(this.speed));
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
