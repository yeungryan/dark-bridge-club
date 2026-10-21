<script lang="ts">
  import { declarerTarget, defenderTarget, LEVELS, STRAINS, type Call, type Level, type Strain } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { nameAtSeat } from '../lib/format';
  import CallText from './CallText.svelte';
  import { buzz } from '../lib/juice/haptics';
  import { sound } from '../lib/juice/sound';

  // Spec S12, the bid ladder (Ryan): every legal bid is its own little card, cheapest first,
  // two levels showing at a time; scroll for jumps and it snaps to a whole level. Tap a card to
  // pick it (the line on top says what it needs), then Bid. Pass is one tap, and plain grey:
  // the box doesn't nudge you toward it.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  const legal = $derived(deal.legalCalls);
  let picked = $state<{ level: Level; strain: Strain } | null>(null);

  const isLegal = (level: Level, strain: Strain) => legal.some((c) => c.type === 'bid' && c.level === level && c.strain === strain);
  // Only the levels that still have a legal bid; the lowest one is at the top.
  const levels = $derived(LEVELS.filter((l) => STRAINS.some((s) => isLegal(l, s))));

  // What you're bidding over, in words.
  const topBid = $derived([...deal.calls].reverse().find((c) => c.call.type === 'bid') ?? null);
  const topBy = $derived(topBid ? (topBid.seat === view.mySeat ? 'you' : nameAtSeat(view, conn.room!.profiles, topBid.seat)) : '');

  const selected = $derived<Call | null>(picked && isLegal(picked.level, picked.strain) ? { type: 'bid', ...picked } : null);

  function pick(level: Level, strain: Strain) {
    sound.tap();
    buzz('tap');
    picked = picked?.level === level && picked.strain === strain ? null : { level, strain };
  }

  function send(call: Call) {
    conn.intent({ type: 'deal', action: { type: 'call', call } });
    picked = null;
  }

  // Scrolling snaps to whole levels (CSS); a soft tick as each new level settles at the top.
  const ROW = 39;
  let ladder = $state<HTMLElement>();
  let topRow = $state(0);
  function scrolled() {
    if (!ladder) return;
    const row = Math.round(ladder.scrollTop / ROW);
    if (row !== topRow) {
      topRow = row;
      sound.tick();
    }
  }
  const moreBelow = $derived(topRow + 2 < levels.length);
  const moreAbove = $derived(topRow > 0);
</script>

<div class="box">
  <p class="context">
    {#if selected?.type === 'bid'}
      <strong><CallText call={selected} /></strong>: you need <strong>{declarerTarget(selected.level)} sets</strong>, they need
      <strong>{defenderTarget(selected.level)}</strong>
    {:else if topBid}To beat: <strong><CallText call={topBid.call} /></strong> by {topBy}
    {:else}No bids yet: you can open{/if}
  </p>
  <div class="body">
    {#if levels.length > 0}
      <div class="ladder" class:more-below={moreBelow} class:more-above={moreAbove} bind:this={ladder} onscroll={scrolled} aria-label="Bids">
        {#each levels as level (level)}
          <div class="level">
            {#each STRAINS as strain (strain)}
              <button
                class="tile"
                class:nt={strain === 'NT'}
                class:on={picked?.level === level && picked.strain === strain}
                disabled={!isLegal(level, strain)}
                aria-label="{level} {strain === 'NT' ? 'no trumps' : strain}"
                onclick={() => pick(level, strain)}><CallText call={{ type: 'bid', level, strain }} red="var(--card-red)" /></button
              >
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <p class="none">No bid is left above <CallText call={topBid!.call} />: only Pass.</p>
    {/if}
    <div class="actions">
      {#key selected ? JSON.stringify(selected) : ''}
        <button class="primary confirm" class:ready={selected !== null} disabled={!selected} onclick={() => selected && send(selected)}>
          <span>Bid</span>
          {#if selected}<span class="what"><CallText call={selected} red="currentColor" /></span>{/if}
        </button>
      {/key}
      <button class="pass" onclick={() => send({ type: 'pass' })}>Pass</button>
    </div>
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
    color: var(--ink-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .context strong {
    color: var(--ink);
  }
  .body {
    display: grid;
    /* The ladder, then Bid, then Pass: two tall buttons to the right of NT (Ryan). */
    grid-template-columns: minmax(0, 1fr) 62px 54px;
    gap: 6px;
  }
  /* Two levels showing; scrolling snaps a whole level to the top. Each level is 34px of cards
     plus 5px of space, and the box is exactly two levels tall, so every snap lines up. */
  .ladder {
    height: 78px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-snap-type: y mandatory;
    scrollbar-width: none;
  }
  .ladder::-webkit-scrollbar {
    display: none;
  }
  /* A soft fade at an edge that has more levels beyond it. */
  .ladder.more-below {
    mask-image: linear-gradient(180deg, #000 calc(100% - 8px), transparent);
  }
  .ladder.more-above {
    mask-image: linear-gradient(0deg, #000 calc(100% - 8px), transparent);
  }
  .ladder.more-above.more-below {
    mask-image: linear-gradient(180deg, transparent, #000 8px, #000 calc(100% - 8px), transparent);
  }
  .level {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 5px;
    height: 39px;
    padding: 3px 0 2px;
    scroll-snap-align: start;
  }
  /* Little bidding cards: card-coloured, with a bit of thickness, and they press in. */
  .tile {
    padding: 0;
    min-height: 0;
    height: 32px;
    border: 0;
    border-radius: 7px;
    background: var(--card);
    color: var(--card-ink);
    font-family: var(--font-card);
    font-size: 0.95rem;
    font-weight: 750;
    box-shadow: 0 3px 0 rgba(0, 0, 0, 0.35);
    transition:
      transform calc(90ms * var(--speed)),
      box-shadow calc(90ms * var(--speed));
  }
  .tile:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0.35);
  }
  /* Picked: ringed and lifted a little (it stays inside its level). */
  .tile.on {
    transform: translateY(-2px);
    box-shadow:
      0 0 0 3px var(--accent),
      0 4px 10px var(--accent-glow);
  }
  :global(.fx-full) .tile.on {
    animation: pick calc(var(--spring-pop-ms, 220ms) * var(--speed)) var(--spring-pop, cubic-bezier(0.3, 1.6, 0.6, 1));
  }
  @keyframes pick {
    from {
      transform: translateY(2px) scale(0.9);
    }
  }
  .tile:disabled {
    opacity: 0.16;
    box-shadow: none;
  }
  .none {
    margin: 0;
    align-self: center;
    text-align: center;
    font-size: 13px;
    color: var(--ink-dim);
  }
  .actions {
    display: contents;
  }
  .confirm,
  .pass {
    height: 72px;
    margin-top: 3px;
    min-height: 0;
    padding: 0 4px;
  }
  .confirm {
    display: grid;
    place-content: center;
    gap: 2px;
    font-weight: 750;
    font-size: 0.95rem;
    line-height: 1.1;
  }
  .confirm .what {
    font-family: var(--font-card);
    font-size: 1.1rem;
  }
  :global(.fx-full) .confirm.ready {
    animation: ready calc(var(--spring-pop-ms, 260ms) * var(--speed)) var(--spring-pop, cubic-bezier(0.3, 1.6, 0.6, 1));
  }
  @keyframes ready {
    from {
      transform: scale(0.9);
    }
  }
  /* Pass: a plain grey button, one tap. */
  .pass {
    min-height: 0;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.1);
    color: var(--ink);
    font-weight: 700;
    font-size: 0.95rem;
  }
</style>
