<script lang="ts">
  import type { CompletedTrick, TableView } from '@dark/engine';
  import type { ProfileInfo } from '@dark/engine';
  import { onMount } from 'svelte';
  import { nameAtSeat, profileOf } from '../lib/format';
  import { buzz } from '../lib/juice/haptics';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import { TIMING } from '../lib/juice/timing';
  import Card from './Card.svelte';

  // Spec S13 / R8: peeking at the last trick is like turning over the quitted trick at a real
  // table: the four cards flip up one by one in play order, then the winner lights up.
  // Tap anywhere on it to turn them back down.
  let { trick, view, profiles, onClose }: { trick: CompletedTrick; view: TableView; profiles: readonly ProfileInfo[]; onClose: () => void } =
    $props();

  const flip = (_node: Element, { delay }: { delay: number }) => ({
    delay: settings.animated ? settings.ms(delay) : 0,
    duration: settings.animated ? settings.ms(TIMING.peekFlip) : 0,
    css: (t: number) => `transform: perspective(400px) rotateY(${(1 - t) * 90}deg) translateY(${(1 - t) * 8}px); opacity: ${Math.min(1, t * 3)}`,
  });

  let lit = $state(!settings.animated);
  onMount(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    trick.cards.forEach((_, i) => timers.push(setTimeout(() => sound.flip(), settings.ms(i * (TIMING.peekGap + TIMING.peekFlip / 2)))));
    const total = settings.ms(trick.cards.length * (TIMING.peekGap + TIMING.peekFlip / 2) + TIMING.peekFlip / 2);
    timers.push(
      setTimeout(() => {
        lit = true;
        buzz('tap');
      }, total),
    );
    return () => timers.forEach(clearTimeout);
  });
</script>

<button class="peek-sheet panel" aria-label="Last trick (tap to close)" onclick={onClose}>
  {#each trick.cards as play, i (play.seat)}
    <div class="peek-card" in:flip={{ delay: i * (TIMING.peekGap + TIMING.peekFlip / 2) }} out:flip={{ delay: 0 }}>
      <div class:winner={lit && play.seat === trick.winner}>
        <Card card={play.card} width={46} highlight={lit && play.seat === trick.winner} />
      </div>
      <small style="color: {profileOf(profiles, view.seating?.[play.seat]).color}">{nameAtSeat(view, profiles, play.seat)}</small>
    </div>
  {/each}
</button>

<style>
  .peek-sheet {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin: 6px auto;
    border: 0;
    min-height: 0;
    font: inherit;
    color: inherit;
  }
  .peek-card {
    display: grid;
    justify-items: center;
    gap: 2px;
  }
  .winner {
    border-radius: 6px;
    box-shadow: 0 0 14px 2px rgba(232, 194, 90, 0.7);
  }
  :global(.fx-full) .winner {
    animation: lit calc(300ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  @keyframes lit {
    40% {
      transform: scale(1.15);
    }
  }
</style>
