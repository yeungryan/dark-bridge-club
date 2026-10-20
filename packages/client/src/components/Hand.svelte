<script lang="ts">
  import type { Card as CardT } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { sameCard } from '../lib/format';
  import { buzz } from '../lib/juice/haptics';
  import { launch } from '../lib/juice/launch.svelte';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import { TIMING } from '../lib/juice/timing';
  import Card from './Card.svelte';

  // Spec S11: tap a card to lift it for a closer look; drag or flick it up to the table to play.
  // The card follows your finger anywhere, the table glows once it will play, and it flies
  // on from exactly where you let go. Settings → "Play cards by: Tap twice" brings back
  // tap-to-raise, tap-again-to-play.
  let { conn }: { conn: Connection } = $props();

  const deal = $derived(conn.view!.deal!);
  const myTurnToPlay = $derived(deal.phase === 'play' && deal.turn === conn.view!.mySeat && !conn.room!.paused);
  let raised = $state<CardT | null>(null);
  let wobble = $state<CardT | null>(null);
  let nudge = $state(0);
  /** Played but not yet confirmed by the server: hidden from the hand, shown as a ghost. */
  let pending = $state<{ card: CardT; rect: DOMRect } | null>(null);
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let width = $state(360);

  // Clear the raised and pending cards only when the hand itself changes (a card was played or
  // a new deal started). Other server updates (presence, someone else's move) must not drop
  // them, or the second tap would just raise the card again.
  const handKey = $derived(deal.hand.map((c) => c.suit + c.rank).join(','));
  $effect(() => {
    void handKey;
    raised = null;
    pending = null;
  });

  const cardWidth = $derived(Math.min(76, Math.max(46, Math.floor(width / 6.2))));
  const step = $derived(deal.hand.length > 1 ? Math.min(cardWidth * 0.82, (width - cardWidth) / (deal.hand.length - 1)) : 0);
  const isLegal = (c: CardT) => deal.legalPlays.some((l) => sameCard(l, c));
  const tapStyle = $derived(settings.playStyle === 'tap');

  function reject(card: CardT) {
    wobble = card;
    sound.no();
    buzz('no');
    setTimeout(() => (wobble = null), 300);
  }

  function play(card: CardT, el: HTMLElement | null) {
    const rect = (el?.querySelector('.card') ?? el)?.getBoundingClientRect();
    if (rect) {
      launch.set(card, rect);
      pending = { card, rect };
      if (pendingTimer) clearTimeout(pendingTimer);
      // If the server never confirms (a lost message), give the card back.
      pendingTimer = setTimeout(() => {
        pending = null;
        launch.clear();
      }, 3000);
    }
    conn.intent({ type: 'deal', action: { type: 'play', card } });
    raised = null;
  }

  function tap(card: CardT, el: HTMLElement | null, keyboard = false) {
    const isRaised = raised !== null && sameCard(raised, card);
    if (!isRaised) {
      raised = card;
      sound.tap();
      buzz('tap');
      return;
    }
    if (!myTurnToPlay) {
      raised = null;
      return;
    }
    if (!isLegal(card)) return reject(card);
    // Tap-twice style (and the keyboard) play on the second tap; drag style asks for a swipe.
    if (tapStyle || keyboard) return play(card, el);
    nudge++;
  }

  // Drag: the card follows your finger. Let go far enough up (or flick it) to play it.
  const MOVE_SLOP = 8;
  let drag = $state<{ card: CardT; x: number; y: number; dx: number; dy: number; moved: boolean; vy: number; t: number; lastY: number } | null>(
    null,
  );

  const playable = (card: CardT) => myTurnToPlay && isLegal(card);
  const willPlay = (d: NonNullable<typeof drag>) =>
    playable(d.card) && (d.dy <= -TIMING.dragToPlay || (d.vy <= -TIMING.flickSpeed && d.dy <= -TIMING.flickMin));

  $effect(() => {
    launch.armed = drag !== null && drag.moved && willPlay(drag);
  });

  function down(e: PointerEvent, card: CardT) {
    if (!e.isPrimary || pending) return;
    drag = { card, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false, vy: 0, t: e.timeStamp, lastY: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) > MOVE_SLOP || Math.abs(dy) > MOVE_SLOP) drag.moved = true;
    // Upward speed, smoothed (px/ms; negative is up).
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.vy = drag.vy * 0.4 + ((e.clientY - drag.lastY) / dt) * 0.6;
    drag.t = e.timeStamp;
    drag.lastY = e.clientY;
    // A card you can play follows your finger freely; others resist.
    const free = playable(drag.card);
    drag.dx = free ? dx : dx * 0.15;
    drag.dy = free ? dy : Math.min(0, dy) * 0.2;
  }

  function release(e: PointerEvent) {
    if (!drag) return;
    const d = drag;
    drag = null;
    const el = e.currentTarget as HTMLElement;
    if (!d.moved) return tap(d.card, el);
    if (willPlay(d)) {
      // Measure where the card is now (under your finger) before it's hidden.
      return play(d.card, el);
    }
    if (d.dy < -MOVE_SLOP && myTurnToPlay && !isLegal(d.card)) reject(d.card);
  }

  const dragging = (card: CardT) => drag !== null && drag.moved && sameCard(drag.card, card);
  const isPending = (card: CardT) => pending !== null && sameCard(pending.card, card);
