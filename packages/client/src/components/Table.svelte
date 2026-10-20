<script lang="ts">
  import { next, partner, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { callLabel, nameAtSeat, profileOf, seatAt } from '../lib/format';
  import AuctionStrip from './AuctionStrip.svelte';
  import BiddingBox from './BiddingBox.svelte';
  import Card from './Card.svelte';
  import CallText from './CallText.svelte';
  import Hand from './Hand.svelte';
  import LastTrickPeek from './LastTrickPeek.svelte';
  import Prompts from './Prompts.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import Reveal from './Reveal.svelte';
  import SeatBadge from './SeatBadge.svelte';
  import MenuSheet from './MenuSheet.svelte';
  import { avatarOf, emojiOf } from '../lib/avatars';
  import { director } from '../lib/juice/director.svelte';
  import { settings } from '../lib/juice/settings.svelte';
  import { TIMING } from '../lib/juice/timing';
  import TrickArea from './TrickArea.svelte';

  // Spec S10: you at the bottom, partner on top, the next player (counter-clockwise) on your right.
  // The top-right corner is kept clear for Messenger's floating video.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  const profiles = $derived(conn.room!.profiles);
  const me = $derived(view.mySeat!);
  const contract = $derived(deal.contract);
  const myTurnToCall = $derived(deal.phase === 'auction' && deal.turn === me && !conn.room!.paused);
  const pairOf = (seat: Seat) => `${nameAtSeat(view, profiles, seat)} & ${nameAtSeat(view, profiles, partner(seat))}`;

  let menuOpen = $state(false);

  // The pairs for the night are announced as the first deal starts; it doesn't block bidding.
  let showPairs = $state(false);
  let announced = false;
  $effect(() => {
    if (!announced && view.dealNumber === 1 && deal.phase === 'auction' && deal.calls.length === 0 && settings.animated) {
      announced = true;
      showPairs = true;
      setTimeout(() => (showPairs = false), settings.ms(TIMING.ceremony.pairSnap));
    }
  });
  let peek = $state(false);
  let showAuction = $state(false);

  // Both sides one trick away: the table lights dim for the decider (S13, intensity 4).
  const decider = $derived(
    deal.phase === 'play' &&
      !deal.clinch &&
      contract !== null &&
      deal.declarerTarget! - deal.tricksWon.declarers === 1 &&
      deal.defenderTarget! - deal.tricksWon.defenders === 1,
  );
  const canConcede = $derived(deal.phase === 'play' && !deal.clinch && !deal.concession && !deal.playingOn);
  const myRole = $derived(contract ? (me === contract.declarer ? 'Declarer' : me === partner(contract.declarer) ? 'Partner' : 'Defender') : '');
  const turnText = $derived.by(() => {
    if (deal.turn === null) return '';
    if (deal.turn === me) return deal.phase === 'auction' ? 'Your call' : 'Your turn to play';
    return `${nameAtSeat(view, profiles, deal.turn)} to ${deal.phase === 'auction' ? 'call' : 'play'}`;
  });
</script>

<div class="table" class:decider data-turn={deal.turn === me ? (deal.phase === 'auction' ? 'my-call' : deal.phase === 'play' ? 'my-play' : '') : ''}>
  <header>
    <button class="ghost menu" aria-label="Menu" onclick={() => (menuOpen = !menuOpen)}>☰</button>
    <h1 class="game">Game {view.dealNumber}</h1>
    <span aria-hidden="true"></span>
  </header>

  {#if menuOpen}
    <MenuSheet {conn} {canConcede} onClose={() => (menuOpen = false)} />
  {/if}
  {#if showPairs}
    <div class="pairs" aria-live="polite">
      {#each ['A', 'B'] as const as pair, i (pair)}
        {#if i === 1}<span class="vs">vs</span>{/if}
        <div class="pair">
          {#each view.pairs![pair] as id, j (id)}
            {@const p = profileOf(profiles, id)}
            {#if j === 1}<span class="amp">&</span>{/if}
            <span class="pname {j === 0 ? 'from-left' : 'from-right'}">{emojiOf(avatarOf(conn, id))} {p.name}</span>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  {#if view.phase === 'betweenDeals' && deal.result && !director.revealHold}
    <section class="reveal-area"><Reveal {conn} /></section>
  {:else}
    <section class="middle">
      <!-- All four seats sit the same distance from the table in the middle (Ryan's rule). -->
      <div class="cluster">
        <div class="seat-top"><SeatBadge {conn} seat={seatAt('top', me)} /></div>
        <div class="seat-left"><SeatBadge {conn} seat={seatAt('left', me)} /></div>
        <!-- The same square table while bidding and playing, so nobody's seat moves. -->
        <div class="center">
          <!-- The table itself, in tonight's theme (felt and wood, an infinity pool, neon...). -->
          <div class="surface" aria-hidden="true"></div>
          {#if deal.phase === 'auction'}
            <div class="auction"><AuctionStrip {conn} /></div>
          {:else}
            <TrickArea {conn} />
          {/if}
        </div>
        <div class="seat-right"><SeatBadge {conn} seat={seatAt('right', me)} /></div>
        <div class="seat-me"><SeatBadge {conn} seat={me} /></div>
      </div>
    </section>
  {/if}

  {#if peek && deal.lastTrick}
    {#key deal.tricksPlayed}
      <LastTrickPeek trick={deal.lastTrick} {view} {profiles} onClose={() => (peek = false)} />
    {/key}
  {/if}

  <section class="bottom">
    <Prompts {conn} />
    {#if showAuction && deal.phase !== 'auction'}
      <AuctionStrip {conn} />
    {/if}
    <!-- The contract and the race, where "X to play" used to be: the header stays clear for the theme. -->
    <Scoreboard {conn} onPeek={() => (peek = !peek)} onAuction={() => (showAuction = !showAuction)} />
    <!-- Whose turn is shown on the seats themselves (S10); this line is for screen readers. -->
    {#if view.phase === 'inDeal' && turnText}<p class="sr-only" aria-live="polite">{turnText}</p>{/if}
    {#if myTurnToCall}<BiddingBox {conn} />{/if}
    {#if view.phase === 'inDeal'}<Hand {conn} />{/if}
  </section>
</div>

<style>
  .table {
    display: grid;
    grid-template-rows: auto 1fr auto;
    grid-template-columns: minmax(0, 1fr);
    height: 100dvh;
    max-width: 720px;
    margin: 0 auto;
    padding: 6px 16px max(8px, env(safe-area-inset-bottom));
    overflow: hidden;
  }
  /* Just the menu button: the rest of the top belongs to the theme's scene (and, top-right,
     to Messenger's floating video, S10). */
  header {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    min-height: 48px;
  }
  .game {
    margin: 0;
    text-align: center;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--ink);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
  }
  .menu {
    font-size: 1.3rem;
    padding: 0 12px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  /* The decider: everything but the trick area dims a little. */
  .table {
    transition: background-color calc(500ms * var(--speed));
  }
  .table.decider {
    background: radial-gradient(circle at 50% 42%, transparent 0 22%, rgba(0, 0, 0, 0.38) 60%);
  }
  .pairs {
    position: absolute;
    top: 30%;
    left: 16px;
    right: 16px;
    display: grid;
    gap: 6px;
    justify-items: center;
    padding: 16px;
    border-radius: var(--radius);
    background: var(--sheet);
    border: 1px solid var(--line);
    z-index: 19;
    pointer-events: none;
    animation: fade-in calc(200ms * var(--speed)) backwards;
  }
  .pair {
    font-family: var(--font-name);
    font-size: 1.4rem;
    font-weight: 750;
    display: flex;
    gap: 8px;
  }
  .vs,
  .amp {
    color: var(--ink-dim);
    font-weight: 400;
  }
  .pname.from-left {
    animation: snap-left calc(500ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1) backwards;
  }
  .pname.from-right {
    animation: snap-right calc(500ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1) backwards;
  }
  @keyframes snap-left {
    0% {
      transform: translateX(-60px);
      opacity: 0;
    }
  }
  @keyframes snap-right {
    0% {
      transform: translateX(60px);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .pname {
    animation-name: fade-in !important;
  }
  /* Anchored to the top, not centred: the seats stay exactly where they are when the bidding
     box opens or closes below. */
  .middle {
    display: grid;
    align-content: start;
    min-height: 0;
    padding-top: 2px;
  }
  /* A 3×3 grid around the table: one gap everywhere, so every seat is equally far from it. */
  .cluster {
    display: grid;
    /* The table shrinks on short phones so everything still fits with the bidding box open. */
    grid-template-columns: auto min(176px, calc(100vw - 236px), max(112px, calc(100dvh - 604px))) auto;
    grid-template-areas:
      '. top .'
      'left center right'
      '. me .';
    /* Clear of the table's rim, the same on all four sides. */
    gap: 16px;
    justify-content: center;
    align-items: center;
  }
  .reveal-area {
    min-height: 0;
    overflow-y: auto;
    padding-top: 4px;
  }
  .seat-top {
    grid-area: top;
    justify-self: center;
    align-self: end;
  }
  .seat-left {
    grid-area: left;
    justify-self: end;
  }
  .seat-right {
    grid-area: right;
    justify-self: start;
  }
  .seat-me {
    grid-area: me;
    justify-self: center;
    align-self: start;
  }
  .center {
    grid-area: center;
    position: relative;
    display: grid;
    justify-items: center;
    align-items: center;
    min-width: 0;
    aspect-ratio: 1 / 1;
  }
  .auction {
    position: relative;
    padding: 10px;
    max-height: 100%;
    overflow-y: auto;
  }
  .surface {
    position: absolute;
    inset: 0;
    border-radius: var(--surface-radius, 50%);
    background: var(--surface, rgba(0, 0, 0, 0.15));
    box-shadow: var(--surface-rim, none);
    pointer-events: none;
  }
  .bottom {
    display: grid;
    gap: 6px;
    justify-items: stretch;
  }
</style>
