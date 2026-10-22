<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { tick } from 'svelte';
  import { avatarOf, crestOf } from '../lib/avatars';
  import CrestTile from './CrestTile.svelte';
  import Avatar from './Avatar.svelte';
  import { elementBurst } from '../lib/juice/particles';
  import { themeOf } from '../lib/themes';
  import { sound } from '../lib/juice/sound';
  import AvatarPicker from './AvatarPicker.svelte';
  import History from './History.svelte';
  import LastTime from './LastTime.svelte';
  import NextNight from './NextNight.svelte';
  import Scheduler from './Scheduler.svelte';

  // Spec S15, cleaned up (Ryan): the DARK crest is the guest list. A letter is dim grey until
  // its player arrives, lights up when they're here (all four in one colour), and fills solid with a
  // small check once they've picked their animal. No list, no counts, no extra words.
  let { conn, complete = false }: { conn: Connection; complete?: boolean } = $props();
  let showHistory = $state(false);
  let showScheduler = $state(false);
  let schedulerClosed = $state(0);

  const room = $derived(conn.room!);
  const theme = $derived(themeOf(room.theme));
  const here = $derived(room.profiles.filter((p) => room.presence[p.id] === 'connected').length);
  const picked = $derived(room.profiles.filter((p) => room.avatarReady?.[p.id]).length);

  // A rising note each time a letter lights or fills; a flourish when the crest is complete.
  let lastHere = -1;
  let lastPicked = -1;
  $effect(() => {
    if (lastHere >= 0 && here > lastHere) sound.pip(here * 3);
    if (lastPicked >= 0 && picked > lastPicked) sound.count(picked * 2 + 4);
    lastHere = here;
    lastPicked = picked;
  });
  // All four in and picked: the crest flares and everyone's avatar flips over at once,
  // each with its element's entrance (S24).
  let cards: HTMLElement[] = $state([]);
  $effect(() => {
    if (!complete) return;
    sound.fanfare();
    void tick().then(() =>
      setTimeout(() => {
        room.profiles.forEach((p, i) => {
          const a = avatarOf(conn, p.id);
          const r = cards[i]?.getBoundingClientRect();
          if (a && r) elementBurst(a.element, r.left + r.width / 2, r.top + r.height / 2);
        });
      }, 450),
    );
  });
</script>

<main>
  <div class="crest" class:complete aria-label="Who's here">
    {#each room.profiles as p, i (p.id)}
      {@const isHere = room.presence[p.id] === 'connected'}
      {@const ready = !!room.avatarReady?.[p.id]}
      {@const c = crestOf(p.id, i)}
      <span
        class="slot"
        class:lit={isHere}
        class:ready
        title="{p.name}: {!isHere ? 'not here yet' : ready ? 'ready' : 'picking'}"
        aria-label="{p.name}: {!isHere ? 'not here yet' : ready ? 'ready' : 'picking'}"
      >
        <CrestTile letter={p.name[0]!} suit={c.suit} team={c.team} state={ready ? 'ready' : isHere ? 'lit' : 'off'}>
          {#if ready}<i class="check" aria-hidden="true">✓</i>{/if}
        </CrestTile>
      </span>
    {/each}
  </div>
  <h2>Bridge Club</h2>
  <p class="tonight">
    <span class="label">Tonight's table</span>
    <strong class="display"><span class="flag">{theme.flag}</span> {theme.name}</strong>
  </p>
  {#if complete && room.avatars}
    <div class="reveal">
      {#each room.profiles as p, i (p.id)}
        {@const a = avatarOf(conn, p.id)}
        <div class="card" bind:this={cards[i]} style="--c: {p.color}">
          <Avatar avatar={a} initial={p.name[0]} size={64} />
          <strong>{p.name}</strong>
        </div>
      {/each}
    </div>
  {:else}
    <AvatarPicker {conn} />
    <!-- How the last night went (S20); the practice table has no history. -->
    {#if !conn.offline}
      <!-- The next night (S21), then the last one (S20). -->
      <NextNight profiles={room.profiles} me={conn.view!.me} refreshKey={schedulerClosed} onOpen={() => (showScheduler = true)} />
      <LastTime profiles={room.profiles} me={conn.view!.me} onHistory={() => (showHistory = true)} />
    {/if}
    <p class="extras">
      <a href="lab.html" target="_blank">sound check</a> · <a href="practice.html" target="_blank">practice table</a>
    </p>
  {/if}
</main>
{#if showScheduler}
  <Scheduler
    profiles={room.profiles}
    me={conn.view!.me}
    theme={room.theme}
    onClose={() => {
      showScheduler = false;
      schedulerClosed++;
    }}
  />
{/if}
{#if showHistory}
  <History profiles={room.profiles} me={conn.view!.me} theme={room.theme} onClose={() => (showHistory = false)} />
{/if}

<style>
  /* Everything starts below the theme's scene at the top, so nothing overlaps it. */
  main {
    max-width: 380px;
    margin: 0 auto;
    padding: 200px 16px 24px;
    text-align: center;
  }
  /* The DARK crest (Ryan, L1 revised): Team Red's A and R, Team Black's D and K (CrestTile). */
  .crest {
    display: flex;
    justify-content: center;
    gap: 10px;
  }
  .slot {
    display: grid;
  }
  .slot.lit {
    animation: light calc(380ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  .slot.ready {
    animation: fill calc(420ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  .check {
    position: absolute;
    right: -6px;
    bottom: -6px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--sheet);
    color: var(--good);
    font-style: normal;
    font-size: 12px;
    font-weight: 800;
    box-shadow: 0 0 0 2px var(--line);
  }
  @keyframes light {
    0% {
      transform: scale(0.7);
    }
    60% {
      transform: scale(1.18);
    }
  }
  @keyframes fill {
    40% {
      transform: scale(1.14) rotate(-4deg);
    }
  }
  :global(.fx-reduced) .slot.lit,
  :global(.fx-reduced) .slot.ready {
    animation: fade-in calc(300ms * var(--speed));
  }
  /* All four here: the whole crest flares. */
  .crest.complete .slot {
    animation: flare calc(1100ms * var(--speed)) ease-out;
  }
  @keyframes flare {
    30% {
      transform: translateY(-6px) scale(1.12);
    }
  }
  /* The four avatars flip over together. */
  .reveal {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    perspective: 600px;
  }
  .card {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 12px 6px;
    border-radius: 12px;
    background: var(--panel);
    box-shadow:
      0 0 0 1px var(--line),
      0 0 18px color-mix(in srgb, var(--c) 35%, transparent);
    animation: flip-in calc(600ms * var(--speed)) cubic-bezier(0.3, 1.4, 0.6, 1) calc(300ms * var(--speed)) backwards;
  }
  .card strong {
    margin-top: 8px;
    font-family: var(--font-name);
    color: var(--c);
  }
  @keyframes flip-in {
    0% {
      transform: rotateY(90deg) scale(0.8);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .card {
    animation-name: fade-in;
  }
  h2 {
    font-weight: 400;
    color: var(--ink-dim);
    margin: 10px 0 20px;
  }
  .tonight {
    display: grid;
    gap: 2px;
    margin: -10px 0 22px;
  }
  .tonight .label {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .tonight strong {
    font-size: 1.3rem;
    color: var(--accent);
  }
  .flag {
    font-family: system-ui, sans-serif;
  }
  .extras {
    margin-top: 24px;
    font-size: 13px;
    color: var(--ink-dim);
  }
  .extras a {
    color: var(--ink-dim);
  }
</style>
