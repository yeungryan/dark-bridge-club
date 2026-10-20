<script lang="ts">
  import type { Card } from '@dark/engine';
  import { cardText, isRed } from '../lib/format';

  let {
    card,
    width = 56,
    dim = false,
    highlight = false,
  }: { card: Card; width?: number; dim?: boolean; highlight?: boolean } = $props();

  const text = $derived(cardText(card));
</script>

<div class="card" class:red={isRed(card)} class:dim class:highlight style="--w: {width}px" aria-label="{text.rank} of {text.suit}">
  <span class="corner">{text.rank}<br />{text.suit}</span>
  <span class="pip">{text.suit}</span>
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
  .corner {
    position: absolute;
    top: 3px;
    left: 4px;
    font-weight: 700;
    font-size: max(14px, calc(var(--w) * 0.28));
    line-height: 1;
    text-align: center;
  }
  .pip {
    position: absolute;
    right: 6%;
    bottom: 4%;
    font-size: calc(var(--w) * 0.5);
    line-height: 1;
  }
</style>
