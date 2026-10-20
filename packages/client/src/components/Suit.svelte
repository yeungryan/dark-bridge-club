<script lang="ts">
  import type { Suit } from '@dark/engine';

  // One drawing of each suit, used everywhere (cards, bidding box, auction, header, reveal),
  // so suits are the same height as the digits next to them. Font suit characters vary a lot
  // in size between phones; these don't. Colour comes from the surrounding text.
  let { suit, label = true }: { suit: Suit; label?: boolean } = $props();
  const NAMES: Record<Suit, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
</script>

<svg class="suit" viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label ? NAMES[suit] : undefined} aria-hidden={label ? undefined : 'true'}>
  {#if suit === 'S'}
    <path d="M12 1.5C9.5 4.6 2.5 9.3 2.5 14.1c0 2.9 2.3 5 5 5 1.7 0 3.1-.8 3.8-2L10 22.5h4l-1.3-5.4c.7 1.2 2.1 2 3.8 2 2.7 0 5-2.1 5-5C21.5 9.3 14.5 4.6 12 1.5z" />
  {:else if suit === 'H'}
    <path d="M12 21.8l-1.5-1.4C5.2 15.6 2 12.6 2 8.7 2 5.6 4.4 3.2 7.5 3.2c1.8 0 3.4.8 4.5 2.1 1.1-1.3 2.7-2.1 4.5-2.1 3.1 0 5.5 2.4 5.5 5.5 0 3.9-3.2 6.9-8.5 11.7z" />
  {:else if suit === 'D'}
    <path d="M12 1.5l8.2 10.5L12 22.5 3.8 12z" />
  {:else}
    <circle cx="12" cy="6.6" r="4.6" />
    <circle cx="6.4" cy="13.4" r="4.6" />
    <circle cx="17.6" cy="13.4" r="4.6" />
    <path d="M10.6 11h2.8v3h-2.8zM10 22.5h4l-1.2-8h-1.6z" />
  {/if}
</svg>

<style>
  /* Cap height of the digits beside it, sitting on the same baseline. */
  .suit {
    display: inline-block;
    height: 0.78em;
    width: 0.78em;
    vertical-align: -0.04em;
    fill: currentColor;
    flex: none;
  }
</style>
