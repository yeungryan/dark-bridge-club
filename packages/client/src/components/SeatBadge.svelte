<script lang="ts">
  import { partner, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { avatarAtSeat, teamColor } from '../lib/avatars';
  import { profileOf } from '../lib/format';
  import Avatar from './Avatar.svelte';

  // Spec S10, redesigned: the avatar is the hero (team-coloured ring, element inside it), then
  // one line with cards left (a tiny card) and the name, then a small role tag once the
  // contract is set. Whose turn it is: the ring glows. Used for all four seats, you included.
  let { conn, seat }: { conn: Connection; seat: Seat } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal);
  const profile = $derived(profileOf(conn.room!.profiles, view.seating?.[seat]));
  const presence = $derived(conn.room!.presence[profile.id]);
  const role = $derived.by(() => {
    const c = deal?.contract;
    if (!c) return '';
    return seat === c.declarer ? 'Declarer' : seat === partner(c.declarer) ? 'Partner' : 'Defender';
  });
</script>

<div class="seat" data-badge-seat={seat} title={presence !== 'connected' ? `${profile.name} is ${presence}` : undefined}>
  <Avatar
    avatar={avatarAtSeat(conn, seat)}
    initial={profile.name[0]}
    ring={teamColor(conn, seat)}
    size={46}
    turn={deal?.turn === seat}
    away={presence !== 'connected'}
  />
  <span class="nameline">
    {#if deal}
      {@const n = deal.handCounts[seat]}
      <span class="count" aria-label="{n} {n === 1 ? 'card' : 'cards'} left">{n}</span>
    {/if}
    <span class="name">{profile.name}</span>
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
