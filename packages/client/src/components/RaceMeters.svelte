<script lang="ts">
  import type { DealView } from '@dark/engine';

  // Spec S13 / principle 7: the race between two trick targets, always visible.
  let { deal, declarers, defenders }: { deal: DealView; declarers: string; defenders: string } = $props();

  const rows = $derived([
    { label: declarers, won: deal.tricksWon.declarers, need: deal.declarerTarget!, verb: 'to make' },
    { label: defenders, won: deal.tricksWon.defenders, need: deal.defenderTarget!, verb: 'to set' },
  ]);
</script>

<div class="meters">
  {#each rows as row (row.verb)}
    <div class="row" class:close={row.won === row.need - 1} class:done={row.won >= row.need}>
      <span class="who">{row.label}</span>
      <span class="pips" aria-hidden="true">
        {#each Array.from({ length: row.need }, (_, i) => i) as i (i)}<i class:on={i < row.won}></i>{/each}
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
  }
  .row.close .pips i:not(.on) {
    border-color: var(--accent);
  }
  .row.done .count {
    color: var(--good);
    font-weight: 700;
  }
</style>
