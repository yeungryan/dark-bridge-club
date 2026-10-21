<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';

  // The deck in the middle of the table while the dealer shuffles (Ryan: nothing is dealt until
  // they tap Deal). It riffles every 1.6 s; only the dealer's phone plays the riffle sound, like a
  // real table (and four phones riffling on one call would echo).
  let { riffleSound = false }: { riffleSound?: boolean } = $props();

  let beat = $state(0);
  onMount(() => {
    const go = () => {
      beat++;
      if (riffleSound) sound.riffle();
    };
    const first = setTimeout(go, 400);
    const every = setInterval(go, settings.ms(1600));
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  });
</script>

<div class="deck" aria-label="The deck is being shuffled">
  {#key beat}
    <div class="half left" class:riffle={beat > 0}>
      {#each [0, 1, 2] as i (i)}<span style="--i: {i}"></span>{/each}
    </div>
    <div class="half right" class:riffle={beat > 0}>
      {#each [0, 1, 2] as i (i)}<span style="--i: {i}"></span>{/each}
    </div>
  {/key}
</div>

<style>
  .deck {
    position: relative;
    width: 44px;
    height: 62px;
  }
  .half {
    position: absolute;
    inset: 0;
  }
  .half span {
    position: absolute;
    inset: 0;
    border-radius: 5px;
    background: var(--card-back);
    box-shadow:
      0 0 0 1.5px var(--card),
      0 2px 5px rgba(0, 0, 0, 0.45);
    transform: translate(calc(var(--i) * -1px), calc(var(--i) * -1.5px));
  }
  /* A riffle: the deck splits into two halves that lift apart, then fall back together. */
  :global(.fx-full) .half.left.riffle {
    animation: split-left calc(700ms * var(--speed)) ease-in-out;
  }
  :global(.fx-full) .half.right.riffle {
    animation: split-right calc(700ms * var(--speed)) ease-in-out;
  }
  @keyframes split-left {
    30%,
    55% {
      transform: translate(-22px, -6px) rotate(-14deg);
    }
  }
  @keyframes split-right {
    30%,
    55% {
      transform: translate(22px, -6px) rotate(14deg);
    }
  }
  :global(.fx-reduced) .half.riffle {
    animation: fade-in calc(300ms * var(--speed));
  }
</style>
