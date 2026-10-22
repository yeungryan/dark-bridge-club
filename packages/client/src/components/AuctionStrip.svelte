<script lang="ts">
  import { next, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { avatarAtSeat, teamColor } from '../lib/avatars';
  import { profileOf } from '../lib/format';
  import CallText from './CallText.svelte';
  import AnimalIcon from './AnimalIcon.svelte';

  // Spec S12 (Ryan, round 10): this game's bidding during play, as a bidding table. One column
  // per player, in bidding order from the player on the dealer's right (the dealer marked D),
  // one row per round, every Pass included. The winning bid is ringed. Tap the contract to open.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const profiles = $derived(conn.room!.profiles);
  const deal = $derived(view.deal!);
  const first = $derived(next(deal.dealer));
  const order = $derived([first, next(first), next(next(first)), next(next(next(first)))] as Seat[]);
  // The calls always start with the first bidder, so each row is one round.
  const rounds = $derived(Array.from({ length: Math.ceil(deal.calls.length / 4) }, (_, r) => deal.calls.slice(r * 4, r * 4 + 4)));
  const lastBid = $derived(deal.calls.map((c) => c.call.type).lastIndexOf('bid'));
</script>

<table class="auction" aria-label="The bidding, in order">
  <thead>
    <tr>
      {#each order as seat (seat)}
        <th scope="col" style="--c: {teamColor(conn, seat)}">
          <AnimalIcon animal={avatarAtSeat(conn, seat)?.animal} />
          <span class="name">{profileOf(profiles, view.seating?.[seat]).name}</span>
          {#if seat === deal.dealer}<i class="dealer" title="Dealer" aria-label="dealer">D</i>{/if}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each rounds as round, r (r)}
      <tr>
        {#each order as seat, i (seat)}
          {@const entry = round[i]}
          <td class:pass={entry?.call.type === 'pass'} class:won={r * 4 + i === lastBid}>
            {#if entry}<CallText call={entry.call} />{/if}
          </td>
        {/each}
      </tr>
    {:else}
      <tr><td class="muted" colspan="4">No calls yet.</td></tr>
    {/each}
  </tbody>
</table>

<style>
  .auction {
    width: 100%;
    border-collapse: separate;
    border-spacing: 4px 3px;
    table-layout: fixed;
  }
  th {
    padding: 2px 0 4px;
    border-bottom: 3px solid var(--c);
    font-size: 12px;
    font-weight: 700;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name {
    vertical-align: middle;
  }
  .dealer {
    display: inline-grid;
    place-items: center;
    width: 14px;
    height: 14px;
    margin-left: 3px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 9px;
    font-style: normal;
    font-weight: 800;
    vertical-align: middle;
  }
  td {
    height: 28px;
    border-radius: 6px;
    background: var(--card);
    color: var(--card-ink);
    font-family: var(--font-card);
    font-size: 1.05rem;
    font-weight: 750;
    text-align: center;
  }
  td:empty {
    background: none;
  }
  td.pass {
    background: var(--panel);
    color: var(--ink-dim);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
  }
  td.won {
    box-shadow:
      0 0 0 2px var(--accent),
      0 0 10px var(--accent-glow);
  }
  .muted {
    background: none;
    color: var(--ink-dim);
    font-family: inherit;
    font-size: 0.85rem;
  }
</style>
