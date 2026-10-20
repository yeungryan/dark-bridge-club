<script lang="ts">
  import { partner, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { avatarAtSeat, teamColor } from '../lib/avatars';
  import { profileOf } from '../lib/format';
  import Avatar from './Avatar.svelte';

  // Spec S10, redesigned: the avatar is the hero (team-coloured ring, element inside it), then
  // one line with the name and cards left (a tiny card), then a small role tag once the
  // contract is set. Whose turn it is: the ring glows. Used for all four seats, you included.
  let { conn, seat }: { conn: Connection; seat: Seat } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal);
  const profile = $derived(profileOf(conn.room!.profiles, view.seating?.[seat]));
  const presence = $derived(conn.room!.presence[profile.id]);
  // Whose turn (Ryan's pick: a combo): their ring breathes and their name lights up; the other
  // seats dim a little. On your own turn your seat also lifts.
  const turn = $derived(deal?.turn === seat && (deal.phase === 'auction' || deal.phase === 'play'));
  const waiting = $derived(deal?.turn !== null && deal?.turn !== undefined && !turn && (deal.phase === 'auction' || deal.phase === 'play'));
  const mine = $derived(seat === view.mySeat);
  const role = $derived.by(() => {
    const c = deal?.contract;
    if (!c) return '';
    return seat === c.declarer ? 'Declarer' : seat === partner(c.declarer) ? 'Partner' : 'Defender';
  });
</script>

<div class="seat" class:turn class:waiting class:mine data-badge-seat={seat} title={presence !== 'connected' ? `${profile.name} is ${presence}` : undefined}>
  <Avatar
    avatar={avatarAtSeat(conn, seat)}
    initial={profile.name[0]}
    ring={teamColor(conn, seat)}
    size={46}
    {turn}
    away={presence !== 'connected'}
  />
  <span class="nameline">
    <span class="name">{profile.name}</span>
    {#if deal}
      {@const n = deal.handCounts[seat]}
      <span class="count" aria-label="{n} {n === 1 ? 'card' : 'cards'} left">{n}</span>
    {/if}
  </span>
  {#if role}<span class="role" class:decl={role === 'Declarer'}>{role}</span>{/if}
</div>

<style>
  .seat {
    display: inline-grid;
    justify-items: center;
    gap: 3px;
    min-width: 64px;
    max-width: 88px;
    /* Room for the role tag even before there is one, so seats don't shift when it appears. */
    min-height: 88px;
    align-content: start;
    padding: 6px 2px 4px;
    text-align: center;
  }
  .nameline {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    margin-top: 4px;
  }
  /* Cards left: a tiny card with the number on it, the height of the name. */
  .count {
    display: grid;
    place-items: center;
    flex: none;
    min-width: 13px;
    height: 17px;
    padding: 0 2px;
    border-radius: 2.5px;
    background: var(--card);
    color: var(--card-ink);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    font-family: var(--font-card);
    font-weight: 700;
    font-size: 10.5px;
    line-height: 1;
  }
  .name {
    font-family: var(--font-name);
    font-weight: 700;
    font-size: 15px;
    line-height: 1.1;
    color: var(--ink);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .seat {
    transition:
      opacity calc(250ms * var(--speed)),
      transform calc(250ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1);
  }
  .seat.waiting {
    opacity: 0.62;
  }
  .seat.turn .name {
    color: var(--accent);
    text-shadow: 0 0 10px var(--accent-glow);
  }
  :global(.fx-full) .seat.turn .name {
    animation: name-pulse calc(1600ms * var(--speed)) ease-in-out infinite;
  }
  @keyframes name-pulse {
    50% {
      transform: scale(1.06);
      text-shadow: 0 0 2px var(--accent-glow);
    }
  }
  .seat.turn.mine {
    transform: translateY(-4px);
  }
  .role {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .role.decl {
    color: var(--accent);
  }
</style>