</script>

<div class="hand" bind:clientWidth={width} style="height: {cardWidth * 1.4 + 22}px">
  {#each deal.hand as card, i (card.suit + card.rank)}
    {@const up = raised !== null && sameCard(raised, card)}
    {@const held = dragging(card)}
    <button
      class="slot"
      class:up
      class:wobble={wobble !== null && sameCard(wobble, card)}
      class:dragging={held}
      class:armed={held && launch.armed}
      class:gone={isPending(card)}
      class:tilt={settings.motion}
      style="left: {i * step}px; {held ? `transform: translate(${drag!.dx}px, ${drag!.dy}px) rotate(${drag!.dx * 0.04}deg) scale(1.1)` : ''}"
      onpointerdown={(e) => down(e, card)}
      onpointermove={move}
      onpointerup={release}
      onpointercancel={() => (drag = null)}
      onclick={(e) => {
        // Keyboard activation only; pointer taps are handled in release().
        if (e.detail === 0) tap(card, e.currentTarget as HTMLElement, true);
      }}
      aria-label={up ? (tapStyle ? 'Tap again to play' : 'Swipe up to play') : 'Select card'}
    >
      {#key up ? nudge : 0}
        <div class="lift" class:nudge={up && nudge > 0}>
          <Card {card} width={cardWidth} dim={myTurnToPlay && !isLegal(card)} highlight={up || held} />
        </div>
      {/key}
    </button>
  {/each}
</div>
{#if pending}
  <!-- Your card, waiting where you let go until the table confirms it (a few tens of ms). -->
  <div class="ghost" style="left: {pending.rect.left}px; top: {pending.rect.top}px">
    <Card card={pending.card} width={pending.rect.width} highlight />
  </div>
{/if}
{#if raised && myTurnToPlay && !pending}
  {#key nudge}
    <p class="hint" class:flash={nudge > 0}>{tapStyle ? 'Tap it again, or drag it up, to play.' : 'Swipe it up to the table to play.'}</p>
  {/key}
{/if}

<style>
  .hand {
    position: relative;
    margin: 0 auto;
    width: 100%;
  }
  .slot {
    position: absolute;
    bottom: 0;
    padding: 0;
    border: 0;
    background: none;
    min-height: 0;
    touch-action: none;
    transition: transform calc(180ms * var(--speed)) cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  /* A lifted card rises, grows, and sits on top of its neighbours. */
  .slot.up {
    transform: translateY(-26px) scale(1.12);
    z-index: 2;
  }
  .slot.up.tilt {
    transform: translateY(-26px) scale(1.12) rotate(-2deg);
  }
  .slot.dragging {
    transition: none;
    z-index: 30;
    filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.5));
  }
  .slot.armed {
    filter: drop-shadow(0 0 14px rgba(232, 194, 90, 0.9));
  }
  .slot.gone {
    visibility: hidden;
  }
  .slot.wobble {
    animation: wobble 0.3s;
  }
  @keyframes wobble {
    25% { transform: translate(-5px, -26px) scale(1.12); }
    75% { transform: translate(5px, -26px) scale(1.12); }
  }
  /* Tapping a lifted card (drag style): it hops, as if to say "throw me". */
  :global(.fx-full) .lift.nudge {
    animation: hop calc(360ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  @keyframes hop {
    40% {
      transform: translateY(-16px);
    }
  }
  .ghost {
    position: fixed;
    z-index: 40;
    pointer-events: none;
    filter: drop-shadow(0 0 14px rgba(232, 194, 90, 0.9));
  }
  .hint {
    text-align: center;
    font-size: 14px;
    color: var(--ink-dim);
    margin: 4px 0 0;
  }
  .hint.flash {
    color: var(--accent);
    font-weight: 650;
    animation: fade-in calc(200ms * var(--speed));
  }
</style>
