<script lang="ts">
  import type { Suit as SuitT } from '@dark/engine';
  import type { Snippet } from 'svelte';
  import type { Team } from '../lib/avatars';
  import Suit from './Suit.svelte';

  // One letter of the DARK crest (Ryan's pick, L1 revised): Team Red's A and R, Team Black's D
  // and K, each with its suit faint in the top-left corner (♠ D, ♥ A, ♦ R, ♣ K). Not here: a dim
  // outline. Here: lit in the team colour. Picked: filled. The login title is the crest, all filled.
  let {
    letter,
    suit,
    team,
    state = 'ready',
    size = 56,
    children,
  }: { letter: string; suit: SuitT; team: Team; state?: 'off' | 'lit' | 'ready'; size?: number; children?: Snippet } = $props();
</script>

<span class="tile {team} {state}" style="--w: {size}px" aria-hidden="true">
  <span class="suit"><Suit {suit} label={false} /></span>
  {letter}
  {@render children?.()}
</span>

<style>
  .tile {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--w);
    height: calc(var(--w) * 1.15);
    border-radius: calc(var(--w) * 0.18);
    border: 2px solid var(--line);
    background: var(--panel);
    color: var(--line);
    font-family: var(--font-display);
    font-size: calc(var(--w) * 0.57);
    font-weight: 800;
    line-height: 1;
    transition:
      color 0.3s,
      border-color 0.3s,
      background-color 0.3s;
  }
  /* The suit, small and faint in the corner, clear of the letter. */
  .suit {
    position: absolute;
    top: calc(var(--w) * 0.07);
    left: calc(var(--w) * 0.1);
    display: grid;
    width: calc(var(--w) * 0.22);
    height: calc(var(--w) * 0.22);
    color: var(--ink);
    opacity: 0.18;
  }
  .suit :global(svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
  .lit .suit,
  .ready .suit {
    opacity: 0.45;
  }
  /* Here: the letter and edge in the team colour (Team Black's letter gets a light rim). */
  .lit.red {
    color: #ff5a5a;
    border-color: #ff5a5a;
  }
  .lit.red .suit {
    color: #ff5a5a;
  }
  .lit.black {
    color: var(--team-black);
    border-color: #e9e5da;
    text-shadow:
      0 0 1px #fff,
      0 0 1px #fff,
      0 0 2px #fff;
  }
  /* Picked: filled. */
  .ready.red {
    background: var(--team-red);
    border-color: var(--team-red);
    color: #fff;
  }
  .ready.black {
    background: var(--team-black);
    border-color: #fff;
    color: #fff;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4);
  }
  .ready .suit {
    color: #fff;
  }
</style>
