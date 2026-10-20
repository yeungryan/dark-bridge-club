<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { avatarAtSeat, emojiOf, teamColor } from '../lib/avatars';
  import { profileOf } from '../lib/format';
  import CallText from './CallText.svelte';
  import { director } from '../lib/juice/director.svelte';

  // Spec S12: each call in turn order, underlined in its team's colour. Bids stamp in harder as the
  // level rises; passes slide in quietly. After a bid, each pass counts down on it:
  // "Going once…", "Going twice…" (the third pass is the "Sold!" in the header).
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const profiles = $derived(conn.room!.profiles);
  const calls = $derived(view.deal!.calls);
  const lastBid = $derived(calls.map((c) => c.call.type).lastIndexOf('bid'));
  const going = $derived(view.deal!.phase === 'auction' ? director.going : 0);
</script>

<div class="strip" aria-label="Auction">
  {#each calls as entry, i (i)}
    {@const p = profileOf(profiles, view.seating?.[entry.seat])}
    {@const level = entry.call.type === 'bid' ? entry.call.level : 0}
    <span class="call" class:pass={level === 0} class:top={i === lastBid} style="--c: {teamColor(conn, entry.seat)}; --weight: {level}">
      <small>{emojiOf(avatarAtSeat(conn, entry.seat))} {p.name}</small>
      <strong><CallText call={entry.call} /></strong>
      {#if i === lastBid && going > 0}
        {#key going}
          <em class="going">{going === 1 ? 'Going once…' : 'Going twice…'}</em>
        {/key}
      {/if}
    </span>
  {:else}
    <span class="muted">No calls yet.</span>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
  .call {
    position: relative;
    animation: stamp-in calc(260ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1) backwards;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    border-bottom: 3px solid var(--c);
    padding: 2px 6px;
    background: var(--panel);
    border-radius: 6px 6px 0 0;
    min-width: 48px;
  }
  /* Higher bids drop in from higher up and hit harder. */
  @keyframes stamp-in {
    0% {
      transform: scale(calc(1.3 + var(--weight) * 0.12)) translateY(-8px) rotate(calc(var(--weight) * -1deg));
      opacity: 0;
    }
    70% {
      transform: scale(0.94);
      opacity: 1;
    }
  }
  .call.pass {
    animation-name: slide-in;
    opacity: 0.75;
  }
  @keyframes slide-in {
    0% {
      transform: translateX(-10px);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .call {
    animation-name: fade-in;
  }
  .call.top {
    box-shadow: 0 0 0 1px var(--c);
  }
  .going {
    position: absolute;
    top: -18px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 12px;
    font-style: normal;
    font-weight: 700;
    color: var(--accent);
    animation: going calc(320ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1) backwards;
  }
  @keyframes going {
    0% {
      transform: translateX(-50%) scale(1.6);
      opacity: 0;
    }
  }
  small {
    font-family: var(--font-name);
    font-size: 12px;
    color: var(--ink-dim);
  }
</style>
