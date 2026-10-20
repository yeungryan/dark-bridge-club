<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { tick } from 'svelte';
  import { avatarOf } from '../lib/avatars';
  import Avatar from './Avatar.svelte';
  import { elementBurst } from '../lib/juice/particles';
  import { themeOf } from '../lib/themes';
  import { sound } from '../lib/juice/sound';
  import AvatarPicker from './AvatarPicker.svelte';

  // Spec S15 (plain version): the DARK crest lights a letter as each friend arrives.
  let { conn, complete = false }: { conn: Connection; complete?: boolean } = $props();

  const room = $derived(conn.room!);
  const theme = $derived(themeOf(room.theme));
  const here = $derived(room.profiles.filter((p) => room.presence[p.id] === 'connected').length);

  // A rising note each time a letter lights; a flourish when the crest is complete.
  let lastHere = -1;
  $effect(() => {
    if (lastHere >= 0 && here > lastHere) sound.pip(here * 3);
    lastHere = here;
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
  <div class="crest" class:complete aria-label="DARK crest">
    {#each room.profiles as p (p.id)}
      <span class:lit={room.presence[p.id] === 'connected'} style="--c: {p.color}">{p.name[0]}</span>
    {/each}
  </div>
  <h2>Bridge Club</h2>
  <p class="tonight">
    <span class="label">Tonight's table</span>
    <strong class="display">{theme.name}</strong> <span class="place">{theme.place}</span>
    <em>{theme.greeting}</em>
  </p>
  {#if complete && room.avatars}
    <div class="reveal">
      {#each room.profiles as p, i (p.id)}
        {@const a = avatarOf(conn, p.id)}
        <div class="card" bind:this={cards[i]} style="--c: {p.color}">
          <Avatar avatar={a} initial={p.name[0]} ring={p.color} size={64} />
          <strong>{p.name}</strong>
        </div>
      {/each}
    </div>
  {:else}
    <AvatarPicker {conn} />
    <ul class="players">
      {#each room.profiles as p (p.id)}
        {@const isHere = room.presence[p.id] === 'connected'}
        {@const ready = isHere && room.avatarReady?.[p.id]}
        <li class:here={isHere} class:ready style="--c: {p.color}">
          <span class="dot" class:on={isHere}></span>
          <span class="name">{p.name}</span>
          <span class="status">{!isHere ? 'not here yet' : ready ? 'ready ✓' : 'picking…'}</span>
        </li>
      {/each}
    </ul>
    <p class="muted">{here}/4 here. The night starts when everyone is here and has picked.</p>
    <p class="muted extras">
      While you wait: <a href="lab.html" target="_blank">sound check</a> ·
      <a href="practice.html" target="_blank">practice table</a>
    </p>
  {/if}
</main>

<style>
  main {
    max-width: 380px;
    margin: 0 auto;
    padding: 40px 16px;
    text-align: center;
  }
  .crest {
    display: flex;
    justify-content: center;
    gap: 10px;
  }
  .crest span {
    width: 56px;
    height: 64px;
    display: grid;
    place-items: center;
    font-size: 2rem;
    font-weight: 800;
    border: 2px solid var(--line);
    border-radius: 10px;
    color: var(--line);
    transition: color 0.3s, border-color 0.3s;
  }
  .crest span.lit {
    color: var(--c);
    border-color: var(--c);
    animation: light calc(380ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  @keyframes light {
    0% {
      transform: scale(0.7);
    }
    60% {
      transform: scale(1.18);
    }
  }
  :global(.fx-reduced) .crest span.lit {
    animation: fade-in calc(300ms * var(--speed));
  }
  /* All four here: the whole crest flares. */
  .crest.complete span {
    animation: flare calc(1100ms * var(--speed)) ease-out;
    box-shadow: 0 0 18px var(--c);
  }
  @keyframes flare {
    30% {
      transform: translateY(-6px) scale(1.12);
      box-shadow: 0 0 30px var(--c);
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
    box-shadow: 0 0 0 1px var(--line), 0 0 18px color-mix(in srgb, var(--c) 35%, transparent);
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
    margin: 10px 0 24px;
  }
  .tonight {
    display: grid;
    gap: 2px;
    margin: -14px 0 18px;
  }
  .tonight .label {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .tonight strong {
    font-size: 1.25rem;
    color: var(--accent);
  }
  .tonight .place {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .tonight em {
    font-size: 14px;
    color: var(--ink-dim);
  }
  .players {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .players li {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    column-gap: 8px;
    align-items: center;
    text-align: left;
    padding: 8px 10px;
    border-radius: 12px;
    background: var(--panel);
    border: 1px solid var(--line);
    opacity: 0.65;
    transition: opacity calc(200ms * var(--speed)), border-color calc(200ms * var(--speed));
  }
  .players li.here {
    opacity: 1;
  }
  .players li.ready {
    border-color: var(--c);
  }
  .players .dot {
    grid-row: span 2;
  }
  .players .name {
    font-weight: 650;
    color: var(--c);
  }
  .players .status {
    font-size: 12px;
    color: var(--ink-dim);
  }
  .players li.ready .status {
    color: var(--good);
  }
  .extras {
    font-size: 14px;
  }
  .extras a {
    color: var(--accent);
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--c);
  }
  .dot.on {
    background: var(--c);
  }
</style>
