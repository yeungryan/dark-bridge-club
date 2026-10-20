<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { sound } from '../lib/juice/sound';

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
  $effect(() => {
    if (complete) sound.fanfare();
  });
</script>

<main>
  <div class="crest" class:complete aria-label="DARK crest">
    {#each room.profiles as p (p.id)}
      <span class:lit={room.presence[p.id] === 'connected'} style="--c: {p.color}">{p.name[0]}</span>
    {/each}
  </div>
  <h2>Bridge Club</h2>
  <ul>
    {#each room.profiles as p (p.id)}
      <li>
        <span class="dot" style="--c: {p.color}" class:on={room.presence[p.id] === 'connected'}></span>
        {p.name}
        <span class="muted">{room.presence[p.id] === 'connected' ? 'is here' : 'not here yet'}</span>
      </li>
    {/each}
  </ul>
  <p class="muted">{here}/4 here. The night starts as soon as everyone has joined.</p>
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
