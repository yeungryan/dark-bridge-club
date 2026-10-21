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
  import History from './History.svelte';
  import { avatarOf } from '../lib/avatars';
  import { director } from '../lib/juice/director.svelte';
  import { settings } from '../lib/juice/settings.svelte';
  import { TIMING } from '../lib/juice/timing';
  import TrickArea from './TrickArea.svelte';
  import Deck from './Deck.svelte';
  import DealFlight from './DealFlight.svelte';
  import { buzz } from '../lib/juice/haptics';
  import { sound } from '../lib/juice/sound';
  import AnimalIcon from './AnimalIcon.svelte';

  // Spec S10: you at the bottom, partner on top, the next player (counter-clockwise) on your right.
  // The top-right corner is kept clear for Messenger's floating video.
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal);
  const profiles = $derived(conn.room!.profiles);
  const me = $derived(view.mySeat!);
  // The dealer is shuffling: nothing is dealt until they tap Deal (Ryan).
  const shuffling = $derived(view.phase === 'awaitingDeal' || !deal);
  // Only once the next dealer is known: between games `dealer` is still the last one (whose Deal
  // button would otherwise flash up and do nothing).
  const iDeal = $derived(view.phase === 'awaitingDeal' && view.dealer === me);
  const contract = $derived(deal?.contract ?? null);
  // Bid once your cards have landed.
  const myTurnToCall = $derived(deal?.phase === 'auction' && deal.turn === me && !conn.room!.paused && !director.dealing);
  let dealt = $state(false);
  function dealCards() {
    if (dealt) return;
    dealt = true;
    sound.dealButton();
    buzz('sold');
    conn.intent({ type: 'dealCards' });
  }
  $effect(() => {
    if (!shuffling) dealt = false;
  });
  // The hand's space is kept while shuffling, so nothing moves when the cards arrive.
  let handWidth = $state(360);
  const handHeight = $derived(Math.min(76, Math.max(46, Math.floor(handWidth / 6.2))) * 1.4 + 22);
  const pairOf = (seat: Seat) => `${nameAtSeat(view, profiles, seat)} & ${nameAtSeat(view, profiles, partner(seat))}`;

  // The menu, or (from the gear, top-right) straight into Settings.
  let menuOpen = $state<'menu' | 'settings' | null>(null);
  let showHistory = $state(false);

  // The pairs for the night are announced as the first deal starts; it doesn't block bidding.
  let showPairs = $state(false);
  let announced = false;
  $effect(() => {
    if (!announced && view.dealNumber === 1 && deal?.phase === 'auction' && deal.calls.length === 0 && !director.dealing && settings.animated) {
      announced = true;
      showPairs = true;
      setTimeout(() => (showPairs = false), settings.ms(TIMING.ceremony.pairSnap));
    }
  });
  let peek = $state(false);
  let showAuction = $state(false);

  // Both sides one trick away: the table lights dim for the decider (S13, intensity 4).
  const decider = $derived(
    deal?.phase === 'play' &&
      !deal.clinch &&
      contract !== null &&
      deal.declarerTarget! - deal.tricksWon.declarers === 1 &&
      deal.defenderTarget! - deal.tricksWon.defenders === 1,
  );
  const canConcede = $derived(deal?.phase === 'play' && !deal.clinch && !deal.concession && !deal.playingOn);
  const myRole = $derived(contract ? (me === contract.declarer ? 'Declarer' : me === partner(contract.declarer) ? 'Partner' : 'Defender') : '');
  const turnText = $derived.by(() => {
    if (!deal || deal.turn === null) return iDeal ? 'Your deal' : '';
    if (deal.turn === me) return deal.phase === 'auction' ? 'Your call' : 'Your turn to play';
    return `${nameAtSeat(view, profiles, deal.turn)} to ${deal.phase === 'auction' ? 'call' : 'play'}`;
  });
</script>

