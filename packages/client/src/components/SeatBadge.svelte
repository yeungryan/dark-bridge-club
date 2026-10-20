<script lang="ts">
  import { partner, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { avatarAtSeat, teamColor } from '../lib/avatars';
  import { profileOf } from '../lib/format';
  import Avatar from './Avatar.svelte';

  // Spec S10, redesigned: the avatar is the hero. Team-coloured ring, element badge and cards
  // left on its corners, dealer chip on top; name in the theme's name font underneath, and a
  // small role tag once the contract is set. Whose turn it is: the ring glows.
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
    size={44}
    count={deal ? deal.handCounts[seat] : null}
    dealer={deal?.dealer === seat}
    turn={deal?.turn === seat}
    away={presence !== 'connected'}
  />
  <span class="name">{profile.name}</span>
  {#if role}<span class="role" class:decl={role === 'Declarer'}>{role}</span>{/if}
</div>

<style>
  .seat {
    display: inline-grid;
    justify-items: center;
    gap: 3px;
    width: 88px;
    max-width: 100%;
    padding: 6px 2px 4px;
    text-align: center;
  }
  .name {
    margin-top: 3px;
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
