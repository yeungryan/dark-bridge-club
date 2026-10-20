<script lang="ts">
  import type { CompletedTrick, PlayedCard } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { spotOf } from '../lib/format';
  import { director } from '../lib/juice/director.svelte';
  import { settings } from '../lib/juice/settings.svelte';
  import { TIMING } from '../lib/juice/timing';
  import Card from './Card.svelte';

  // Spec S13/S16: cards fly in from their player's side and land with a small squash.
  // A finished trick holds so everyone sees all four cards, the winner pulses, then the
  // cards sweep toward the winner. The settling (clinching) trick stays put for the payoff.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  // The area shrinks to fit between the side badges; cards scale with it so they never overlap them.
  let size = $state(180);
  const cardWidth = $derived(Math.max(34, Math.min(52, Math.floor(size * 0.29))));

  let held = $state<CompletedTrick | null>(null);
  let sweeping = $state(false);
  let lastSeen = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];

  $effect(() => {
    const count = deal.tricksPlayed;
    const settled = deal.phase === 'awaitingPlayOn' || deal.phase === 'complete';
    if (count > lastSeen && deal.lastTrick) {
      timers.forEach(clearTimeout);
      timers = [];
      held = deal.lastTrick;
      sweeping = false;
      // The trick that settles the deal stays on the table for the clinch moment.
      if (!settled) {
        const hold = settings.animated ? settings.ms(TIMING.trickHold) : 900;
        const sweep = settings.motion ? settings.ms(TIMING.sweep) : 0;
        timers.push(setTimeout(() => (sweeping = true), hold));
        timers.push(setTimeout(() => ((held = null), (sweeping = false)), hold + sweep));
      }
    }
    if (count === 0) held = null;
    lastSeen = count;
  });

  const live = $derived(deal.currentTrick !== null && deal.currentTrick.cards.length > 0);
  const showing = $derived<readonly PlayedCard[]>(live ? deal.currentTrick!.cards : (held?.cards ?? []));
  const winner = $derived(live ? null : (held?.winner ?? null));
  const winnerSpot = $derived(winner === null ? null : spotOf(winner, view.mySeat!));
  const motion = $derived(settings.motion ? 'move' : settings.animated ? 'fade' : 'none');

  // Both sides one trick away: the next trick decides the deal.
  const decider = $derived(
    deal.phase === 'play' &&
      !deal.clinch &&
      deal.declarerTarget !== null &&
      deal.declarerTarget - deal.tricksWon.declarers === 1 &&
      deal.defenderTarget! - deal.tricksWon.defenders === 1,
  );
</script>

<div class="area" bind:clientWidth={size} style="transform: translate({director.shakeX}px, {director.shakeY}px)">
  {#each showing as play (play.seat + ':' + play.card.suit + play.card.rank)}
    {@const spot = spotOf(play.seat, view.mySeat!)}
    <div class="spot {spot}" data-seat={play.seat}>
      <div class="fly {motion} from-{spot}" class:sweep={sweeping} style="--to: {winnerSpot ?? 'none'}" data-to={winnerSpot}>
        <div class:win={winner === play.seat && motion === 'move'}>
          <Card card={play.card} width={cardWidth} highlight={winner === play.seat} />
        </div>
      </div>
    </div>
  {/each}
  {#if decider}<span class="decider" role="status">Decider</span>{/if}
</div>

<style>
  .area {
    position: relative;
    width: 100%;
    max-width: 190px;
    aspect-ratio: 1 / 1;
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

  /* Arrival: fly in from the player's side, land with a squash. */
  .fly.move {
    animation: land calc(220ms * var(--speed)) cubic-bezier(0.2, 0.8, 0.3, 1) backwards;
  }
  .fly.fade {
    animation: fade-in calc(160ms * var(--speed)) ease-out backwards;
  }
  .from-bottom {
    --dx: 0px;
    --dy: 90px;
  }
  .from-top {
    --dx: 0px;
    --dy: -90px;
  }
  .from-left {
    --dx: -90px;
    --dy: 0px;
  }
  .from-right {
    --dx: 90px;
    --dy: 0px;
  }
  @keyframes land {
    0% {
      transform: translate(var(--dx), var(--dy)) scale(0.9) rotate(-4deg);
      opacity: 0.4;
    }
    78% {
      transform: translate(0, 0) scale(1.04, 0.94);
      opacity: 1;
    }
    100% {
      transform: none;
    }
  }

  /* The winning card pulses. */
  .win {
    animation: pulse calc(320ms * var(--speed)) ease-out;
  }
  @keyframes pulse {
    40% {
      transform: scale(1.13);
    }
  }

  /* Then the whole trick sweeps toward the winner and fades. */
  .fly.sweep {
    transition:
      transform calc(280ms * var(--speed)) ease-in,
      opacity calc(280ms * var(--speed)) ease-in;
    opacity: 0;
  }
  .fly.move.sweep[data-to='bottom'] {
    transform: translateY(80px) scale(0.85);
  }
  .fly.move.sweep[data-to='top'] {
    transform: translateY(-80px) scale(0.85);
  }
  .fly.move.sweep[data-to='left'] {
    transform: translateX(-80px) scale(0.85);
  }
  .fly.move.sweep[data-to='right'] {
    transform: translateX(80px) scale(0.85);
  }

  .decider {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent);
    animation: breathe calc(1600ms * var(--speed)) ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes breathe {
    50% {
      opacity: 0.45;
    }
  }
</style>
