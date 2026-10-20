<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { animalById, avatarName } from '@dark/engine';
  import { tick } from 'svelte';
  import { avatarOf, ELEMENT_RING } from '../lib/avatars';
  import { elementBurst } from '../lib/juice/particles';
  import { sound } from '../lib/juice/sound';
  import AvatarPicker from './AvatarPicker.svelte';

  // Spec S15 (plain version): the DARK crest lights a letter as each friend arrives.
  let { conn, complete = false }: { conn: Connection; complete?: boolean } = $props();

  const room = $derived(conn.room!);
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
  {#if complete && room.avatars}
    <div class="reveal">
      {#each room.profiles as p, i (p.id)}
        {@const a = avatarOf(conn, p.id)}
        <div class="card" bind:this={cards[i]} style="--c: {p.color}; --el: {a ? ELEMENT_RING[a.element] : 'var(--line)'}">
          <span class="big">{a ? animalById(a.animal)?.emoji : '❔'}</span>
          <strong style="color: {p.color}">{p.name}</strong>
          <small>{a ? avatarName(a) : ''}</small>
        </div>
      {/each}
    </div>
  {:else}
    <AvatarPicker {conn} />
    <ul>
      {#each room.profiles as p (p.id)}
        {@const isHere = room.presence[p.id] === 'connected'}
        <li>
          <span class="dot" style="--c: {p.color}" class:on={isHere}></span>
          {p.name}
          <span class="muted">{!isHere ? 'not here yet' : room.avatarReady?.[p.id] ? 'ready ✓' : 'picking…'}</span>
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
    box-shadow: 0 0 0 2px var(--el), 0 0 18px var(--el);
    animation: flip-in calc(600ms * var(--speed)) cubic-bezier(0.3, 1.4, 0.6, 1) calc(300ms * var(--speed)) backwards;
  }
  .card .big {
    font-size: 46px;
    line-height: 1.1;
  }
  .card small {
    color: var(--ink-dim);
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
  ul {
    list-style: none;
    padding: 0;
    text-align: left;
  }
  li {
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
    display: flex;
    gap: 10px;
    align-items: center;
  }
  li .muted {
    margin-left: auto;
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
