<script lang="ts">
  import { LEVELS, STRAINS, type Call, type Level, type Strain } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { callLabel, strainLabel } from '../lib/format';

  // Spec S12: two taps to bid (choose, then confirm). Pass also needs a confirming tap.
  let { conn }: { conn: Connection } = $props();

  const legal = $derived(conn.view!.deal!.legalCalls);
  let level = $state<Level | null>(null);
  let selected = $state<Call | null>(null);

  const isLegalBid = (l: Level, s: Strain) => legal.some((c) => c.type === 'bid' && c.level === l && c.strain === s);
  const levelOpen = (l: Level) => STRAINS.some((s) => isLegalBid(l, s));

  function confirm() {
    if (!selected) return;
    conn.intent({ type: 'deal', action: { type: 'call', call: selected } });
    selected = null;
    level = null;
  }
</script>

<div class="box panel">
  <div class="row levels">
    {#each LEVELS as l (l)}
      <button class:on={level === l} disabled={!levelOpen(l)} onclick={() => ((level = l), (selected = null))}>{l}</button>
    {/each}
  </div>
  {#if level !== null}
    <div class="row strains">
      {#each STRAINS as s (s)}
        <button
          class:on={selected?.type === 'bid' && selected.strain === s}
          class:red={s === 'H' || s === 'D'}
          disabled={!isLegalBid(level, s)}
          onclick={() => (selected = { type: 'bid', level: level!, strain: s })}>{strainLabel(s)}</button
        >
      {/each}
    </div>
  {/if}
  <div class="row actions">
    <button class:on={selected?.type === 'pass'} onclick={() => ((selected = { type: 'pass' }), (level = null))}>Pass</button>
    <button class="primary" disabled={!selected} onclick={confirm}>
      {selected ? (selected.type === 'pass' ? 'Confirm Pass' : `Bid ${callLabel(selected)}`) : 'Choose a call'}
    </button>
  </div>
</div>

<style>
  .box {
    display: grid;
    gap: 6px;
    padding: 8px;
  }
  .row {
    display: grid;
    gap: 6px;
  }
  .levels {
    grid-template-columns: repeat(7, 1fr);
  }
  .strains {
    grid-template-columns: repeat(5, 1fr);
  }
  .actions {
    grid-template-columns: 1fr 2fr;
  }
  .row button {
    padding: 0;
    min-height: 42px;
    font-size: 1.1rem;
  }
  .row button.on {
    outline: 3px solid var(--accent);
  }
  .red {
    color: #ff8a7a;
  }
</style>
