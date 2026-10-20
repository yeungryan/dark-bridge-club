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

  /* The element, behind the animal: low-contrast, no outlines, nothing busy. */
  .el-fire .face {
    background:
      radial-gradient(ellipse 70% 45% at 50% 105%, rgba(255, 122, 47, 0.75), transparent 70%),
      radial-gradient(ellipse 35% 30% at 30% 95%, rgba(255, 196, 77, 0.55), transparent 70%),
      radial-gradient(ellipse 30% 28% at 72% 98%, rgba(232, 64, 42, 0.6), transparent 70%),
      #2a1410;
  }
  .el-water .face {
    background:
      repeating-radial-gradient(circle at 50% 115%, rgba(120, 215, 255, 0.28) 0 1.5px, transparent 1.5px 6px),
      linear-gradient(180deg, #0e2a3f 0%, #10476a 100%);
  }
  .el-air .face {
    background:
      conic-gradient(from 30deg at 50% 50%, rgba(255, 246, 207, 0.05), rgba(255, 246, 207, 0.32), rgba(255, 246, 207, 0.05) 30%, rgba(255, 246, 207, 0.28) 55%, rgba(255, 246, 207, 0.05) 80%),
      radial-gradient(circle at 50% 50%, #3a3f52 0%, #262a38 100%);
  }
  .el-earth .face {
    background:
      linear-gradient(180deg, transparent 58%, rgba(138, 154, 75, 0.55) 58% 68%, rgba(122, 90, 54, 0.75) 68% 82%, rgba(91, 64, 38, 0.85) 82%),
      #2b2418;
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
