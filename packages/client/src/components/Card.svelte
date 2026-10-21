<script lang="ts">
  import type { Card } from '@dark/engine';
  import { cardText, isRed } from '../lib/format';
  import Suit from './Suit.svelte';

  let {
    card,
    width = 56,
    dim = false,
    highlight = false,
    trump = false,
  }: { card: Card; width?: number; dim?: boolean; highlight?: boolean; trump?: boolean } = $props();

  const text = $derived(cardText(card));
</script>

<div class="card" class:red={isRed(card)} class:dim class:highlight class:trump style="--w: {width}px" aria-label="{text.rank} of {text.suit}">
  <!-- The corner: rank over a suit drawn at the rank's height. -->
  <span class="corner"><span class="rank">{text.rank}</span><Suit suit={card.suit} label={false} /></span>
  <span class="pip"><Suit suit={card.suit} label={false} /></span>
</div>

<style>
  .card {
    position: relative;
    width: var(--w);
    height: calc(var(--w) * 1.4);
    background: var(--card);
    color: var(--card-ink);
    border-radius: calc(var(--w) * 0.1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
    user-select: none;
    flex: none;
  }
  .card.red {
    color: var(--card-red);
  }
  .card.dim {
    filter: brightness(0.55);
  }
  .card.highlight {
    box-shadow: 0 0 0 3px var(--accent), 0 2px 6px rgba(0, 0, 0, 0.5);
  }
  /* A trump (Ryan; option D): a purple bar along the top and a faint purple tint. */
  .card.trump {
    background: linear-gradient(180deg, color-mix(in srgb, var(--trump) 16%, var(--card)), var(--card) 60%);
  }
  /* Inset from the edges, so in an overlapping hand each trump shows its own bar, broken at
     every card edge, instead of one band running across the cards (Ryan). */
  .card.trump::before {
    content: '';
    position: absolute;
    top: max(2px, calc(var(--w) * 0.045));
    left: max(4px, calc(var(--w) * 0.08));
    right: max(4px, calc(var(--w) * 0.08));
    height: max(3px, calc(var(--w) * 0.055));
    border-radius: 99px;
    background: var(--trump);
  }
  .corner {
    position: absolute;
    top: 3px;
    left: 4px;
    display: grid;
    justify-items: center;
    gap: 1px;
    font-family: var(--font-card);
    font-weight: 700;
    font-size: max(14px, calc(var(--w) * 0.28));
    line-height: 1;
  }
  .rank {
    letter-spacing: -0.04em;
  }
  .pip {
    position: absolute;
    right: 7%;
    bottom: 6%;
    font-size: calc(var(--w) * 0.5);
    line-height: 0;
  }
</style>
