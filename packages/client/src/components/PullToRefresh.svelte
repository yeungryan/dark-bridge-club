<script lang="ts">
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { buzz } from '../lib/juice/haptics';
  import { settings } from '../lib/juice/settings.svelte';

  // Ryan (QoL): at the top of a screen, pull down and let go to reload the page, like most apps.
  // The browser's own pull-to-refresh is off (app.css: overscroll-behavior), so it can't fire by
  // accident; this one works on every screen, the table included (Ryan, round 23), and inside
  // History and Next night wherever they're open. Never on your hand (swipes play cards), in the
  // bid box (it scrolls) or in a replay.
  let { active }: { active: boolean } = $props();

  /** How far (px) the circle has to come down before letting go reloads. */
  const PULL = 72;
  let pull = $state(0);
  let refreshing = $state(false);
  let start: { x: number; y: number } | null = null;
  let armed = false;
  let mouse = false;

  const ready = $derived(pull >= PULL);

  function at_top(target: Element): boolean {
    if (window.scrollY > 0) return false;
    for (let el: Element | null = target; el; el = el.parentElement) if (el.scrollTop > 0) return false;
    return true;
  }

  /** Whether a pull may start here; if so, it's tracked from this point. */
  function begin(target: EventTarget | null, x: number, y: number): boolean {
    if (refreshing || !(target instanceof Element)) return false;
    if (target.closest('.hand, .box, .replay, input, textarea, select')) return false;
    if (!active && !target.closest('.history, .scheduler')) return false;
    if (!at_top(target)) return false;
    start = { x, y };
    armed = false;
    return true;
  }

  function move(x: number, y: number) {
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    // A sideways swipe (the player chips, the award cards) or an upward scroll is not a pull.
    if (pull === 0 && (dy < 0 || Math.abs(dx) > Math.abs(dy))) {
      if (Math.abs(dx) > 10 || dy < -10) start = null;
      return;
    }
    pull = Math.max(0, Math.min(PULL * 1.6, dy * 0.55));
    if (pull >= PULL && !armed) {
      armed = true;
      buzz('tap');
    } else if (pull < PULL) armed = false;
  }

  function end() {
    if (!start) return;
    start = null;
    if (pull > 8 && mouse) {
      // A mouse pull ends with a click on whatever is under it: swallow that one.
      window.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true });
    }
    if (pull >= PULL) {
      refreshing = true;
      pull = PULL;
      setTimeout(() => location.reload(), 180);
    } else pull = 0;
  }

  $effect(() => {
    const opts = { passive: true } as const;
    const ts = (e: TouchEvent) => {
      mouse = false;
      if (e.touches.length === 1) begin(e.target, e.touches[0]!.clientX, e.touches[0]!.clientY);
      else ((start = null), (pull = 0));
    };
    const tm = (e: TouchEvent) => e.touches.length === 1 && move(e.touches[0]!.clientX, e.touches[0]!.clientY);
    const pd = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      mouse = true;
      // With a mouse, stop the press selecting text or dragging a selection: either swallows the pull.
      if (begin(e.target, e.clientX, e.clientY)) e.preventDefault();
    };
    const pm = (e: PointerEvent) => e.pointerType === 'mouse' && move(e.clientX, e.clientY);
    const pu = (e: PointerEvent) => e.pointerType === 'mouse' && end();
    window.addEventListener('touchstart', ts, opts);
    window.addEventListener('touchmove', tm, opts);
    window.addEventListener('touchend', end, opts);
    window.addEventListener('touchcancel', end, opts);
    window.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm, opts);
    window.addEventListener('pointerup', pu, opts);
    return () => {
      window.removeEventListener('touchstart', ts);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
      window.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
    };
  });
</script>

{#if pull > 0}
  <div
    class="pull"
    class:ready
    class:refreshing
    class:still={!settings.motion}
    style="transform: translate(-50%, {pull - 44}px); opacity: {Math.min(1, pull / (PULL * 0.6))}"
    role="status"
    aria-live="polite"
  >
    <span class="ring" style="transform: rotate({settings.motion ? pull * 4 : 0}deg)"><RefreshCw size={20} strokeWidth={2.25} /></span>
    <span class="label">{refreshing ? 'Refreshing…' : ready ? 'Let go to refresh' : 'Pull to refresh'}</span>
  </div>
{/if}

<style>
  .pull {
    position: fixed;
    top: 0;
    left: 50%;
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    pointer-events: none;
  }
  .ring {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--felt-light);
    border: 1px solid var(--line);
    color: var(--ink);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    transition: background 0.15s, color 0.15s;
  }
  .ready .ring {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .refreshing:not(.still) .ring {
    animation: spin 0.7s linear infinite;
  }
  .label {
    font-size: 13px;
    color: var(--ink);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    white-space: nowrap;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
