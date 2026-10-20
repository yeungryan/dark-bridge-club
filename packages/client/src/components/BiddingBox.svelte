<script lang="ts">
  import { LEVELS, STRAINS, type Call, type Level, type Strain } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { callLabel, strainLabel } from '../lib/format';
  import { buzz } from '../lib/juice/haptics';
  import { sound } from '../lib/juice/sound';

  // Spec S12: levels and suits are both always showing; pick them in either order, then
  // confirm. Pass also needs a confirming tap.
  let { conn }: { conn: Connection } = $props();

  const legal = $derived(conn.view!.deal!.legalCalls);
  let level = $state<Level | null>(null);
  let strain = $state<Strain | null>(null);
  let passing = $state(false);

  const isLegalBid = (l: Level, s: Strain) => legal.some((c) => c.type === 'bid' && c.level === l && c.strain === s);
  const levelOpen = (l: Level) => STRAINS.some((s) => isLegalBid(l, s));
  const strainOpen = (s: Strain) => LEVELS.some((l) => isLegalBid(l, s));

  const selected = $derived<Call | null>(
    passing ? { type: 'pass' } : level !== null && strain !== null && isLegalBid(level, strain) ? { type: 'bid', level, strain } : null,
  );

  function click() {
    sound.tap();
    buzz('tap');
  }

  function pickLevel(l: Level) {
    click();
    passing = false;
    level = level === l ? null : l;
    // A suit that can't go with this level is dropped, so the box never shows an illegal pair.
    if (level !== null && strain !== null && !isLegalBid(level, strain)) strain = null;
  }

  function pickStrain(s: Strain) {
    click();
    passing = false;
    strain = strain === s ? null : s;
    if (level !== null && strain !== null && !isLegalBid(level, strain)) level = null;
  }

  function pickPass() {
    click();
    passing = !passing;
    level = null;
    strain = null;
  }

  function confirm() {
    if (!selected) return;
    conn.intent({ type: 'deal', action: { type: 'call', call: selected } });
    passing = false;
    level = null;
    strain = null;
  }

  const prompt = $derived.by(() => {
    if (selected) return selected.type === 'pass' ? 'Confirm Pass' : `Bid ${callLabel(selected)}`;
    if (level !== null) return `${level}… choose a suit`;
    if (strain !== null) return `…${strainLabel(strain)} choose a level`;
    return 'Choose a call';
  });
</script>

<div class="box panel">
  <div class="row levels">
    {#each LEVELS as l (l)}
      <button
        class:on={level === l}
        class:faint={strain !== null && !isLegalBid(l, strain)}
        disabled={!levelOpen(l)}
        onclick={() => pickLevel(l)}>{l}</button
      >
    {/each}
  </div>
  <div class="row strains">
    {#each STRAINS as s (s)}
      <button
        class:on={strain === s}
        class:red={s === 'H' || s === 'D'}
        class:faint={level !== null && !isLegalBid(level, s)}
        disabled={!strainOpen(s)}
        onclick={() => pickStrain(s)}>{strainLabel(s)}</button
      >
    {/each}
  </div>
  <div class="row actions">
    <button class:on={passing} onclick={pickPass}>Pass</button>
    {#key prompt}
      <button class="primary confirm" class:ready={selected !== null} disabled={!selected} onclick={confirm}>{prompt}</button>
    {/key}
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
    transition:
      transform calc(90ms * var(--speed)),
      opacity calc(120ms * var(--speed));
  }
  /* Buttons press in under your thumb. */
  :global(.fx-full) .row button:active:not(:disabled) {
    transform: scale(0.92);
  }
  .row button.on {
    outline: 3px solid var(--accent);
  }
  :global(.fx-full) .row button.on {
    animation: pick calc(220ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  @keyframes pick {
    40% {
      transform: scale(1.12);
    }
  }
  .row button.faint {
    opacity: 0.4;
  }
  .confirm {
    font-weight: 700;
  }
  :global(.fx-full) .confirm.ready {
    animation: ready calc(260ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  @keyframes ready {
    0% {
      transform: scale(0.9);
    }
    50% {
      transform: scale(1.06);
    }
  }
  .red {
    color: #ff8a7a;
  }
</style>
