<script lang="ts">
  import { animalById, ELEMENT_INFO, type Avatar } from '@dark/engine';

  // A player's avatar as a token: the animal in a circle ringed in `ring` (team colour during
  // play, personal colour in the lobby), the element as a small badge on its bottom-right
  // corner, and optionally cards left (a tiny card, bottom-left) and the dealer chip (top-right).
  let {
    avatar,
    initial = '?',
    ring = 'var(--line)',
    size = 44,
    count = null,
    dealer = false,
    turn = false,
    away = false,
  }: {
    avatar: Avatar | null;
    initial?: string;
    ring?: string;
    size?: number;
    count?: number | null;
    dealer?: boolean;
    turn?: boolean;
    away?: boolean;
  } = $props();
</script>

<span class="token" class:turn class:away style="--size: {size}px; --ring: {ring}">
  <span class="face">
    {#if avatar}{animalById(avatar.animal)?.emoji}{:else}<span class="initial">{initial}</span>{/if}
  </span>
  {#if avatar}<span class="element" title={ELEMENT_INFO[avatar.element].name}>{ELEMENT_INFO[avatar.element].glyph}</span>{/if}
  {#if count !== null}<span class="count" aria-label="{count} {count === 1 ? 'card' : 'cards'} left">{count}</span>{/if}
  {#if dealer}<span class="dealer" title="Dealer">D</span>{/if}
</span>

<style>
  .token {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: var(--size);
    height: var(--size);
    flex: none;
  }
  .face {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--panel);
    box-shadow: 0 0 0 2.5px var(--ring);
    font-size: calc(var(--size) * 0.56);
    line-height: 1;
    transition: box-shadow calc(200ms * var(--speed));
  }
  .initial {
    font-family: var(--font-name);
    font-weight: 700;
    font-size: calc(var(--size) * 0.42);
    color: var(--ink);
  }
  /* Whose turn: the ring glows. */
  .turn .face {
    box-shadow:
      0 0 0 2.5px var(--ring),
      0 0 0 5px var(--accent-glow),
      0 0 16px var(--accent-glow);
  }
  :global(.fx-full) .turn .face {
    animation: breathe calc(1600ms * var(--speed)) ease-in-out infinite;
  }
  @keyframes breathe {
    50% {
      box-shadow:
        0 0 0 2.5px var(--ring),
        0 0 0 3px var(--accent-glow),
        0 0 8px var(--accent-glow);
    }
  }
  .away .face {
    filter: grayscale(1) opacity(0.5);
    box-shadow: 0 0 0 2.5px var(--bad);
  }
  /* Element badge, bottom-right. */
  .element {
    position: absolute;
    right: -4px;
    bottom: -3px;
    display: grid;
    place-items: center;
    width: calc(var(--size) * 0.44);
    height: calc(var(--size) * 0.44);
    border-radius: 50%;
    background: var(--sheet);
    box-shadow: 0 0 0 1.5px var(--ring);
    font-size: calc(var(--size) * 0.26);
    line-height: 1;
  }
  /* Cards left, bottom-left: a tiny card with the number on it. */
  .count {
    position: absolute;
    left: -6px;
    bottom: -4px;
    display: grid;
    place-items: center;
    min-width: calc(var(--size) * 0.38);
    height: calc(var(--size) * 0.5);
    padding: 0 2px;
    border-radius: 3px;
    background: var(--card);
    color: var(--card-ink);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    font-family: var(--font-card);
    font-weight: 700;
    font-size: calc(var(--size) * 0.26);
    line-height: 1;
  }
  .dealer {
    position: absolute;
    top: -5px;
    right: -6px;
    display: grid;
    place-items: center;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--felt);
    font-size: 10px;
    font-weight: 800;
  }
</style>
