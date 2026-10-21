<script lang="ts">
  import type { Call, Seat } from '@dark/engine';
  import { spotOf } from '../lib/format';
  import { settings } from '../lib/juice/settings.svelte';
  import CallText from './CallText.svelte';

  // The bidding, laid on the table the way cards are played (Ryan): each player's calls sit on the
  // table's edge right in front of them, so whose call it was is plain without a name. Each new
  // call overlaps the one before (like bidding cards put down in a row), the latest on top; the
  // highest bid so far is ringed. Shows each player's last few calls (a long auction rarely has more).
  let {
    calls,
    me,
    color,
    fly = false,
  }: {
    calls: readonly { readonly seat: Seat; readonly call: Call }[];
    me: Seat;
    color: (seat: Seat) => string;
    /** Each new call flies in from its player's seat badge (at the table, not in the replay). */
    fly?: boolean;
  } = $props();

  const KEEP = 4;
  const SEATS: Seat[] = [0, 1, 2, 3];
  const lastBid = $derived(calls.map((c) => c.call.type).lastIndexOf('bid'));
  const bySeat = $derived(
    SEATS.map((seat) => ({
      seat,
      calls: calls
        .map((c, i) => ({ ...c, i }))
        .filter((c) => c.seat === seat)
        .slice(-KEEP),
    })),
  );

  /** In from the player's badge, like a card being played. */
  function arrive(node: HTMLElement, seat: Seat) {
    if (!fly || !settings.motion) return;
    const badge = document.querySelector(`[data-badge-seat="${seat}"]`)?.getBoundingClientRect();
    if (!badge) return;
    const r = node.getBoundingClientRect();
    const dx = badge.left + badge.width / 2 - (r.left + r.width / 2);
    const dy = badge.top + badge.height / 2 - (r.top + r.height / 2);
    node.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.3 },
        { transform: 'scale(1.15, 0.88)', opacity: 1, offset: 0.65 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: settings.ms(320), easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'backwards' },
    );
  }
</script>

<div class="calls" aria-label="The bidding">
  {#each bySeat as { seat, calls: mine } (seat)}
    <ol class="spot at-{spotOf(seat, me)}" data-calls-seat={seat} style="--c: {color(seat)}">
      {#each mine as c (c.i)}
        <li class="tile" class:pass={c.call.type === 'pass'} class:top={c.i === lastBid} use:arrive={seat}>
          <CallText call={c.call} red="var(--card-red)" />
        </li>
      {/each}
    </ol>
  {/each}
</div>

<style>
  .calls {
    position: absolute;
    inset: 4px;
  }
  .spot {
    position: absolute;
    display: flex;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .at-top {
    top: 0;
    left: 50%;
    translate: -50% 0;
  }
  .at-bottom {
    bottom: 0;
    left: 50%;
    translate: -50% 0;
  }
  .at-left,
  .at-right {
    top: 50%;
    flex-direction: column;
    translate: 0 -50%;
  }
  .at-left {
    left: 0;
  }
  .at-right {
    right: 0;
  }
  /* A bidding card: card-white, its player's team colour along the bottom. */
  .tile {
    position: relative;
    display: grid;
    /* The call sits at the tile's leading corner, so it still reads when the next call overlaps. */
    place-items: center start;
    padding-left: 4px;
    width: 34px;
    height: 24px;
    flex: none;
    border-radius: 4px;
    background: var(--card);
    color: var(--card-ink);
    border-bottom: 3px solid var(--c);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    font-family: var(--font-card);
    font-weight: 800;
    font-size: 13px;
    line-height: 1;
  }
  /* Each call overlaps the one before it; the latest is on top. */
  .at-top .tile + .tile,
  .at-bottom .tile + .tile {
    margin-left: -13px;
  }
  .at-left .tile,
  .at-right .tile {
    align-items: start;
    padding-top: 4px;
  }
  .at-left .tile + .tile,
  .at-right .tile + .tile {
    margin-top: -9px;
  }
  /* A pass is the green card of a bidding box, and quieter. */
  .tile.pass {
    background: #3f8f5a;
    color: #f2fff5;
    font-size: 9.5px;
  }
  /* The bid to beat. */
  .tile.top {
    z-index: 1;
    box-shadow:
      0 0 0 2px var(--accent),
      0 0 12px var(--accent-glow),
      0 2px 4px rgba(0, 0, 0, 0.5);
  }
</style>
