<script lang="ts">
  import { declarerTarget, defenderTarget, LEVELS, STRAINS, type Call, type Level, type Strain } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { nameAtSeat } from '../lib/format';
  import CallText from './CallText.svelte';
  import { buzz } from '../lib/juice/haptics';
  import { sound } from '../lib/juice/sound';
  import { bidPreview } from '../lib/bidPreview.svelte';
  import { TIMING } from '../lib/juice/timing';
  import { onDestroy } from 'svelte';

  // Spec S12, the bid ladder (Ryan): every legal bid is its own little card, cheapest first,
  // two levels showing at a time; scroll for jumps and it snaps to a whole level. Tap a card to
  // pick it (the line on top says what it needs): it turns gold and reads "Bid 1♠" (round 19,
  // Ryan), so tapping it again makes the bid. Pass is one tap, and plain grey: the box doesn't
  // nudge you toward it.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  const legal = $derived(deal.legalCalls);
  let picked = $state<{ level: Level; strain: Strain } | null>(null);
  /** When the bid was picked: a second tap within the double-tap guard is a slip, not a bid. */
  let pickedAt = 0;

  const isLegal = (level: Level, strain: Strain) => legal.some((c) => c.type === 'bid' && c.level === level && c.strain === strain);
  // Only the levels that still have a legal bid; the lowest one is at the top.
  const levels = $derived(LEVELS.filter((l) => STRAINS.some((s) => isLegal(l, s))));

  // What you're bidding over, in words.
  const topBid = $derived([...deal.calls].reverse().find((c) => c.call.type === 'bid') ?? null);
  const topBy = $derived(topBid ? (topBid.seat === view.mySeat ? 'you' : nameAtSeat(view, conn.room!.profiles, topBid.seat)) : '');

  // Your hand raises the cards the picked bid is about; with nothing picked, the cards of the
  // bid to beat (Ryan). Cleared when the box closes.
  $effect(() => {
    bidPreview.strain = selected?.type === 'bid' ? selected.strain : topBid?.call.type === 'bid' ? topBid.call.strain : null;
  });
  onDestroy(() => (bidPreview.strain = null));

  // With nothing picked, the top line counts what you hold of the bid to beat.
  const myHand = $derived(deal.hand);
  const holding = $derived.by(() => {
    if (!topBid || topBid.call.type !== 'bid') return '';
    const strain = topBid.call.strain;
    if (strain === 'NT') {
      const aces = myHand.filter((c) => c.rank === 14).length;
      return aces === 0 ? 'you hold no aces' : `you hold ${aces} ${aces === 1 ? 'ace' : 'aces'}`;
    }
    const n = myHand.filter((c) => c.suit === strain).length;
    return n === 0 ? 'you hold no' : `you hold ${n}`;
  });

  const selected = $derived<Call | null>(picked && isLegal(picked.level, picked.strain) ? { type: 'bid', ...picked } : null);

  function pick(level: Level, strain: Strain) {
    if (selected?.type === 'bid' && selected.level === level && selected.strain === strain) {
      if (performance.now() - pickedAt < TIMING.doubleTapGuard) return;
      return send(selected);
    }
    sound.tap();
    buzz('tap');
    picked = { level, strain };
    pickedAt = performance.now();
  }

  // Tapping or clicking anywhere outside the bid box lets go of the picked bid (Ryan).
  $effect(() => {
    if (!picked) return;
    const away = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('.box')) picked = null;
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  });

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

  // Hover (Ryan, round 23): the chip under your mouse, or under your finger as you run it through
  // the box, lifts and lights up with a soft clack. Stopping on a chip and letting go picks it
  // (never bids); letting go on Pass does nothing.
  const hoverable = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  /** The chip (e.g. "3H") or "pass" under the pointer. */
  let hot = $state<string | null>(null);
  const SLOP = 8;
  let scrub: { id: number; x: number; y: number; on: boolean } | null = null;
  /** A scrub just ended: the click the browser may send after it isn't a tap. */
  let swallowClick = false;

  function hotAt(el: Element | null) {
    const t = el?.closest<HTMLElement>('[data-chip]');
    const key = t && !(t as HTMLButtonElement).disabled ? t.dataset.chip! : null;
    if (key === hot) return;
    hot = key;
    if (key) sound.chip(key === 'pass' ? 5 : STRAINS.indexOf(key.slice(1) as Strain));
  }
  function onMove(e: PointerEvent) {
    if (e.pointerType === 'mouse') {
      if (hoverable) hotAt(e.target as Element);
      return;
    }
    if (!scrub || e.pointerId !== scrub.id) return;
    const dx = e.clientX - scrub.x;
    const dy = e.clientY - scrub.y;
    // A mostly sideways move becomes a scrub; up or down scrolls the ladder as before.
    if (!scrub.on && (Math.abs(dx) > SLOP || Math.abs(dy) > SLOP)) {
      if (Math.abs(dx) > Math.abs(dy) * 1.2) scrub.on = true;
      else return (scrub = null);
    }
    if (scrub.on) hotAt(document.elementFromPoint(e.clientX, e.clientY));
  }
  function onDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    scrub = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
    // Touch sends the rest of the gesture to the chip it started on; let it go, so the moves
    // can be hit-tested anywhere in the box.
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }
  function onUp(e: PointerEvent) {
    if (e.pointerType === 'mouse' || !scrub || e.pointerId !== scrub.id) return;
    const was = scrub.on;
    scrub = null;
    if (!was) return (hot = null);
    const key = hot;
    hot = null;
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
    if (!key || key === 'pass') return;
    const level = Number(key[0]) as Level;
    const strain = key.slice(1) as Strain;
    if (!isLegal(level, strain)) return;
    if (picked?.level === level && picked.strain === strain) return;
    sound.tap();
    buzz('tap');
    picked = { level, strain };
    pickedAt = performance.now();
  }
  function onCancel() {
    scrub = null;
    hot = null;
  }
  function onClickCapture(e: MouseEvent) {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  }
  const moreAbove = $derived(topRow > 0);
