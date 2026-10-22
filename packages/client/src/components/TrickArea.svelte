<script lang="ts">
  import { trumpSuit, winningPlay, type CompletedTrick, type PlayedCard, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { spotOf } from '../lib/format';
  import { director } from '../lib/juice/director.svelte';
  import { launch } from '../lib/juice/launch.svelte';
  import { settings } from '../lib/juice/settings.svelte';
  import { TIMING } from '../lib/juice/timing';
  import Card from './Card.svelte';
  import Suit from './Suit.svelte';

  // Spec S13/S16: each card flies in from where it came from (your finger, or the player's
  // name) and lands with a squash. The card currently winning the trick wears a gold ring.
  // A finished trick holds so everyone sees all four cards, the winner pulses, then the cards
  // sweep into the winner's name. The director (lib/juice) times each beat; this draws them.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  const me = $derived(view.mySeat!);
  // The area shrinks to fit between the side badges; cards scale with it so they never overlap them.
  let size = $state(180);
  const cardWidth = $derived(Math.max(34, Math.min(52, Math.floor(size * 0.29))));

  let held = $state<CompletedTrick | null>(null);
  let lastSeen = 0;
  $effect(() => {
    const count = deal.tricksPlayed;
    if (count > lastSeen && deal.lastTrick) held = deal.lastTrick;
    if (count === 0) held = null;
    lastSeen = count;
  });

  const fx = $derived(director.trickFx?.trick === deal.tricksPlayed ? director.trickFx : null);
  const live = $derived(deal.currentTrick !== null && deal.currentTrick.cards.length > 0);
  const showing = $derived<readonly PlayedCard[]>(live ? deal.currentTrick!.cards : held && fx?.phase !== 'done' ? held.cards : []);
  const trump = $derived(deal.contract ? trumpSuit(deal.contract.strain) : null);
  // Who is winning the trick so far (anyone could work it out, so show it).
  const leading = $derived(live && showing.length > 1 ? winningPlay(showing, trump).seat : null);
  const winner = $derived(live ? null : (held?.winner ?? null));
  const celebrating = $derived(winner !== null && fx !== null && fx.phase !== 'landing');
  const sweepingTo = $derived(!live && fx?.phase === 'sweep' ? winner : null);
  const motion = $derived(settings.motion ? 'move' : settings.animated ? 'fade' : 'none');

  // Both sides one trick away: the next trick decides the deal.
  const decider = $derived(
    deal.phase === 'play' &&
      !deal.clinch &&
      deal.declarerTarget !== null &&
      deal.declarerTarget - deal.tricksWon.declarers === 1 &&
      deal.defenderTarget! - deal.tricksWon.defenders === 1,
  );

  const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  /** The card lands this far through its animation: exactly at TIMING.cardFly, when its sound plays. */
  const LAND_AT = 0.62;
  /** The page's wobble spring (lib/juice/spring.ts), or a plain overshoot where unsupported. */
  const wobble = () => getComputedStyle(document.documentElement).getPropertyValue('--spring-wobble').trim() || 'cubic-bezier(0.3, 1.6, 0.6, 1)';

  /** Fly in from your finger (your card) or from the player's name (everyone else's). */
  function arrive(node: HTMLElement, play: PlayedCard) {
    if (!settings.motion) return;
    const from = (play.seat === me ? launch.take(play.card) : null) ?? null;
    const badge = document.querySelector(`[data-badge-seat="${play.seat}"]`)?.getBoundingClientRect() ?? null;
    const origin = from ?? badge;
    if (!origin) return;
    const r = node.getBoundingClientRect();
    const a = center(origin);
    const b = center(r);
    const scale = from ? from.width / r.width : 0.55;
    const spin = play.seat === me ? 0 : (play.seat % 2 ? 1 : -1) * 10;
    node.animate(
      [
        { transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${scale}) rotate(${spin}deg)`, opacity: from ? 1 : 0.2 },
        // Lands with a squash, then springs back to shape with a wobble.
        { transform: 'translate(0, 0) scale(1.12, 0.86)', opacity: 1, offset: LAND_AT, easing: wobble() },
        { transform: 'none', opacity: 1 },
      ],
      { duration: settings.ms(Math.round(TIMING.cardFly / LAND_AT)), easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'backwards' },
    );
  }

  /** The finished trick slides into the winner's name and fades. */
  function sweep(node: HTMLElement, target: Seat | null) {
    const go = (to: Seat | null) => {
      if (to === null || !settings.animated) return;
      const badge = document.querySelector(`[data-badge-seat="${to}"]`)?.getBoundingClientRect();
      const r = node.getBoundingClientRect();
      const end =
        settings.motion && badge
          ? { transform: `translate(${center(badge).x - center(r).x}px, ${center(badge).y - center(r).y}px) scale(0.45)`, opacity: 0 }
          : { opacity: 0 };
      node.animate([{ transform: 'none', opacity: 1 }, end], {
        duration: settings.ms(TIMING.sweep),
        easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)',
        fill: 'forwards',
      });
    };
    go(target);
    return { update: go };
  }
</script>

<div class="area" class:armed={launch.armed} class:frozen={director.frozen} bind:clientWidth={size} style="transform: translate({director.shakeX}px, {director.shakeY}px)">
  {#if director.flash}
    {#key director.flash.id}
      <span class="flash" class:big={director.flash.big} aria-hidden="true"><Suit suit={director.flash.suit} label={false} /></span>
    {/key}
  {/if}
  {#each showing as play, i (play.seat + ':' + play.card.suit + play.card.rank)}
    {@const spot = spotOf(play.seat, me)}
    <div class="spot {spot}" data-seat={play.seat}>
      <div class="fly {motion}" use:arrive={play} use:sweep={sweepingTo}>
        <div
          class="face"
          class:leading={leading === play.seat}
          class:beaten={leading !== null && leading !== play.seat}
          class:win={celebrating && winner === play.seat}
          class:trumpwin={celebrating && winner === play.seat && fx?.kind !== 'normal'}
        >
          <Card card={play.card} width={cardWidth} highlight={leading === play.seat || (celebrating && winner === play.seat)} trump={play.card.suit === trump} />
          <!-- The card that led the set: the "1st" fold (Ryan: every first gets the same mark). -->
          {#if i === 0}<span class="first-fold" role="img" aria-label="led"></span>{/if}
        </div>
      </div>
    </div>
  {/each}
  {#if director.banner}
    {#key director.banner.id}
      <span class="banner" role="status">{director.banner.text}</span>
    {/key}
  {/if}
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
  /* Your dragged card would play if you let go now. */
  .area::before {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px dashed transparent;
    transition:
      border-color calc(150ms * var(--speed)),
      box-shadow calc(150ms * var(--speed));
    pointer-events: none;
  }
  .area.armed::before {
    border-color: var(--accent);
    box-shadow: inset 0 0 30px var(--accent-glow), 0 0 18px var(--accent-glow);
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
  .fly.fade {
    animation: fade-in calc(160ms * var(--speed)) ease-out backwards;
  }
  .face {
    position: relative;
    border-radius: 6px;
    transition: filter calc(200ms * var(--speed));
  }
  /* The hit-stop's freeze-frame: the table holds, overexposed, for a beat (lib/juice/director). */
  .area.frozen {
    filter: brightness(1.35) saturate(1.25) contrast(1.05);
  }
  .area.frozen :global(*) {
    animation-play-state: paused !important;
  }
  /* A card that is beaten so far sinks back a little; the leader pops when it takes the lead. */
  .face.beaten {
    filter: brightness(0.78);
  }
  :global(.fx-full) .face.leading {
    animation: take-lead calc(300ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
    animation-duration: calc(var(--spring-pop-ms, 320ms) * var(--speed));
    animation-timing-function: var(--spring-pop, cubic-bezier(0.3, 1.6, 0.6, 1));
  }
  /* Springs: jump to the peak, then settle back with an overshoot (lib/juice/spring.ts). */
  @keyframes take-lead {
    from {
      transform: scale(1.2) rotate(-2deg);
    }
  }
  /* The trick's winner. */
  :global(.fx-full) .face.win {
    animation: win calc(420ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
    animation-duration: calc(var(--spring-wobble-ms, 320ms) * var(--speed));
    animation-timing-function: var(--spring-wobble, cubic-bezier(0.3, 1.6, 0.6, 1));
  }
  @keyframes win {
    from {
      transform: scale(1.4) rotate(-6deg);
    }
  }
  .face.win {
    box-shadow: 0 0 16px 2px var(--win-glow);
  }
  .face.trumpwin {
    box-shadow: 0 0 20px 4px rgba(197, 139, 255, 0.85);
  }

  /* A trump's suit flashes behind the trick. */
  .flash {
    position: absolute;
    left: 50%;
    top: 50%;
    font-size: 110px;
    line-height: 1;
    color: var(--trump);
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, -50%);
    animation: suit-flash calc(650ms * var(--speed)) ease-out;
  }
  .flash.big {
    font-size: 150px;
    animation-duration: calc(900ms * var(--speed));
  }
  @keyframes suit-flash {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.4);
    }
    25% {
      opacity: 0.45;
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(1.4);
    }
  }
  :global(.fx-reduced) .flash {
    animation-name: fade-out-soft;
  }
  @keyframes fade-out-soft {
    20% {
      opacity: 0.35;
    }
  }

  /* "First trump!" stamped across the table. */
  .banner {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 5;
    white-space: nowrap;
    padding: 6px 14px;
    border-radius: 10px;
    background: #2a1640;
    border: 2px solid #c58bff;
    color: #f2e6ff;
    font-weight: 800;
    font-size: 1.15rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    pointer-events: none;
    transform: translate(-50%, -50%) rotate(-6deg);
    opacity: 0;
    animation: banner calc(1300ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1);
  }
  @keyframes banner {
    0% {
      transform: translate(-50%, -50%) rotate(-6deg) scale(2.2);
      opacity: 0;
    }
    18% {
      transform: translate(-50%, -50%) rotate(-6deg) scale(1);
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) rotate(-6deg) scale(1);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .banner {
    animation-name: fade-in-out;
  }
  @keyframes fade-in-out {
    0%,
    100% {
      opacity: 0;
    }
    20%,
    80% {
      opacity: 1;
    }
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
