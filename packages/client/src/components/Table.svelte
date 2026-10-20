<script lang="ts">
  import { next, partner, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { callLabel, nameAtSeat, profileOf, seatAt } from '../lib/format';
  import AuctionStrip from './AuctionStrip.svelte';
  import BiddingBox from './BiddingBox.svelte';
  import Card from './Card.svelte';
  import Hand from './Hand.svelte';
  import Prompts from './Prompts.svelte';
  import RaceMeters from './RaceMeters.svelte';
  import Reveal from './Reveal.svelte';
  import SeatBadge from './SeatBadge.svelte';
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
  let peek = $state(false);
  let showAuction = $state(false);

  const canConcede = $derived(deal.phase === 'play' && !deal.clinch && !deal.concession && !deal.playingOn);
  const myRole = $derived(contract ? (me === contract.declarer ? 'Declarer' : me === partner(contract.declarer) ? 'Declarer’s partner' : 'Defender') : '');
  const turnText = $derived.by(() => {
    if (deal.turn === null) return '';
    if (deal.turn === me) return deal.phase === 'auction' ? 'Your call' : 'Your turn to play';
    return `${nameAtSeat(view, profiles, deal.turn)} to ${deal.phase === 'auction' ? 'call' : 'play'}`;
  });
</script>

<div class="table">
  <header>
    <button class="ghost menu" aria-label="Menu" onclick={() => (menuOpen = !menuOpen)}>☰</button>
    <div class="info">
      {#if contract}
        <button class="ghost contract" onclick={() => (showAuction = !showAuction)}>
          {callLabel({ type: 'bid', level: contract.level, strain: contract.strain })} by {nameAtSeat(view, profiles, contract.declarer)}
        </button>
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
      <button class="ghost" onclick={() => (menuOpen = false)}>Close</button>
    </div>
  {/if}

  {#if view.phase === 'betweenDeals' && deal.result}
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
          {#if deal.lastTrick}
            <button class="ghost peek" onclick={() => (peek = !peek)}>{peek ? 'Hide last trick' : 'Last trick'}</button>
          {/if}
        {/if}
      </div>
      <div class="right"><SeatBadge {conn} seat={seatAt('right', me)} /></div>
    </section>
  {/if}

  {#if peek && deal.lastTrick}
    <div class="peek-sheet panel" role="dialog" aria-label="Last trick">
      {#each deal.lastTrick.cards as play (play.seat)}
        <div class="peek-card">
          <Card card={play.card} width={46} highlight={play.seat === deal.lastTrick.winner} />
          <small style="color: {profileOf(profiles, view.seating?.[play.seat]).color}">{nameAtSeat(view, profiles, play.seat)}</small>
        </div>
      {/each}
    </div>
  {/if}

  <section class="bottom">
    <Prompts {conn} />
    {#if showAuction && deal.phase !== 'auction'}
      <AuctionStrip {conn} />
    {/if}
    <p class="turn" class:mine={deal.turn === me} style="--c: {profileOf(profiles, view.me).color}">
      <span class="me">{profileOf(profiles, view.me).name}{#if deal.dealer === me} <span class="chip">D</span>{/if}{#if myRole}{' · '}{myRole}{/if}</span>
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
    min-height: 0;
    border: 0;
    padding: 2px 0;
    font-weight: 700;
    font-size: 1.05rem;
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
    grid-template-columns: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
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
  }
  .peek-sheet {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin: 6px auto;
  }
  .peek-card {
    display: grid;
    justify-items: center;
    gap: 2px;
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
