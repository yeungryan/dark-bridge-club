<script lang="ts">
  import type { Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { avatarAtSeat, teamOf } from '../lib/avatars';
  import { profileOf } from '../lib/format';
  import Avatar from './Avatar.svelte';

  // Spec S10, redesigned: the avatar is the hero (the animal with its element's aura), with the
  // cards left as a Team Red / Team Black badge on its corner, then the name, plain. No role tags
  // (Ryan): the scoreboard says who declared. Whose turn it is: the avatar pulses. Used for all
  // four seats, you included.
  let { conn, seat }: { conn: Connection; seat: Seat } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal);
  const profile = $derived(profileOf(conn.room!.profiles, view.seating?.[seat]));
  const presence = $derived(conn.room!.presence[profile.id]);
  // Whose turn: their avatar pulses (Avatar.svelte); the other seats dim a little (never their
  // badge, so the teams stay legible). On your own turn your seat also lifts.
  const turn = $derived(deal?.turn === seat && (deal.phase === 'auction' || deal.phase === 'play'));
  const waiting = $derived(deal?.turn !== null && deal?.turn !== undefined && !turn && (deal.phase === 'auction' || deal.phase === 'play'));
  const mine = $derived(seat === view.mySeat);
</script>

<div class="seat" class:turn class:waiting class:mine data-badge-seat={seat} title={presence !== 'connected' ? `${profile.name} is ${presence}` : undefined}>
  <Avatar
    avatar={avatarAtSeat(conn, seat)}
    initial={profile.name[0]}
    size={46}
    {turn}
    away={presence !== 'connected'}
    count={deal ? deal.handCounts[seat] : null}
    team={teamOf(conn, seat)}
  />
  <span class="name">{profile.name}</span>
</div>

<style>
  .seat {
    display: inline-grid;
    /* One column that can't be widened by its text, so the avatar never drifts sideways. */
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    gap: 3px;
    /* A fixed size, so no seat shifts when the card count changes (fonts differ from phone to
       phone). */
    width: 84px;
    height: 80px;
    align-content: start;
    padding: 6px 2px 4px;
    text-align: center;
  }
  .name {
    margin-top: 4px;
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
  .seat.waiting .name,
  .seat.waiting :global(.face) {
    opacity: 0.62;
  }
  .seat.turn.mine {
    transform: translateY(-4px);
  }
</style>
