<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { onMount } from 'svelte';
  import { pairNames, profileOf } from '../lib/format';
  import { ribbons } from '../lib/juice/particles';
  import { cssColor } from '../lib/themes';
  import { settings } from '../lib/juice/settings.svelte';
  import CountUp from './CountUp.svelte';
  import { awardText } from '../lib/stories';
  import { pop } from '../lib/juice/particles';
  import { sound } from '../lib/juice/sound';

  // Spec S15, end of night: the final tally counts up, then the winners' banner lands with
  // confetti in their colors (or a "dead heat" banner). Then tonight's two top awards (S19;
  // Ryan: just two, for impact) flip in side by side, with a pause between for the banter.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const profiles = $derived(conn.room!.profiles);
  const final = $derived(view.final!);
  let banner = $state<HTMLElement>();
  // Matches the banner's CSS: it starts after 900ms and takes 500ms to land.
  const BANNER_LANDS = 1400;
  const AWARD_GAP = 1400;

  // The server's list is already in priority order.
  const awards = $derived((conn.room!.awards ?? []).slice(0, 2));
  // svelte-ignore state_referenced_locally
  let shown = $state(settings.animated ? 0 : awards.length);
  let cards = $state<HTMLElement[]>([]);
  onMount(() => {
    if (!settings.animated) return;
    const timers = awards.map((_, i) =>
      setTimeout(
        () => {
          shown = i + 1;
          sound.flip();
          setTimeout(() => {
            const r = cards[i]?.getBoundingClientRect();
            if (r && settings.motion) pop(r.left + r.width / 2, r.top + 28, cssColor('--accent', '#e8c25a'));
          }, settings.ms(260));
        },
        settings.ms(BANNER_LANDS + 700 + i * AWARD_GAP),
      ),
    );
    return () => timers.forEach(clearTimeout);
  });

  onMount(() => {
    if (!settings.motion || final.winner === 'tie') return;
    const colors = view.pairs![final.winner].map((id) => profileOf(profiles, id).color);
    const t = setTimeout(() => {
      const r = banner?.getBoundingClientRect();
      // The only real confetti in the game: paper ribbons for winning the night.
      if (r) ribbons(r.left + r.width / 2, r.top + r.height / 2, 120, [...colors, cssColor('--accent', '#e8c25a'), cssColor('--card', '#fbf8f0')]);
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
  {#if final.discardedDeal}<p class="muted">The unfinished last game didn't count.</p>{/if}
  {#if awards.length > 0}
    <section class="awards" aria-label="Tonight's awards">
      <h3>Tonight's awards</h3>
      {#each awards.slice(0, shown) as award, i (award.kind)}
        {@const text = awardText(award, profiles)}
        {@const p = profileOf(profiles, award.profile)}
        <article class="award" bind:this={cards[i]} style="--c: {p.color}; --tilt: {i ? 2 : -2}deg" aria-label={text.title}>
          <span class="emoji" aria-hidden="true">{text.emoji}</span>
          <h4>{text.headline}</h4>
          <p class="who">{text.line}</p>
        </article>
      {/each}
    </section>
  {/if}
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
  /* Two tall cards side by side, like trading cards dealt onto the table. */
  .awards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 8px 0 28px;
    perspective: 800px;
  }
  .awards h3 {
    grid-column: 1 / -1;
    margin: 0;
    text-align: center;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  /* An award card flips over and settles on a spring. */
  .award {
    display: grid;
    grid-template-rows: auto 1fr auto;
    justify-items: center;
    align-content: start;
    gap: 8px;
    min-height: 200px;
    padding: 18px 10px 14px;
    border-radius: 18px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--c) 22%, var(--panel)), var(--panel) 70%);
    box-shadow:
      0 0 0 1.5px color-mix(in srgb, var(--c) 55%, var(--line)),
      0 8px 24px rgba(0, 0, 0, 0.35),
      0 0 28px color-mix(in srgb, var(--c) 35%, transparent);
    transform: rotate(var(--tilt));
    animation: award-in calc(var(--spring-wobble-ms, 600ms) * var(--speed)) var(--spring-wobble, cubic-bezier(0.3, 1.5, 0.6, 1)) backwards;
  }
  @keyframes award-in {
    from {
      transform: rotateY(85deg) scale(0.8) rotate(var(--tilt));
      opacity: 0;
    }
  }
  :global(.fx-reduced) .award,
  :global(.fx-off) .award {
    animation: fade-in calc(300ms * var(--speed)) backwards;
  }
  .emoji {
    font-size: 60px;
    line-height: 1;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
  }
  .award h4 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.2rem;
    line-height: 1.2;
    color: var(--accent);
    text-wrap: balance;
  }
  /* One plain line: who, and what they did. */
  .who {
    margin: 0;
    font-size: 13px;
    line-height: 1.3;
    color: var(--ink-dim);
    text-wrap: balance;
  }
  button {
    width: 100%;
    min-height: 56px;
  }
</style>
