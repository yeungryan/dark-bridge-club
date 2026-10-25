<script lang="ts">
  import type { CompletedTrick, TableView } from '@dark/engine';
  import type { ProfileInfo } from '@dark/engine';
  import { onMount } from 'svelte';
  import { nameAtSeat } from '../lib/format';
  import { buzz } from '../lib/juice/haptics';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import { TIMING } from '../lib/juice/timing';
  import Card from './Card.svelte';

  // Spec S13 / R8: peeking at the last trick is like turning over the quitted trick at a real
  // table: the four cards flip up one by one in play order, then the winner lights up.
  // Tap anywhere on its sheet (Table) to turn them back down.
  // `trump`: the trump suit, so trumps here wear the same purple bar as in the hand and on the
  // table (round 15).
  let {
    trick,
    view,
    profiles,
    trump = null,
  }: { trick: CompletedTrick; view: TableView; profiles: readonly ProfileInfo[]; trump?: string | null } = $props();

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

<div class="peek-sheet">
  {#each trick.cards as play, i (play.seat)}
    <div class="peek-card" in:flip={{ delay: i * (TIMING.peekGap + TIMING.peekFlip / 2) }} out:flip={{ delay: 0 }}>
      <div class="face" class:winner={lit && play.seat === trick.winner}>
        <Card card={play.card} width={32} highlight={lit && play.seat === trick.winner} trump={play.card.suit === trump} />
        <!-- The card that led the set: the same "1st" fold as on the table (round 15). -->
        {#if i === 0}<span class="first-fold" role="img" aria-label="led"></span>{/if}
      </div>
      <small class="who">{nameAtSeat(view, profiles, play.seat)}</small>
    </div>
  {/each}
</div>

<style>
  /* It sits in the auction's floating sheet (Table), so it has no panel of its own. */
  /* As tall as a one-row auction (Ryan, round 15), so each name sits beside its card. */
  .peek-sheet {
    display: flex;
    justify-content: center;
    gap: 10px;
  }
  .peek-card {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .face {
    position: relative;
  }
  .who {
    font-size: 12.5px;
    font-family: var(--font-name);
    color: var(--ink);
  }
  .winner {
    border-radius: 6px;
    box-shadow: 0 0 14px 2px var(--accent-glow);
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
