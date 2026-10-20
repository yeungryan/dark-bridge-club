<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { onMount } from 'svelte';
  import { pairNames, profileOf } from '../lib/format';
  import { burst } from '../lib/juice/particles';
  import { settings } from '../lib/juice/settings.svelte';
  import CountUp from './CountUp.svelte';

  // Spec S15, end of night: the final tally counts up, then the winners' banner lands with
  // confetti in their colors (or a "dead heat" banner). Awards and rivalry come in M3.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const profiles = $derived(conn.room!.profiles);
  const final = $derived(view.final!);
  let banner = $state<HTMLElement>();
  // Matches the banner's CSS: it starts after 900ms and takes 500ms to land.
  const BANNER_LANDS = 1400;

  onMount(() => {
    if (!settings.motion || final.winner === 'tie') return;
    const colors = view.pairs![final.winner].map((id) => profileOf(profiles, id).color);
    const t = setTimeout(() => {
      const r = banner?.getBoundingClientRect();
      if (r) burst(r.left + r.width / 2, r.top + r.height / 2, 120, [...colors, '#e8c25a', '#fbf8f0']);
    }, settings.ms(BANNER_LANDS));
    return () => clearTimeout(t);
  });
</script>

<main>
  <p class="muted">{final.reason === 'autoClosed' ? 'The night closed because someone was away for 30 minutes.' : 'Good night!'}</p>
  <p class="score">
    {pairNames(view, profiles, 'A')} <strong><CountUp value={final.wins.A} ticks /></strong> ·
    <strong><CountUp value={final.wins.B} ticks /></strong> {pairNames(view, profiles, 'B')}
  </p>
  {#if final.winner === 'tie'}
    <h2 bind:this={banner} class="banner">A dead heat</h2>
  {:else}
    <h2 bind:this={banner} class="banner">{pairNames(view, profiles, final.winner)} win the night</h2>
  {/if}
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
  /* The banner lands after the scores have counted up. */
  .banner {
    color: var(--accent);
    animation: drop calc(500ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1) calc(900ms * var(--speed)) backwards;
  }
  @keyframes drop {
    0% {
      transform: scale(1.8);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .banner {
    animation-name: fade-in;
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