<div class="table" class:decider data-turn={iDeal ? 'my-deal' : deal?.turn === me ? (deal.phase === 'auction' ? 'my-call' : deal.phase === 'play' ? 'my-play' : '') : ''}>
  <header>
    <button class="ghost menu" aria-label="Menu" onclick={() => (menuOpen = menuOpen ? null : 'menu')}>☰</button>
    <h1 class="game">Game {shuffling ? view.dealNumber + 1 : view.dealNumber}</h1>
    <button class="ghost gear" aria-label="Settings" onclick={() => (menuOpen = menuOpen ? null : 'settings')}>
      <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true"
        ><path
          fill="currentColor"
          d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        /></svg
      >
    </button>
  </header>

  {#if menuOpen}
    <MenuSheet {conn} {canConcede} start={menuOpen} onClose={() => (menuOpen = null)} onHistory={() => (showHistory = true)} />
  {/if}
  {#if showPairs}
    <div class="pairs" aria-live="polite">
      {#each ['A', 'B'] as const as pair, i (pair)}
        {#if i === 1}<span class="vs">vs</span>{/if}
        <div class="pair">
          {#each view.pairs![pair] as id, j (id)}
            {@const p = profileOf(profiles, id)}
            {#if j === 1}<span class="amp">&</span>{/if}
            <span class="pname {j === 0 ? 'from-left' : 'from-right'}"><AnimalIcon animal={avatarOf(conn, id)?.animal} /> {p.name}</span>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  {#if view.phase === 'betweenDeals' && deal?.result && !director.revealHold}
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
          {#if shuffling || !deal || director.dealing}
            <!-- The deck stays put until the last card has flown. -->
            <Deck riffleSound={iDeal && shuffling} />
          {:else if deal.phase === 'auction'}
            <div class="auction"><AuctionStrip {conn} /></div>
            <!-- After a bid, each pass counts it down (Ryan: on the table, where nothing covers it). -->
            {#if director.going > 0}
              {#key director.going}
                <div class="going" role="status">🔨 {director.going === 1 ? 'Going once…' : 'Going twice…'}</div>
              {/key}
            {/if}
          {:else}
            <TrickArea {conn} />
          {/if}
        </div>
        <div class="seat-right"><SeatBadge {conn} seat={seatAt('right', me)} /></div>
        <div class="seat-me"><SeatBadge {conn} seat={me} /></div>
      </div>
    </section>
  {/if}

  {#if showHistory}
    <History profiles={profiles} me={view.me} theme={conn.room!.theme} onClose={() => (showHistory = false)} />
  {/if}
  {#if peek && deal?.lastTrick}
    {#key deal.tricksPlayed}
      <LastTrickPeek trick={deal.lastTrick} {view} {profiles} onClose={() => (peek = false)} />
    {/key}
  {/if}

  <section class="bottom">
    <!-- The contract and the race, where "X to play" used to be: the header stays clear for the theme.
         Its slot is the same height in bidding and play, and the bidding box and the auction
         float up from it over the empty felt, so the table never moves (Ryan). -->
    <div class="board" class:covered={myTurnToCall}>
      {#if shuffling}
        <!-- The dealer deals when they're ready; everyone else waits on them. -->
        <div class="dealing">
          {#if iDeal}
            <button class="primary deal" onclick={dealCards} disabled={dealt}>
              <svg class="shuffle" viewBox="0 0 24 24" aria-hidden="true"
                ><path d="M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6C14.3 16 15.5 17 17.5 17H21M3 17h3.5c2 0 3.2-1 4.3-2.7M13.2 9.7C14.3 8 15.5 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3" /></svg
              >
              Deal
            </button>
          {:else}
            <p class="waiting-deal">{view.dealer !== null ? nameAtSeat(view, profiles, view.dealer) : 'The dealer'} is shuffling…</p>
          {/if}
        </div>
      {:else}
        <Scoreboard {conn} onPeek={() => (peek = !peek)} onAuction={() => (showAuction = !showAuction)} />
      {/if}
      <!-- Decisions that interrupt play ("Play the rest out?", concessions, ending the night) float
           above the scoreboard too: in the flow they pushed the whole table up (Ryan's rule). -->
      <div class="float prompts"><Prompts {conn} /></div>
      {#if myTurnToCall}
        <div class="float"><BiddingBox {conn} /></div>
      {:else if showAuction && deal && deal.phase !== 'auction'}
        <div class="float above"><AuctionStrip {conn} /></div>
      {/if}
    </div>
    <!-- Whose turn is shown on the seats themselves (S10); this line is for screen readers. -->
    {#if view.phase === 'inDeal' && turnText}<p class="sr-only" aria-live="polite">{turnText}</p>{/if}
    <!-- The hand's space is kept while shuffling and through the clinch before the reveal, so the
         table never jumps. -->
    {#if view.phase === 'inDeal' && deal}<Hand {conn} />{:else if shuffling || director.revealHold}<div
        class="hand hand-space"
        bind:clientWidth={handWidth}
        style="height: {handHeight}px"
      ></div>{/if}
    {#if director.dealing && deal && view.mySeat !== null}
      {#key director.dealing.id}<DealFlight dealer={director.dealing.dealer} me={view.mySeat} />{/key}
    {/if}
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
  /* The menu top-left and Settings top-right (Ryan); the rest of the top belongs to the theme's
     scene. (Messenger's floating video bubble can be dragged off the gear.) */
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
  .gear {
    display: grid;
    place-items: center;
    padding: 0 12px;
    color: var(--ink);
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
  /* Centred in the space between the header and the scoreboard, leaving room above for the
     theme's scene. That space is the same in bidding and play, so the seats never move. */
  .middle {
    display: grid;
    align-content: center;
    min-height: 0;
  }
  /* A 3×3 grid around the table: one gap everywhere, so every seat is equally far from it. */
  .cluster {
    display: grid;
    /* The table shrinks on short phones, so the bidding box never covers my seat. */
    grid-template-columns: auto min(180px, calc(100vw - 236px), max(112px, calc(100dvh - 571px))) auto;
    grid-template-areas:
      '. top .'
      'left center right'
      '. me .';
    /* Clear of the table's rim, the same on all four sides. */
    gap: 18px;
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
  /* "Going once / twice": a solid pill straddling the table's bottom rim, clear of the calls. */
  .going {
    position: absolute;
    bottom: 0;
    left: 50%;
    z-index: 2;
    translate: -50% 45%;
    padding: 5px 14px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    box-shadow:
      0 4px 14px rgba(0, 0, 0, 0.45),
      0 0 18px var(--accent-glow);
    animation: going-in calc(var(--spring-pop-ms, 380ms) * var(--speed)) var(--spring-pop, cubic-bezier(0.3, 1.6, 0.6, 1)) backwards;
  }
  @keyframes going-in {
    from {
      scale: 1.6;
      opacity: 0;
    }
  }
  :global(.fx-reduced) .going {
    animation: fade-in calc(250ms * var(--speed)) backwards;
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
  /* While the dealer shuffles: the Deal button (with a shuffle icon), or who we're waiting on. */
  .dealing {
    display: grid;
    place-items: center;
    height: 100%;
  }
  .deal {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding: 0 34px;
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    box-shadow: 0 0 22px var(--accent-glow);
  }
  :global(.fx-full) .deal:not(:disabled) {
    animation: deal-ready calc(1600ms * var(--speed)) ease-in-out infinite;
  }
  /* A breathing glow (the button itself stays still, so a tap always lands). */
  @keyframes deal-ready {
    50% {
      box-shadow:
        0 0 0 3px var(--accent-glow),
        0 0 36px var(--accent-glow);
    }
  }
  .shuffle {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .waiting-deal {
    margin: 0;
    font-family: var(--font-name);
    font-size: 15px;
    color: var(--ink-dim);
  }
  /* The scoreboard's slot: one fixed height in every phase. */
  .board {
    position: relative;
    display: grid;
    align-items: center;
    height: 64px;
  }
  /* Under the bidding box, the dealer line would show through: hide it. */
  .board.covered > :global(.bug) {
    visibility: hidden;
  }
  /* The bidding box sits on the slot and rises over the empty felt below my seat. */
  .float {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
  }
  .float.prompts {
    bottom: calc(100% + 6px);
    z-index: 6;
    display: grid;
    pointer-events: none;
  }
  .float.prompts > :global(*) {
    pointer-events: auto;
    margin: 0;
    background: var(--sheet);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  }
  /* The auction, during play, opens above the scoreboard so the race stays visible. */
  .float.above {
    bottom: calc(100% + 6px);
    padding: 8px;
    border-radius: 12px;
    background: var(--sheet);
    border: 1px solid var(--line);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  }
</style>
