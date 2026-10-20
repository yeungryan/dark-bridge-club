<script lang="ts">
  import { animalById, avatarName, ELEMENT_INFO, ELEMENTS, type Element } from '@dark/engine';
  import { onDestroy } from 'svelte';
  import type { Connection } from '../lib/connection.svelte';
  import { ELEMENT_RING } from '../lib/avatars';
  import { buzz } from '../lib/juice/haptics';
  import { sound } from '../lib/juice/sound';

  // Spec S24: pick tonight's animal (from three, one reroll) and element, privately, while
  // waiting in the lobby. Nobody sees anyone's choice until everyone flips together.
  let { conn }: { conn: Connection } = $props();

  const pick = $derived(conn.myAvatar);
  let animal = $state<string | null>(null);
  let element = $state<Element | null>(null);

  // A reroll replaces the offer, so forget a choice that's no longer on it.
  $effect(() => {
    if (animal && pick && !pick.offered.includes(animal)) animal = null;
  });

  let now = $state(Date.now());
  const timer = setInterval(() => (now = conn.now()), 500);
  onDestroy(() => clearInterval(timer));
  const surpriseIn = $derived(conn.room?.surpriseAt ? Math.max(0, Math.ceil((conn.room.surpriseAt - now) / 1000)) : null);

  function tap() {
    sound.tap();
    buzz('tap');
  }
  function send(action: Parameters<Connection['send']>[0]) {
    conn.send(action);
  }
  function lock() {
    if (!animal || !element) return;
    sound.sold();
    buzz('sold');
    send({ type: 'avatar', action: { type: 'lock', animal, element } });
  }
</script>

{#if pick}
  <section class="picker panel" aria-label="Tonight's avatar">
    {#if pick.avatar}
      {@const a = animalById(pick.avatar.animal)}
      <div class="locked" style="--el: {ELEMENT_RING[pick.avatar.element]}">
        <span class="big">{a?.emoji}</span>
        <div>
          <strong>{avatarName(pick.avatar)}</strong>
          <p class="muted">Locked in. Everyone flips together when the night starts.</p>
        </div>
        <button class="ghost" onclick={() => send({ type: 'avatar', action: { type: 'unlock' } })}>Change</button>
      </div>
    {:else}
      <h3>Who are you tonight?</h3>
      <div class="animals">
        {#each pick.offered as id (id)}
          {@const a = animalById(id)}
          <button
            class="animal"
            class:on={animal === id}
            onclick={() => {
              tap();
              animal = id;
            }}
          >
            <span class="big">{a?.emoji}</span>
            <span>{a?.name}</span>
          </button>
        {/each}
      </div>
      <button
        class="ghost reroll"
        disabled={pick.rerolled}
        onclick={() => {
          tap();
          send({ type: 'avatar', action: { type: 'reroll' } });
        }}>{pick.rerolled ? 'Reroll used' : '↻ Show me three others (once)'}</button
      >
      <div class="elements">
        {#each ELEMENTS as e (e)}
          <button
            class="element"
            class:on={element === e}
            style="--el: {ELEMENT_RING[e]}"
            onclick={() => {
              tap();
              element = e;
            }}
          >
            <span>{ELEMENT_INFO[e].glyph}</span>
            <span>{ELEMENT_INFO[e].name}</span>
          </button>
        {/each}
      </div>
      <div class="actions">
        <button class="ghost" onclick={() => send({ type: 'avatar', action: { type: 'surprise' } })}>Surprise me</button>
        <button class="primary" disabled={!animal || !element} onclick={lock}>
          {animal && element ? `Lock in ${ELEMENT_INFO[element].name} ${animalById(animal)?.name}` : 'Pick an animal and an element'}
        </button>
      </div>
      {#if surpriseIn !== null}<p class="muted hurry">Everyone else is ready: surprise pick in {surpriseIn}s</p>{/if}
    {/if}
  </section>
{/if}

<style>
  .picker {
    display: grid;
    gap: 10px;
    margin: 0 0 18px;
    text-align: center;
  }
  h3 {
    margin: 0;
    font-size: 1.05rem;
  }
  .animals {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .animal {
    min-height: 92px;
    display: grid;
    place-items: center;
    gap: 2px;
    padding: 6px 2px;
    font-size: 14px;
  }
  .big {
    font-size: 40px;
    line-height: 1;
  }
  .on {
    outline: 3px solid var(--accent);
  }
  :global(.fx-full) .animal.on,
  :global(.fx-full) .element.on {
    animation: pick calc(240ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  @keyframes pick {
    40% {
      transform: scale(1.08);
    }
  }
  .reroll {
    font-size: 14px;
    min-height: 36px;
  }
  .elements {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .element {
    display: grid;
    place-items: center;
    gap: 2px;
    min-height: 60px;
    font-size: 13px;
    border-bottom: 3px solid var(--el);
  }
  .element span:first-child {
    font-size: 22px;
  }
  .element.on {
    outline-color: var(--el);
    box-shadow: 0 0 14px var(--el);
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 8px;
  }
  .actions button {
    min-height: 52px;
  }
  .locked {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 12px;
    align-items: center;
    text-align: left;
  }
  .locked .big {
    border-radius: 50%;
    padding: 6px;
    box-shadow: 0 0 0 3px var(--el), 0 0 16px var(--el);
  }
  .locked p {
    margin: 2px 0 0;
    font-size: 13px;
  }
  .hurry {
    margin: 0;
    color: var(--accent);
  }
</style>
