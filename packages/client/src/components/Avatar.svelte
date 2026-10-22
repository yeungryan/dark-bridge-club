<script lang="ts">
  import { ELEMENT_INFO, type Avatar } from '@dark/engine';
  import type { Team } from '../lib/avatars';
  import AnimalIcon from './AnimalIcon.svelte';

  // A player's avatar (Ryan's option E): the animal on its own, no circle, with a thin aura in its
  // element's colour (red fire, yellow air, blue water, green earth) that shows on any background.
  // At the table it carries the cards-left count as a badge on its bottom-right, in the player's
  // team colour (Team Red, Team Black), and on their turn the animal and badge pulse together.
  let {
    avatar,
    initial = '?',
    size = 44,
    turn = false,
    away = false,
    count = null,
    team = null,
  }: {
    avatar: Avatar | null;
    initial?: string;
    size?: number;
    turn?: boolean;
    away?: boolean;
    /** Cards left, as a badge (at the table only). */
    count?: number | null;
    team?: Team | null;
  } = $props();
</script>

<span
  class="token {avatar ? `el-${avatar.element}` : ''}"
  class:turn
  class:away
  style="--size: {size}px"
  title={avatar ? ELEMENT_INFO[avatar.element].name : undefined}
>
  <span class="face">
    {#if avatar}<span class="animal"><AnimalIcon animal={avatar.animal} /></span>{:else}<span class="initial">{initial}</span>{/if}
  </span>
  {#if count !== null}
    <span class="count {team ?? ''}" aria-label="{count} {count === 1 ? 'card' : 'cards'} left">{count}</span>
  {/if}
</span>

<style>
  .token {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: var(--size);
    height: var(--size);
    flex: none;
    --el: rgba(255, 255, 255, 0.5);
  }
  /* Each element's primary colour, for the aura. */
  .el-fire {
    --el: #ff4a3a;
  }
  .el-air {
    --el: #ffd23a;
  }
  .el-water {
    --el: #3aa0ff;
  }
  .el-earth {
    --el: #3fd060;
  }
  .face {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }
  /* The aura: a thin outline in the element's colour, then a soft glow of it. */
  .animal {
    display: grid;
    font-size: calc(var(--size) * 0.84);
    line-height: 1;
    filter: drop-shadow(1.6px 0 0 var(--el)) drop-shadow(-1.6px 0 0 var(--el)) drop-shadow(0 1.6px 0 var(--el)) drop-shadow(0 -1.6px 0 var(--el))
      drop-shadow(0 0 6px var(--el));
  }
  /* No avatar yet: the initial in a faint circle. */
  .initial {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--panel);
    box-shadow: 0 0 0 1.5px var(--line);
    font-family: var(--font-name);
    font-weight: 700;
    font-size: calc(var(--size) * 0.42);
    color: var(--ink);
  }

  /* Cards left (Ryan's pick, O3 at O1's size): a solid team-coloured circle with a thin white rim,
     on the animal's bottom-right. A plain bold font, so the number sits dead centre. */
  .count {
    position: absolute;
    right: -4px;
    bottom: -3px;
    display: grid;
    place-items: center;
    width: 19px;
    height: 19px;
    border-radius: 50%;
    background: var(--team-black);
    color: #fff;
    box-shadow:
      0 0 0 1.6px #fff,
      0 2px 4px rgba(0, 0, 0, 0.5);
    font: 800 11px/1 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-variant-numeric: tabular-nums lining-nums;
  }
  .count.red {
    background: var(--team-red);
  }

  /* Whose turn: the animal and its badge pulse together, and a faint ring ripples out. */
  :global(.fx-full) .turn {
    animation: pulse calc(1200ms * var(--speed)) ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      scale: 1.13;
    }
  }
  .turn::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.55);
    pointer-events: none;
  }
  :global(.fx-full) .turn::after {
    opacity: 0;
    animation: ripple calc(1200ms * var(--speed)) ease-out infinite;
  }
  @keyframes ripple {
    0% {
      opacity: 0.7;
      scale: 0.85;
    }
    100% {
      opacity: 0;
      scale: 1.45;
    }
  }
  .away .face {
    filter: grayscale(1) opacity(0.5);
  }
</style>
