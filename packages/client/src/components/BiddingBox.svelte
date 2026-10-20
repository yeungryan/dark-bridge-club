<script lang="ts">
  import { LEVELS, STRAINS, type Call, type Level, type Strain } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { nameAtSeat } from '../lib/format';
  import CallText from './CallText.svelte';
  import { buzz } from '../lib/juice/haptics';
  import { sound } from '../lib/juice/sound';

  // Spec S12: a bidding box you could almost pick up. Levels and suits are both always
  // showing as little cards; pick them in either order, then confirm. Pass is the green
  // card, as in a real bidding box, and also needs a confirming tap.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  const legal = $derived(deal.legalCalls);
  let level = $state<Level | null>(null);
  let strain = $state<Strain | null>(null);
  let passing = $state(false);

  const isLegalBid = (l: Level, s: Strain) => legal.some((c) => c.type === 'bid' && c.level === l && c.strain === s);
  const levelOpen = (l: Level) => STRAINS.some((s) => isLegalBid(l, s));
  const strainOpen = (s: Strain) => LEVELS.some((l) => isLegalBid(l, s));

  // What you're bidding over, in words.
  const topBid = $derived([...deal.calls].reverse().find((c) => c.call.type === 'bid') ?? null);
  const topBy = $derived(topBid ? (topBid.seat === view.mySeat ? 'you' : nameAtSeat(view, conn.room!.profiles, topBid.seat)) : '');

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

  // What the confirm button says (the key re-runs its little pop when it changes).
  const promptKey = $derived(selected ? JSON.stringify(selected) : `${level}:${strain}`);
</script>

<!-- Two rows (Ryan: compact enough to sit under the table): levels and Pass, then suits and
     the confirm button. The line on top says what you're bidding over, or what's still missing. -->
<div class="box">
  <p class="context">
    {#if level !== null && strain === null && !passing}{level}… now a suit
    {:else if strain !== null && level === null}…<CallText {strain} /> now a level
    {:else if topBid}To beat: <strong><CallText call={topBid.call} /></strong> by {topBy}
    {:else}No bids yet: you can open{/if}
  </p>
  <div class="row r1">
    <div class="levels">
      {#each LEVELS as l (l)}
        <button
          class="tile"
          class:on={level === l}
          class:faint={strain !== null && !isLegalBid(l, strain)}
          disabled={!levelOpen(l)}
          onclick={() => pickLevel(l)}>{l}</button
        >
      {/each}
    </div>
    <button class="tile pass" class:on={passing} onclick={pickPass}>Pass</button>
  </div>
  <div class="row r2">
    <div class="strains">
      {#each STRAINS as s (s)}
        <button
          class="tile strain"
          class:on={strain === s}
          class:nt={s === 'NT'}
          class:faint={level !== null && !isLegalBid(level, s)}
          disabled={!strainOpen(s)}
          onclick={() => pickStrain(s)}><CallText strain={s} red="var(--card-red)" /></button
        >
      {/each}
    </div>
    {#key promptKey}
      <button
        class="primary confirm"
        class:ready={selected !== null}
        disabled={!selected}
        aria-label={selected?.type === 'pass' ? 'Confirm Pass' : undefined}
        onclick={confirm}
      >
        {#if selected?.type === 'pass'}Pass ✓
        {:else if selected}Bid <CallText call={selected} red="currentColor" />
        {:else}Bid{/if}
      </button>
    {/key}
  </div>
</div>

<style>
  .box {
    display: grid;
    gap: 6px;
    padding: 5px 8px 9px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .context {
    margin: 0;
    text-align: center;
    font-size: 12.5px;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--ink-dim);
  }
  .row,
  .levels,
  .strains {
    display: grid;
    gap: 5px;
  }
  .r1 {
    grid-template-columns: minmax(0, 1fr) 64px;
  }
  .r2 {
    grid-template-columns: minmax(0, 1fr) 104px;
  }
  .levels {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  .strains {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  /* Little bidding cards: card-coloured, with a bit of thickness, and they press in. */
  .tile {
    padding: 0;
    min-height: 38px;
    border: 0;
    border-radius: 8px;
    background: var(--card);
    color: var(--card-ink);
    font-size: 1.2rem;
    font-weight: 750;
    box-shadow: 0 3px 0 rgba(0, 0, 0, 0.35);
    transition:
      transform calc(90ms * var(--speed)),
      box-shadow calc(90ms * var(--speed)),
      opacity calc(120ms * var(--speed));
  }
  /* Suits are drawn at the digits' height, so both rows read the same size. */
  .tile {
    font-family: var(--font-card);
  }
  .tile.nt {
    letter-spacing: 0.02em;
  }
  .tile:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0.35);
  }
  /* Chosen: lifted out of the box and ringed. */
  .tile.on {
    transform: translateY(-4px);
    box-shadow:
      0 0 0 3px var(--accent),
      0 6px 14px var(--accent-glow);
  }
  :global(.fx-full) .tile.on {
    animation: pick calc(220ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
    animation-duration: calc(var(--spring-pop-ms, 320ms) * var(--speed));
    animation-timing-function: var(--spring-pop, cubic-bezier(0.3, 1.6, 0.6, 1));
  }
  @keyframes pick {
    from {
      transform: translateY(2px) scale(0.9);
    }
  }
  .tile.faint {
    opacity: 0.4;
  }
  .tile:disabled {
    opacity: 0.16;
    box-shadow: none;
  }
  /* The green Pass card. */
  .tile.pass {
    background: #2f7d4f;
    color: #ffffff;
    font-size: 0.9rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .confirm {
    min-height: 38px;
    padding: 0 6px;
    font-weight: 750;
    font-size: 1rem;
    white-space: nowrap;
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
</style>
