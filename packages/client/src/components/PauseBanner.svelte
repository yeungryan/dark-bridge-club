<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Connection } from '../lib/connection.svelte';

  // Spec S08: calm pause while someone is away; countdown only in the last 5 minutes.
  let { conn }: { conn: Connection } = $props();

  let now = $state(Date.now());
  const timer = setInterval(() => (now = conn.now()), 1000);
  onDestroy(() => clearInterval(timer));

  const room = $derived(conn.room!);
  const away = $derived(room.profiles.filter((p) => room.presence[p.id] === 'away').map((p) => p.name));
  const remaining = $derived(room.autoCloseAt ? Math.max(0, room.autoCloseAt - now) : null);
  const clock = $derived(
    remaining === null ? '' : `${Math.floor(remaining / 60_000)}:${String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0')}`,
  );
</script>

{#if room.paused}
  <div class="banner" role="status">
    Waiting for {away.join(' and ')}…
    {#if remaining !== null && remaining < 5 * 60_000}
      <span class="muted">The night closes in {clock}.</span>
    {/if}
  </div>
{/if}

<style>
  .banner {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(10, 20, 15, 0.92);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 16px 20px;
    text-align: center;
    z-index: 35;
    width: min(320px, calc(100% - 32px));
  }
  .banner .muted {
    display: block;
    margin-top: 6px;
  }
</style>
