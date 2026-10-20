<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { onMount } from 'svelte';
  import { profileOf } from '../lib/format';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import { TIMING } from '../lib/juice/timing';

  // Spec S15 step 5: a spotlight sweeps the four names, slowing down, and lands on the captain.
  // Tap to skip. Then (S05 step 3) the captain's usual partner is pre-selected; one tap confirms.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const profiles = $derived(conn.room!.profiles);
  const captain = $derived(profileOf(profiles, view.captain ?? undefined));
  const isCaptain = $derived(view.captain === view.me);
  let picked = $state<string | null>(null);
  const choice = $derived(picked ?? view.suggestedPartner);

  // svelte-ignore state_referenced_locally
  let drawing = $state(settings.animated);
  let lit = $state(0);
  let timer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    if (!drawing) return;
    const { spotlightStep, spotlightSteps } = TIMING.ceremony;
    const target = Math.max(0, profiles.findIndex((p) => p.id === view.captain));
    // Start so that the last step lands on the captain.
    const start = (((target - (spotlightSteps - 1)) % 4) + 4) % 4;
    let step = 0;
    const tick = () => {
      lit = (start + step) % 4;
      sound.tick();
      if (step === spotlightSteps - 1) {
        timer = setTimeout(finish, settings.ms(350));
        return;
      }
      step++;
      // Each step a little slower than the last, like a wheel winding down.
      timer = setTimeout(tick, settings.ms(spotlightStep * (1 + step * 0.16)));
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  });

  function finish() {
    if (!drawing) return;
    if (timer) clearTimeout(timer);
    drawing = false;
    sound.accent();
  }
</script>

{#if drawing}
  <main class="draw">
    <button class="skip-area" aria-label="Skip the captain draw" onclick={finish}></button>
    <p class="muted">Drawing tonight's captain…</p>
    <div class="names">
      {#each profiles as p, i (p.id)}
        <span class:lit={lit === i} style="--c: {p.color}">{p.name}</span>
      {/each}
    </div>
    <p class="muted skip">Tap to skip</p>
  </main>
{:else}
<main>
  <p class="muted">Tonight's captain is</p>
  <h2 class="landed" style="color: {captain.color}">{captain.name}</h2>

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
{/if}

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
  .landed {
    animation: land calc(450ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1) backwards;
  }
  @keyframes land {
    0% {
      transform: scale(1.6);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .landed {
    animation-name: fade-in;
  }
  .draw {
    position: relative;
  }
  /* The whole screen is a skip button sitting above the names. */
  .skip-area {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: none;
    border: 0;
    z-index: 1;
  }
  .names {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 20px 0;
  }
  .names span {
    padding: 18px 8px;
    border-radius: 12px;
    border: 2px solid var(--line);
    font-size: 1.2rem;
    font-weight: 650;
    color: var(--ink-dim);
    transition: all calc(90ms * var(--speed));
  }
  .names span.lit {
    color: var(--c);
    border-color: var(--c);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 0 18px var(--c);
    transform: scale(1.05);
  }
  .skip {
    font-size: 13px;
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
