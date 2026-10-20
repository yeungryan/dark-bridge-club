<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { callLabel, profileOf } from '../lib/format';

  // Spec S12: each call in turn order, in its player's color.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const profiles = $derived(conn.room!.profiles);
</script>

<div class="strip" aria-label="Auction">
  {#each view.deal!.calls as entry, i (i)}
    {@const p = profileOf(profiles, view.seating?.[entry.seat])}
    <span class="call" style="--c: {p.color}">
      <small>{p.name}</small>
      <strong class:red={entry.call.type === 'bid' && (entry.call.strain === 'H' || entry.call.strain === 'D')}>{callLabel(entry.call)}</strong>
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
  /* Each new call is stamped into place (S12). */
  .call {
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
  @keyframes stamp-in {
    0% {
      transform: scale(1.4) translateY(-6px);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .call {
    animation-name: fade-in;
  }
  small {
    font-size: 12px;
    color: var(--ink-dim);
  }
  .red {
    color: #ff8a7a;
  }
</style>
