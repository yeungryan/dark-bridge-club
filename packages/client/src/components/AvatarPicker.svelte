<script lang="ts">
  import { animalById, ELEMENT_INFO, ELEMENTS, type Element } from '@dark/engine';
  import { onDestroy } from 'svelte';
  import type { Connection } from '../lib/connection.svelte';
  import { ELEMENT_RING } from '../lib/avatars';
  import { buzz } from '../lib/juice/haptics';
  import { sound } from '../lib/juice/sound';
  import AnimalIcon from './AnimalIcon.svelte';
  import { elementArt } from '../lib/animalArt';

  // Spec S24, simplified (Ryan): two animals, four elements, no words and no buttons to confirm.
  // Picking one of each locks you in; tapping another changes it until the night starts.
  // Nobody sees anyone's choice until everyone flips together.
  let { conn }: { conn: Connection } = $props();

  const pick = $derived(conn.myAvatar);
  let animal = $state<string | null>(null);
  let element = $state<Element | null>(null);

  // Come back to the lobby (reload, new device) with your pick showing; forget an animal from
  // an old offer.
  $effect(() => {
    if (pick?.avatar && animal === null && element === null) {
      animal = pick.avatar.animal;
      element = pick.avatar.element;
    }
    if (animal && pick && !pick.offered.includes(animal)) animal = null;
  });

  let now = $state(Date.now());
  const timer = setInterval(() => (now = conn.now()), 500);
  onDestroy(() => clearInterval(timer));
  const surpriseIn = $derived(
    conn.room?.surpriseAt && !pick?.avatar ? Math.max(0, Math.ceil((conn.room.surpriseAt - now) / 1000)) : null,
  );

  function choose(next: { animal?: string; element?: Element }) {
    if (next.animal) animal = next.animal;
    if (next.element) element = next.element;
    if (animal && element) {
      sound.sold();
      buzz('sold');
      conn.send({ type: 'avatar', action: { type: 'lock', animal, element } });
    } else {
      sound.tap();
      buzz('tap');
    }
  }
</script>

{#if pick}
  <section class="picker" aria-label="Tonight's avatar">
    <h3>Who are you tonight?</h3>
    <div class="animals">
      {#each pick.offered as id (id)}
        {@const a = animalById(id)}
        <button class="animal" class:on={animal === id} aria-label={a?.name} aria-pressed={animal === id} onclick={() => choose({ animal: id })}>
          <AnimalIcon animal={id} size="1em" />
        </button>
      {/each}
    </div>
    <div class="elements">
      {#each ELEMENTS as e (e)}
        <button
          class="element el-{e}"
          class:on={element === e}
          style="--el: {ELEMENT_RING[e]}"
          aria-label={ELEMENT_INFO[e].name}
          aria-pressed={element === e}
          onclick={() => choose({ element: e })}><img class="el-art" src={elementArt(e)} alt="" draggable="false" /></button
        >
      {/each}
    </div>
    {#if surpriseIn !== null}<p class="hurry">Everyone else is ready: picking for you in {surpriseIn}s</p>{/if}
  </section>
{/if}

<style>
  .picker {
    display: grid;
    gap: 12px;
    text-align: center;
  }
  h3 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.05rem;
    color: var(--ink-dim);
  }
  .animals {
    display: grid;
    grid-template-columns: repeat(2, 120px);
    justify-content: center;
    gap: 14px;
  }
  .animal {
    height: 120px;
    padding: 0;
    border-radius: 22px;
    font-size: 64px;
    line-height: 1;
    background: var(--panel);
    transition:
      transform calc(160ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1),
      box-shadow calc(160ms * var(--speed));
  }
  .el-art {
    width: 30px;
    height: 30px;
    pointer-events: none;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
  }
  .elements {
    display: grid;
    grid-template-columns: repeat(4, 64px);
    justify-content: center;
    gap: 10px;
  }
  /* Each element in its primary colour. */
  .element {
    height: 64px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    font-size: 28px;
    background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--el) 70%, #fff 0%), color-mix(in srgb, var(--el) 55%, #000));
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.3);
    opacity: 0.8;
    transition:
      transform calc(160ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1),
      box-shadow calc(160ms * var(--speed)),
      opacity calc(160ms * var(--speed));
  }
  .on {
    opacity: 1;
    transform: translateY(-3px) scale(1.06);
    box-shadow:
      0 0 0 3px var(--accent),
      0 8px 20px var(--accent-glow);
  }
  .element.on {
    box-shadow:
      0 0 0 3px var(--accent),
      0 0 22px var(--el);
  }
  .hurry {
    margin: 0;
    font-size: 13px;
    color: var(--accent);
  }
</style>
