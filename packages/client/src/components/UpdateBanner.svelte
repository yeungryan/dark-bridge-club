<script lang="ts">
  import { onMount } from 'svelte';
  import { update } from '../lib/update.svelte';

  // A newer build is live: a slim bar at the top offers to load it (Ryan, QoL). Never a pop-up,
  // and never reloads by itself, so it can't interrupt a game: tap Refresh when it suits you.
  onMount(() => update.start());
</script>

{#if update.ready}
  <div class="update" role="status">
    <span>A new version is ready</span>
    <button class="go" onclick={() => location.reload()}>Refresh</button>
    <button class="later" aria-label="Not now" onclick={() => update.later()}>✕</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    top: max(6px, env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
    z-index: 45;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 14px;
    border-radius: 999px;
    background: var(--felt-light);
    border: 1px solid var(--line);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    font-size: 14px;
    white-space: nowrap;
  }
  button {
    min-height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    font-size: 14px;
  }
  .go {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
  }
  .later {
    padding: 0 10px;
    background: none;
    border-color: transparent;
  }
</style>
