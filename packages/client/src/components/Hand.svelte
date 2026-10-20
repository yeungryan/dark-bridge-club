<script lang="ts">
  import type { Card as CardT } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { sameCard } from '../lib/format';
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

  function tap(card: CardT) {
    if (raised && sameCard(raised, card)) {
      if (!myTurnToPlay) return;
      if (!isLegal(card)) {
        wobble = card;
        setTimeout(() => (wobble = null), 300);
        return;
      }
      conn.intent({ type: 'deal', action: { type: 'play', card } });
      raised = null;
      return;
    }
    raised = card;
  }
</script>

<div class="hand" bind:clientWidth={width} style="height: {cardWidth * 1.4 + 22}px">
  {#each deal.hand as card, i (card.suit + card.rank)}
    {@const up = raised !== null && sameCard(raised, card)}
    <button
      class="slot"
      class:up
      class:wobble={wobble !== null && sameCard(wobble, card)}
      style="left: {i * step}px"
      onclick={() => tap(card)}
      aria-label={up ? 'Tap again to play' : 'Select card'}
    >
      <Card {card} width={cardWidth} dim={myTurnToPlay && !isLegal(card)} highlight={up} />
    </button>
  {/each}
</div>
{#if raised && myTurnToPlay}
  <p class="hint">Tap the raised card again to play it.</p>
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
    transition: transform 0.12s ease-out;
  }
  .slot.up {
    transform: translateY(-18px);
    z-index: 2;
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
