<script lang="ts">
  import { next, partner, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { callLabel, nameAtSeat, profileOf, seatAt } from '../lib/format';
  import AuctionStrip from './AuctionStrip.svelte';
  import BiddingBox from './BiddingBox.svelte';
  import Card from './Card.svelte';
  import Hand from './Hand.svelte';
  import LastTrickPeek from './LastTrickPeek.svelte';
  import Prompts from './Prompts.svelte';
  import RaceMeters from './RaceMeters.svelte';
  import Reveal from './Reveal.svelte';
  import SeatBadge from './SeatBadge.svelte';
  import SettingsSheet from './SettingsSheet.svelte';
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
  let settingsOpen = $state(false);
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
  const myRole = $derived(contract ? (me === contract.declarer ? 'Declarer' : me === partner(contract.declarer) ? 'Declarer’s partner' : 'Defender') : '');
  const turnText = $derived.by(() => {
    if (deal.turn === null) return '';
    if (deal.turn === me) return deal.phase === 'auction' ? 'Your call' : 'Your turn to play';
    return `${nameAtSeat(view, profiles, deal.turn)} to ${deal.phase === 'auction' ? 'call' : 'play'}`;
  });
</script>

<div class="table" class:decider>
  <header>
    <button class="ghost menu" aria-label="Menu" onclick={() => (menuOpen = !menuOpen)}>☰</button>
    <div class="info">
      {#if contract}
        {#key director.contractPulse}
          <button class="ghost contract" onclick={() => (showAuction = !showAuction)}>
            {callLabel({ type: 'bid', level: contract.level, strain: contract.strain })} by {nameAtSeat(view, profiles, contract.declarer)}
            {#if director.contractPulse > 0}<span class="sold" aria-hidden="true">Sold!</span>{/if}
          </button>
        {/key}
        <RaceMeters {deal} declarers={pairOf(contract.declarer)} defenders={pairOf(next(contract.declarer))} />
      {:else}
        <span class="muted">Deal {view.dealNumber} · bidding</span>
      {/if}
    </div>
  </header>

  {#if menuOpen}
    <div class="menu-sheet panel">
      <button disabled={!canConcede} onclick={() => { conn.intent({ type: 'deal', action: { type: 'proposeConcession' } }); menuOpen = false; }}>
        Concede the rest of this deal
      </button>
      <button disabled={view.endNightVotes.includes(view.me)} onclick={() => { conn.intent({ type: 'voteEndNight' }); menuOpen = false; }}>
        End the night
      </button>
      <button onclick={() => { settingsOpen = true; menuOpen = false; }}>Settings (effects, speed, sound)</button>
      <button class="ghost" onclick={() => (menuOpen = false)}>Close</button>
    </div>
  {/if}
  {#if showPairs}
    <div class="pairs" aria-live="polite">
      {#each ['A', 'B'] as const as pair, i (pair)}
        {#if i === 1}<span class="vs">vs</span>{/if}
        <div class="pair">
          {#each view.pairs![pair] as id, j (id)}
            {@const p = profileOf(profiles, id)}
            {#if j === 1}<span class="amp">&</span>{/if}
            <span class="pname {j === 0 ? 'from-left' : 'from-right'}" style="color: {p.color}">{p.name}</span>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
  {#if settingsOpen}
    <div class="settings-wrap"><SettingsSheet onClose={() => (settingsOpen = false)} /></div>
  {/if}

  {#if view.phase === 'betweenDeals' && deal.result && !director.revealHold}
    <section class="reveal-area"><Reveal {conn} /></section>
  {:else}
    <section class="middle">
      <div class="top"><SeatBadge {conn} seat={seatAt('top', me)} /></div>
      <div class="left"><SeatBadge {conn} seat={seatAt('left', me)} /></div>
      <div class="center">
        {#if deal.phase === 'auction'}
          <AuctionStrip {conn} />
        {:else}
          <TrickArea {conn} />
          <!-- Always takes its space, so the trick area doesn't jump when the first trick ends. -->
          <button class="ghost peek" class:open={peek} class:none={!deal.lastTrick} disabled={!deal.lastTrick} onclick={() => (peek = !peek)}>
            <span class="stack" aria-hidden="true"><i></i><i></i><i></i></span>{peek ? 'Hide last trick' : 'Last trick'}
          </button>
        {/if}
      </div>
      <div class="right"><SeatBadge {conn} seat={seatAt('right', me)} /></div>
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
    <p class="turn" class:mine={deal.turn === me} style="--c: {profileOf(profiles, view.me).color}">
      <span class="me" data-badge-seat={me}>{profileOf(profiles, view.me).name}{#if deal.dealer === me} <span class="chip">D</span>{/if}{#if myRole}{' · '}{myRole}{/if}</span>
      {#if view.phase === 'inDeal' && turnText}<span>— {turnText}</span>{/if}
    </p>
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
  header {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    /* Keep the top-right ~30% clear for Messenger's floating video (S10). */
    padding-right: 30%;
    min-height: 56px;
  }
  .menu {
    font-size: 1.3rem;
    padding: 0 12px;
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .contract {
    animation: stamp calc(420ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1);
    min-height: 0;
    border: 0;
    padding: 2px 0;
    font-weight: 700;
    font-size: 1.05rem;
  }
  /* "Sold!": the contract slams into the header. */
  @keyframes stamp {
    0% {
      transform: scale(2.2) rotate(-4deg);
      opacity: 0;
    }
    55% {
      transform: scale(0.92);
      opacity: 1;
    }
  }
  .contract {
    position: relative;
  }
  .sold {
    display: inline-block;
    margin-left: 8px;
    padding: 0 6px;
    border-radius: 6px;
    background: var(--accent);
    color: #1b1300;
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
    opacity: 0;
    animation: sold calc(1600ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1);
  }
  @keyframes sold {
    0% {
      transform: scale(2) rotate(-12deg);
      opacity: 0;
    }
    15%,
    75% {
      transform: scale(1) rotate(-6deg);
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  :global(.fx-reduced) .contract {
    animation: fade-in calc(300ms * var(--speed));
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
    background: rgba(8, 20, 14, 0.9);
    border: 1px solid var(--line);
    z-index: 19;
    pointer-events: none;
    animation: fade-in calc(200ms * var(--speed)) backwards;
  }
  .pair {
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
  .settings-wrap {
    position: absolute;
    top: 60px;
    left: 16px;
    right: 16px;
    z-index: 21;
  }
  .menu-sheet {
    position: absolute;
    top: 60px;
    left: 16px;
    display: grid;
    gap: 8px;
    z-index: 20;
    background: #0b1f16;
  }
  .middle {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr) 88px;
    grid-template-rows: auto 1fr;
    grid-template-areas: 'top top top' 'left center right';
    align-items: center;
    gap: 4px;
    min-height: 0;
  }
  .reveal-area {
    min-height: 0;
    overflow-y: auto;
    padding-top: 4px;
  }
  .top {
    grid-area: top;
    justify-self: center;
  }
  .left {
    grid-area: left;
  }
  .right {
    grid-area: right;
  }
  .center {
    grid-area: center;
    display: grid;
    justify-items: center;
    gap: 4px;
  }
  .peek {
    min-height: 32px;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .peek.none {
    visibility: hidden;
  }
  /* A tiny face-down stack: the quitted trick. */
  .stack {
    position: relative;
    width: 14px;
    height: 18px;
  }
  .stack i {
    position: absolute;
    inset: 0;
    border-radius: 2px;
    background: #2f5d8a;
    border: 1px solid #c9d6e3;
  }
  .stack i:nth-child(2) {
    transform: translate(2px, -2px) rotate(6deg);
  }
  .stack i:nth-child(3) {
    transform: translate(4px, -4px) rotate(12deg);
  }
  :global(.fx-full) .peek:active .stack {
    transform: scale(0.85);
  }
  .bottom {
    display: grid;
    gap: 6px;
    justify-items: stretch;
  }
  .turn {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0 6px;
    text-align: center;
    margin: 0;
    color: var(--ink-dim);
    font-size: 15px;
  }
  .turn .me {
    color: var(--c);
    font-weight: 650;
  }
  .turn.mine span:last-child {
    color: var(--accent);
    font-weight: 700;
  }
  .chip {
    font-size: 11px;
    background: var(--ink);
    color: var(--felt);
    border-radius: 50%;
    padding: 1px 5px;
  }
</style>
