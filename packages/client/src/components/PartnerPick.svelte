<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { profileOf } from '../lib/format';

  // Spec S05 step 3: the captain's usual partner is pre-selected; one tap confirms.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const profiles = $derived(conn.room!.profiles);
  const captain = $derived(profileOf(profiles, view.captain ?? undefined));
  const isCaptain = $derived(view.captain === view.me);
  let picked = $state<string | null>(null);
  const choice = $derived(picked ?? view.suggestedPartner);
</script>

<main>
  <p class="muted">Tonight's captain is</p>
  <h2 style="color: {captain.color}">{captain.name}</h2>

  {#if isCaptain}
    <p>Pick your partner for the night.</p>
    <div class="options">
      {#each profiles.filter((p) => p.id !== view.me) as p (p.id)}
        <button class:selected={choice === p.id} style="--c: {p.color}" onclick={() => (picked = p.id)}>
          {p.name}
          {#if p.id === view.suggestedPartner}<small>usual partner</small>{/if}
        </button>
      {/each}
    </div>
    <button class="primary confirm" disabled={!choice} onclick={() => conn.intent({ type: 'pickPartner', partner: choice! })}>
      Partner with {profileOf(profiles, choice ?? undefined).name}
    </button>
  {:else}
    <p class="muted">{captain.name} is choosing a partner…</p>
  {/if}
</main>

<style>
  main {
    max-width: 380px;
    margin: 0 auto;
    padding: 48px 16px;
    text-align: center;
  }
  h2 {
    font-size: 2.2rem;
    margin: 4px 0 24px;
  }
  .options {
    display: grid;
    gap: 10px;
    margin-bottom: 16px;
  }
  .options button {
    min-height: 60px;
    border-left: 6px solid var(--c);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .options button.selected {
    outline: 3px solid var(--accent);
  }
  small {
    color: var(--ink-dim);
  }
  .confirm {
    width: 100%;
    min-height: 56px;
  }
</style>
