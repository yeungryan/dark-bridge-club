<script lang="ts">
  import { partner, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { profileOf } from '../lib/format';

  // Spec S10: name + color, presence, dealer chip, turn glow, role.
  let { conn, seat }: { conn: Connection; seat: Seat } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal);
  const profile = $derived(profileOf(conn.room!.profiles, view.seating?.[seat]));
  const presence = $derived(conn.room!.presence[profile.id]);
  const isTurn = $derived(deal?.turn === seat);
  const role = $derived.by(() => {
    const c = deal?.contract;
    if (!c) return '';
    return seat === c.declarer ? 'Declarer' : seat === partner(c.declarer) ? 'Decl. partner' : 'Defender';
  });
</script>

<div class="badge" class:turn={isTurn} style="--c: {profile.color}" data-badge-seat={seat}>
  {#if deal?.dealer === seat}<span class="chip" title="Dealer">D</span>{/if}
  <span class="name">
    <span class="dot" class:away={presence !== 'connected'} title={presence}></span>
    {profile.name}
  </span>
  {#if deal}
    {#if role}<span class="role">{role}</span>{/if}
    <span class="role">{deal.handCounts[seat]} {deal.handCounts[seat] === 1 ? 'card' : 'cards'}</span>
  {/if}
</div>

<style>
  .badge {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 6px;
    width: 88px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: var(--panel);
    max-width: 100%;
    text-align: center;
  }
  .badge.turn {
    border-color: var(--accent);
    box-shadow: 0 0 12px rgba(232, 194, 90, 0.5);
  }
  .name {
    font-weight: 650;
    color: var(--c);
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--good);
  }
  .dot.away {
    background: var(--bad);
  }
  .chip {
    position: absolute;
    top: -8px;
    right: -6px;
    font-size: 11px;
    background: var(--ink);
    color: var(--felt);
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
  }
  .role {
    font-size: 12px;
    line-height: 1.25;
    color: var(--ink-dim);
  }
</style>
