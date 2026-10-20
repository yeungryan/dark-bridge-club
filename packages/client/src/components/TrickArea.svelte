<script lang="ts">
  import type { CompletedTrick, PlayedCard } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { spotOf } from '../lib/format';
  import Card from './Card.svelte';

  // Spec S13: cards land on the side facing their player. A finished trick stays
  // visible briefly with the winner highlighted, so everyone sees all four cards.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  let held = $state<CompletedTrick | null>(null);
  let lastSeen = 0;

  $effect(() => {
    const count = deal.tricksPlayed;
    if (count > lastSeen && deal.lastTrick) {
      held = deal.lastTrick;
      const thisTrick = deal.lastTrick;
      setTimeout(() => {
        if (held === thisTrick) held = null;
      }, 1300);
    }
    lastSeen = count;
  });

  const showing = $derived<readonly PlayedCard[]>(
    deal.currentTrick && deal.currentTrick.cards.length > 0 ? deal.currentTrick.cards : (held?.cards ?? []),
  );
  const winner = $derived(deal.currentTrick && deal.currentTrick.cards.length > 0 ? null : (held?.winner ?? null));
</script>

<div class="area">
  {#each showing as play (play.seat)}
    <div class="spot {spotOf(play.seat, view.mySeat!)}">
      <Card card={play.card} width={46} highlight={winner === play.seat} />
    </div>
  {/each}
</div>

<style>
  .area {
    position: relative;
    width: min(180px, 46vw);
    height: min(180px, 46vw);
    margin: 0 auto;
  }
  .spot {
    position: absolute;
  }
  .bottom {
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
  }
  .top {
    left: 50%;
    top: 0;
    transform: translateX(-50%);
  }
  .left {
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .right {
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }
</style>