</script>

<div class="box">
  <p class="context">
    {#if selected?.type === 'bid'}
      <strong><CallText call={selected} /></strong>: you need <strong>{declarerTarget(selected.level)} sets</strong>, they need
      <strong>{defenderTarget(selected.level)}</strong>
    {:else if topBid}To beat: <strong><CallText call={topBid.call} /></strong> by {topBy}{#if holding}
        &nbsp;· {holding}{#if topBid.call.type === 'bid' && topBid.call.strain !== 'NT'}&nbsp;<CallText strain={topBid.call.strain} />{/if}{/if}
    {:else}No bids yet: you can open{/if}
  </p>
  <div
    class="body"
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onCancel}
    onpointerleave={(e) => e.pointerType === 'mouse' && (hot = null)}
    onclickcapture={onClickCapture}
  >
    {#if levels.length > 0}
      <div class="ladder" class:more-below={moreBelow} class:more-above={moreAbove} bind:this={ladder} onscroll={scrolled} aria-label="Bids">
        {#each levels as level (level)}
          <div class="level">
            {#each STRAINS as strain (strain)}
              {@const on = picked?.level === level && picked.strain === strain}
              <button
                class="tile chip"
                class:nt={strain === 'NT'}
                class:red={strain === 'H' || strain === 'D'}
                class:on
                class:hot={hot === `${level}${strain}`}
                data-chip="{level}{strain}"
                disabled={!isLegal(level, strain)}
                aria-label="{on ? 'Bid ' : ''}{level} {strain === 'NT' ? 'no trumps' : strain}"
                onclick={() => pick(level, strain)}
                >{#if on}<span class="bid-word">Bid</span>{/if}<CallText
                  call={{ type: 'bid', level, strain }}
                  red={on ? 'currentColor' : 'var(--chip-red-ink)'}
                /></button
              >
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <p class="none">No bid is left above <CallText call={topBid!.call} />: only Pass.</p>
    {/if}
    <button class="pass" class:hot={hot === 'pass'} data-chip="pass" onclick={() => send({ type: 'pass' })}>Pass</button>
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
    /* The ladder, then Pass: the picked bid is its own Bid button (round 19, Ryan). */
    grid-template-columns: minmax(0, 1fr) 62px;
    gap: 6px;
  }
  /* Two levels showing, plus a faded peek of the third (Ryan) so it reads as scrollable; scrolling
     snaps a whole level to the top. Each level is 34px of cards plus 5px of space. */
  .ladder {
    height: 96px;
    /* A little room at the sides so a lifted chip's glow isn't cut off. */
    padding: 0 3px;
    margin: 0 -3px;
    /* Up and down scroll the ladder; sideways runs your finger through the chips (round 23). */
    touch-action: pan-y;
    align-self: start;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-snap-type: y mandatory;
    scrollbar-width: none;
  }
  /* Room after the last level, so the last two can still snap to the top. */
  .ladder::after {
    content: '';
    display: block;
    height: 18px;
  }
  .ladder::-webkit-scrollbar {
    display: none;
  }
  /* The peeking third level fades out; a level scrolled off the top fades at that edge. */
  .ladder.more-below {
    mask-image: linear-gradient(180deg, #000 78px, rgba(0, 0, 0, 0.45) 84px, transparent);
  }
  .ladder.more-above {
    mask-image: linear-gradient(0deg, #000 calc(100% - 8px), transparent);
  }
  .ladder.more-above.more-below {
    mask-image: linear-gradient(180deg, transparent, #000 8px, #000 78px, rgba(0, 0, 0, 0.45) 84px, transparent);
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
    /* A bid chip (app.css), not a little playing card (Ryan, round 22). */
    font-size: 0.92rem;
    transition:
      transform calc(90ms * var(--speed)),
      box-shadow calc(90ms * var(--speed));
  }
  /* Hover (round 23): the chip under the mouse or finger lifts and lights up. */
  .tile.hot:not(.on) {
    transform: translateY(-2px);
    filter: brightness(1.25);
    box-shadow:
      inset 0 0 0 2px rgba(255, 255, 255, 0.55),
      0 0 10px rgba(255, 255, 255, 0.22),
      0 4px 0 rgba(0, 0, 0, 0.45);
  }
  .tile.on.hot {
    filter: brightness(1.12);
  }
  .tile:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.2);
  }
  /* Picked: it turns gold, reads "Bid 1♠" and lifts a little (it stays inside its level). Tap it
     again to bid. */
  .tile.on {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.22em;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 0.82rem;
    white-space: nowrap;
    transform: translateY(-2px);
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.35),
      0 4px 12px var(--accent-glow);
  }
  .tile.on::before {
    display: none;
  }
  .bid-word {
    font-family: var(--font);
    font-weight: 800;
  }
  :global(.fx-full) .tile.on {
    animation: pick calc(var(--spring-pop-ms, 220ms) * var(--speed)) var(--spring-pop, cubic-bezier(0.3, 1.6, 0.6, 1));
  }
  @keyframes pick {
    from {
      transform: translateY(2px) scale(0.9);
    }
  }
  /* Below the bid to beat: a faint empty ring. */
  .tile:disabled {
    background: transparent;
    color: var(--ink-dim);
    opacity: 0.35;
    box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.16);
  }
  .tile:disabled::before {
    display: none;
  }
  .none {
    margin: 0;
    align-self: center;
    text-align: center;
    font-size: 13px;
    color: var(--ink-dim);
  }
  /* Pass: a plain grey button, one tap. */
  .pass {
    height: 72px;
    margin-top: 3px;
    padding: 0 4px;
    min-height: 0;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.1);
    color: var(--ink);
    font-weight: 700;
    font-size: 0.95rem;
    touch-action: pan-y;
    transition:
      transform calc(90ms * var(--speed)),
      background calc(90ms * var(--speed)),
      box-shadow calc(90ms * var(--speed));
  }
  .pass.hot {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.18);
    box-shadow:
      inset 0 0 0 1.5px rgba(255, 255, 255, 0.5),
      0 0 10px rgba(255, 255, 255, 0.18);
  }
</style>
