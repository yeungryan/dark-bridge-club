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

<div class="badge" class:turn={isTurn} style="--c: {profile.color}">
  <span class="name">
    <span class="dot" class:away={presence !== 'connected'} title={presence}></span>
    {profile.name}{#if deal?.dealer === seat}<span class="chip" title="Dealer">D</span>{/if}
  </span>
  {#if deal}
    <span class="role">{role ? `${role} · ` : ''}{deal.handCounts[seat]} cards</span>
  {/if}
</div>

<style>
  .badge {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 8px;
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
    color: var(--ink-dim);
  }
</style>
