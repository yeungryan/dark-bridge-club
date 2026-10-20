<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { pairNames } from '../lib/format';

  // Plain end-of-night screen (the ceremony comes in M2, spec S15).
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const profiles = $derived(conn.room!.profiles);
  const final = $derived(view.final!);
</script>

<main>
  <p class="muted">{final.reason === 'autoClosed' ? 'The night closed because someone was away for 30 minutes.' : 'Good night!'}</p>
  {#if final.winner === 'tie'}
    <h2>A dead heat</h2>
  {:else}
    <h2>{pairNames(view, profiles, final.winner)} win the night</h2>
  {/if}
  <p class="score">
    {pairNames(view, profiles, 'A')} <strong>{final.wins.A}</strong> · <strong>{final.wins.B}</strong> {pairNames(view, profiles, 'B')}
  </p>
  {#if final.discardedDeal}<p class="muted">The unfinished last deal didn't count.</p>{/if}
  <button class="primary" onclick={() => conn.send({ type: 'newNight' })}>Start a new night</button>
</main>

<style>
  main {
    max-width: 380px;
    margin: 0 auto;
    padding: 64px 16px;
    text-align: center;
  }
  h2 {
    font-size: 1.8rem;
  }
  .score {
    font-size: 1.2rem;
    margin-bottom: 32px;
  }
  button {
    width: 100%;
    min-height: 56px;
  }
</style>
