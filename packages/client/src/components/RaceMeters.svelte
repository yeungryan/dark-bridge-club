<script lang="ts">
  import type { DealView } from '@dark/engine';
  import { director } from '../lib/juice/director.svelte';

  // Spec S13 / principle 7: the race between two trick targets, always visible.
  // A new pip pops in; a side one trick away shimmers; at the clinch the winner glows and the loser dims.
  let { deal, declarers, defenders }: { deal: DealView; declarers: string; defenders: string } = $props();

  const rows = $derived([
    { side: 'declarers' as const, label: declarers, won: deal.tricksWon.declarers, need: deal.declarerTarget! },
    { side: 'defenders' as const, label: defenders, won: deal.tricksWon.defenders, need: deal.defenderTarget! },
  ]);
  const settledBy = $derived(deal.clinch?.side ?? null);
  // The clinch glow waits for the hit-pause, so it lands with the shake and the chord.
  const glowing = $derived(settledBy !== null && !director.holding);
</script>

<div class="meters">
  {#each rows as row (row.side)}
    <div
      class="row"
      class:close={!settledBy && row.won === row.need - 1}
      class:done={row.won >= row.need}
      class:glow={glowing && settledBy === row.side}
      class:lost={glowing && settledBy !== row.side}
    >
      <span class="who">{row.label}</span>
      <span class="pips" aria-hidden="true">
        {#each Array.from({ length: row.need }, (_, i) => i) as i (i)}
          {#key i < row.won}<i class:on={i < row.won}></i>{/key}
        {/each}
      </span>
      <span class="count">{Math.min(row.won, row.need)}/{row.need}</span>
    </div>
  {/each}
</div>

<style>
  .meters {
    display: grid;
    gap: 3px;
    font-size: 14px;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 7.5em) 1fr auto;
    gap: 6px;
    align-items: center;
    transition: opacity calc(300ms * var(--speed));
  }
  .who {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pips {
    display: flex;
    gap: 2px;
  }
  .pips i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.5px solid var(--ink-dim);
  }
  .pips i.on {
    background: var(--accent);
    border-color: var(--accent);
    animation: pip calc(320ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  @keyframes pip {
    0% {
      transform: scale(0.3);
    }
    60% {
      transform: scale(1.5);
    }
  }
  /* One trick away: the remaining pip shimmers gently. */
  .row.close .pips i:not(.on) {
    border-color: var(--accent);
    animation: shimmer calc(1400ms * var(--speed)) ease-in-out infinite;
  }
  @keyframes shimmer {
    50% {
      box-shadow: 0 0 8px var(--accent);
    }
  }
  .row.done .count {
    color: var(--good);
    font-weight: 700;
  }
  .row.glow .pips i.on {
    box-shadow: 0 0 10px var(--accent);
  }
  .row.glow .who {
    color: var(--accent);
    font-weight: 700;
  }
  .row.lost {
    opacity: 0.45;
  }
</style>
