<script lang="ts">
  import type { Card as CardT } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { sameCard } from '../lib/format';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import Card from './Card.svelte';

  // Spec S11 (M1: works, M2: feels great): tap once to raise, tap again to play.
  let { conn }: { conn: Connection } = $props();

  const deal = $derived(conn.view!.deal!);
  const myTurnToPlay = $derived(deal.phase === 'play' && deal.turn === conn.view!.mySeat && !conn.room!.paused);
  let raised = $state<CardT | null>(null);
  let wobble = $state<CardT | null>(null);
  let width = $state(360);

  // Clear the raised card only when the hand itself changes (a card was played or a new deal
  // started). Other server updates (presence, someone else's move) must not drop it, or the
  // second tap would just raise the card again.
  const handKey = $derived(deal.hand.map((c) => c.suit + c.rank).join(','));
  $effect(() => {
    void handKey;
    raised = null;
  });

  const cardWidth = $derived(Math.min(76, Math.max(46, Math.floor(width / 6.2))));
  const step = $derived(deal.hand.length > 1 ? Math.min(cardWidth * 0.82, (width - cardWidth) / (deal.hand.length - 1)) : 0);
  const isLegal = (c: CardT) => deal.legalPlays.some((l) => sameCard(l, c));

  function reject(card: CardT) {
    wobble = card;
    sound.no();
    setTimeout(() => (wobble = null), 300);
  }

  function play(card: CardT) {
    conn.intent({ type: 'deal', action: { type: 'play', card } });
    raised = null;
  }

  function tap(card: CardT) {
    if (raised && sameCard(raised, card)) {
      if (!myTurnToPlay) return;
      if (!isLegal(card)) return reject(card);
      return play(card);
    }
    raised = card;
  }

  // Drag a card upward past the line to play it; let go below the line and it springs back.
  const DRAG_TO_PLAY = 70;
  const MOVE_SLOP = 8;
  let drag = $state<{ card: CardT; x: number; y: number; dy: number; moved: boolean } | null>(null);

  function down(e: PointerEvent, card: CardT) {
    if (!e.isPrimary) return;
    drag = { card, x: e.clientX, y: e.clientY, dy: 0, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) > MOVE_SLOP || Math.abs(dy) > MOVE_SLOP) drag.moved = true;
    // Only a playable card follows the finger freely; others resist.
    const free = myTurnToPlay && isLegal(drag.card);
    drag.dy = Math.min(0, free ? dy : dy * 0.2);
  }

  function release() {
    if (!drag) return;
    const { card, dy, moved } = drag;
    drag = null;
    if (!moved) return tap(card);
    if (dy <= -DRAG_TO_PLAY && myTurnToPlay && isLegal(card)) return play(card);
    if (dy < -MOVE_SLOP && myTurnToPlay && !isLegal(card)) reject(card);
  }

  const dragging = (card: CardT) => drag !== null && drag.moved && sameCard(drag.card, card);
</script>

<div class="hand" bind:clientWidth={width} style="height: {cardWidth * 1.4 + 22}px">
  {#each deal.hand as card, i (card.suit + card.rank)}
    {@const up = raised !== null && sameCard(raised, card)}
    <button
      class="slot"
      class:up
      class:wobble={wobble !== null && sameCard(wobble, card)}
      class:dragging={dragging(card)}
      class:tilt={settings.motion}
      style="left: {i * step}px; {dragging(card) ? `transform: translateY(${drag!.dy}px)` : ''}"
      onpointerdown={(e) => down(e, card)}
      onpointermove={move}
      onpointerup={release}
      onpointercancel={() => (drag = null)}
      onclick={(e) => {
        // Keyboard activation only; pointer taps are handled in release().
        if (e.detail === 0) tap(card);
      }}
      aria-label={up ? 'Tap again to play' : 'Select card'}
    >
      <Card {card} width={cardWidth} dim={myTurnToPlay && !isLegal(card)} highlight={up} />
    </button>
  {/each}
</div>
{#if raised && myTurnToPlay}
  <p class="hint">Tap it again, or drag it up, to play.</p>
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
    transition: transform calc(160ms * var(--speed)) cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .slot.up {
    transform: translateY(-18px);
    z-index: 2;
  }
  .slot.up.tilt {
    transform: translateY(-18px) rotate(-1.5deg);
  }
  .slot.dragging {
    transition: none;
    z-index: 3;
  }
  .slot.wobble {
    animation: wobble 0.3s;
  }
  @keyframes wobble {
    25% { transform: translate(-5px, -18px); }
    75% { transform: translate(5px, -18px); }
  }
  .hint {
    text-align: center;
    font-size: 14px;
    color: var(--ink-dim);
    margin: 4px 0 0;
  }
</style>
