<script lang="ts">
  import { animalById, ELEMENT_INFO, type Avatar } from '@dark/engine';

  // A player's avatar as a token: the animal in a circle ringed in `ring` (team colour during
  // play, personal colour in the lobby). The element lives inside the circle as a quiet
  // backdrop behind the animal (embers below, ripples, a swirl, rock strata), not as a badge.
  let {
    avatar,
    initial = '?',
    ring = 'var(--line)',
    size = 44,
    turn = false,
    away = false,
  }: {
    avatar: Avatar | null;
    initial?: string;
    ring?: string;
    size?: number;
    turn?: boolean;
    away?: boolean;
  } = $props();
</script>

<span
  class="token {avatar ? `el-${avatar.element}` : ''}"
  class:turn
  class:away
  style="--size: {size}px; --ring: {ring}"
  title={avatar ? ELEMENT_INFO[avatar.element].name : undefined}
>
  <span class="face">
    {#if avatar}<span class="animal">{animalById(avatar.animal)?.emoji}</span>{:else}<span class="initial">{initial}</span>{/if}
  </span>
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
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--panel);
    box-shadow: 0 0 0 2.5px var(--ring);
    transition: box-shadow calc(200ms * var(--speed));
  }
  .animal {
    position: relative;
    font-size: calc(var(--size) * 0.56);
    line-height: 1;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
  }
  .initial {
    font-family: var(--font-name);
    font-weight: 700;
    font-size: calc(var(--size) * 0.42);
    color: var(--ink);
  }

  /* The element, behind the animal, in its primary colour (red fire, yellow air, blue water,
     green earth): low-contrast textures, no outlines, nothing busy. */
  .el-fire .face {
    background:
      radial-gradient(ellipse 75% 50% at 50% 108%, rgba(255, 120, 60, 0.85), transparent 70%),
      radial-gradient(ellipse 30% 28% at 28% 96%, rgba(255, 200, 80, 0.55), transparent 70%),
      radial-gradient(ellipse 30% 28% at 74% 98%, rgba(255, 70, 50, 0.65), transparent 70%),
      radial-gradient(circle at 50% 35%, #7a1414 0%, #4a0b0b 100%);
  }
  .el-air .face {
    background:
      conic-gradient(from 30deg at 50% 50%, rgba(255, 250, 220, 0.04), rgba(255, 250, 220, 0.38), rgba(255, 250, 220, 0.04) 30%, rgba(255, 250, 220, 0.32) 55%, rgba(255, 250, 220, 0.04) 80%),
      radial-gradient(circle at 50% 40%, #9a7a10 0%, #5e4a06 100%);
  }
  .el-water .face {
    background:
      repeating-radial-gradient(circle at 50% 115%, rgba(150, 215, 255, 0.3) 0 1.5px, transparent 1.5px 6px),
      radial-gradient(circle at 50% 35%, #1a5fa8 0%, #0d3566 100%);
  }
  .el-earth .face {
    background:
      linear-gradient(180deg, transparent 58%, rgba(140, 200, 110, 0.45) 58% 67%, rgba(60, 120, 50, 0.7) 67% 81%, rgba(35, 80, 30, 0.85) 81%),
      radial-gradient(circle at 50% 35%, #2f7a35 0%, #1b4a20 100%);
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
</style>
