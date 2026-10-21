<script lang="ts">
  import { partner, type Card as CardT, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { cardText, isRed, nameAtSeat, seatAt, spotOf, type Spot } from '../lib/format';
  import { avatarAtSeat, teamColor } from '../lib/avatars';
  import { replaySteps } from '../lib/replay';
  import { sound } from '../lib/juice/sound';
  import Card from './Card.svelte';
  import CallText from './CallText.svelte';
  import Suit from './Suit.svelte';
  import AnimalIcon from './AnimalIcon.svelte';
  import TableScene from './TableScene.svelte';

  // The replay (Ryan): after a game, step back through it set by set with every hand face up:
  // who led each set, who won it, and what everyone still held. Each player steps through on
  // their own phone (not synced); to show the others, share your screen on the call.
  let { conn, onClose }: { conn: Connection; onClose: () => void } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  const profiles = $derived(conn.room!.profiles);
  const me = $derived(view.mySeat!);
  const contract = $derived(deal.contract!);
  const steps = $derived(replaySteps(deal.revealedHands!, deal.playedTricks ?? [], contract));
  let at = $state(0);
  const step = $derived(steps[Math.min(at, steps.length - 1)]!);

  const SPOTS: Spot[] = ['top', 'left', 'right', 'bottom'];
  // Top to bottom in the bidding box's order (Ryan).
  const SUITS = ['C', 'D', 'H', 'S'] as const;

  function go(to: number) {
    const clamped = Math.max(0, Math.min(steps.length - 1, to));
    if (clamped === at) return;
    at = clamped;
    sound.flip();
  }

  // Swipe left for the next set, right for the previous one.
  let swipeFrom: number | null = null;
  function down(e: PointerEvent) {
    swipeFrom = e.clientX;
  }
  function up(e: PointerEvent) {
    if (swipeFrom === null) return;
    const dx = e.clientX - swipeFrom;
    swipeFrom = null;
    if (Math.abs(dx) > 48) go(at + (dx < 0 ? 1 : -1));
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') go(at + 1);
    else if (e.key === 'ArrowLeft') go(at - 1);
    else if (e.key === 'Escape') onClose();
  }

  const suitLine = (cards: readonly CardT[], suit: CardT['suit']) =>
    cards
      .filter((c) => c.suit === suit)
      .map((c) => cardText(c).rank)
      .join(' ');
  const playOf = (seat: Seat) => step.trick?.cards.find((p) => p.seat === seat) ?? null;
  const label = $derived(step.set === 0 ? 'The bidding' : `Set ${step.set} of ${steps.length - 1}`);

  // The set strip (Ryan): two lanes like the scoreboard, declarers above defenders. Each set is a
  // column, and its winner's animal sits in the lane of the team that won it.
  const lanes = $derived([
    { side: 'declarers' as const, seats: [contract.declarer, partner(contract.declarer)] },
    { side: 'defenders' as const, seats: [((contract.declarer + 1) % 4) as Seat, ((contract.declarer + 3) % 4) as Seat] },
  ]);
  const laneOf = (seat: Seat) => (seat % 2 === contract.declarer % 2 ? 0 : 1);
  const initials = (seats: Seat[]) => seats.map((seat) => nameAtSeat(view, profiles, seat)[0]).join('·');
</script>

<svelte:window onkeydown={key} />

<div class="replay" role="dialog" aria-modal="true" aria-label="Replay of game {view.dealNumber}">
  <!-- Tonight's scene along the top, as at the table (the replay's felt would hide the page's). -->
  <TableScene theme={conn.room!.theme} />
  <header>
    <button class="ghost close" aria-label="Close the replay" onclick={onClose}>✕</button>
    <h2>Replay · Game {view.dealNumber}</h2>
    <span class="contract"><CallText call={{ type: 'bid', level: contract.level, strain: contract.strain }} /></span>
  </header>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="board" onpointerdown={down} onpointerup={up} onpointercancel={() => (swipeFrom = null)}>
    {#each SPOTS as spot (spot)}
      {@const seat = seatAt(spot, me)}
      {@const played = playOf(seat)}
      <section class="hand {spot}" style="--c: {teamColor(conn, seat)}" data-replay-seat={seat}>
        <p class="who">
          <AnimalIcon animal={avatarAtSeat(conn, seat)?.animal} />
          {nameAtSeat(view, profiles, seat)}
          {#if step.trick?.leader === seat && step.trick?.winner === seat}<b class="tag led won">led · won</b>
          {:else if step.trick?.leader === seat}<b class="tag led">led</b>
          {:else if step.trick?.winner === seat}<b class="tag won">won</b>{/if}
        </p>
        <div class="suits" aria-label="{nameAtSeat(view, profiles, seat)} still holds">
          {#each SUITS as suit (suit)}
            <div class:red={isRed({ suit, rank: 2 })}>
              <Suit {suit} />
              <span>{suitLine(step.hands[seat], suit) || '—'}</span>
              {#if played && played.card.suit === suit}<s class="gone" aria-label="played">{cardText(played.card).rank}</s>{/if}
            </div>
          {/each}
        </div>
      </section>
    {/each}

    <div class="table" aria-live="polite">
      {#if step.trick}
        {#each step.trick.cards as play (play.seat)}
          <div class="spot {spotOf(play.seat, me)}" class:winner={play.seat === step.trick.winner}>
            <Card card={play.card} width={36} highlight={play.seat === step.trick.winner} />
          </div>
        {/each}
      {:else}
        <ol class="calls" aria-label="The bidding">
          {#each deal.calls as c, i (i)}
            <li><span>{nameAtSeat(view, profiles, c.seat)}</span> <CallText call={c.call} /></li>
          {/each}
        </ol>
      {/if}
    </div>
  </div>

  {#if step.decisive}<p class="note decisive">⭐ This set decided it.</p>{/if}
  {#if step.stoppedHere}<p class="note">The game stopped here; the rest were never played.</p>{/if}

  <nav class="controls" aria-label="Replay controls">
    <div class="lanes" style="--n: {steps.length - 1}">
      <button class="bids" class:on={at === 0} aria-label="The bidding" aria-current={at === 0 ? 'step' : undefined} onclick={() => go(0)}>Bids</button>
      {#each lanes as lane, l (lane.side)}
        <span class="lane-name" style="--t: {teamColor(conn, lane.seats[0]!)}; grid-row: {l + 2}">{initials(lane.seats)}</span>
      {/each}
      {#each steps.slice(1) as s, i (i)}
        {@const w = s.trick!.winner}
        <button
          class="set"
          class:on={i + 1 === at}
          class:decisive={s.decisive}
          style="grid-column: {i + 3}; --t: {teamColor(conn, w)}"
          aria-label="Set {i + 1}, won by {nameAtSeat(view, profiles, w)}{s.decisive ? ' (decided it)' : ''}"
          aria-current={i + 1 === at ? 'step' : undefined}
          onclick={() => go(i + 1)}
        >
          <span class="num">{s.decisive ? '★' : i + 1}</span>
          <span class="slot" style="grid-row: {laneOf(w) + 2}"><AnimalIcon animal={avatarAtSeat(conn, w)?.animal} silhouette="var(--t)" /></span>
        </button>
      {/each}
    </div>
    <div class="nav">
      <button class="step" onclick={() => go(at - 1)} disabled={at === 0} aria-label="Previous set">◀</button>
      <p class="status">
        <strong>{label}</strong>
        {#if step.set > 0}
          <br />Declarers {step.tally.declarers}/{deal.declarerTarget} · Defenders {step.tally.defenders}/{deal.defenderTarget}
        {/if}
      </p>
      <button class="step" onclick={() => go(at + 1)} disabled={at === steps.length - 1} aria-label="Next set">▶</button>
    </div>
  </nav>
</div>

<style>
  .replay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    grid-template-rows: auto 1fr auto auto auto;
    gap: 6px;
    max-width: 720px;
    margin: 0 auto;
    padding: 8px 12px max(10px, env(safe-area-inset-bottom));
    background: var(--felt-bg, var(--felt));
    animation: fade-in calc(200ms * var(--speed));
  }
  header {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
  }
  h2 {
    margin: 0;
    text-align: center;
    font-size: 1.05rem;
  }
  .close {
    min-height: 40px;
    font-size: 1.1rem;
  }
  .contract {
    justify-self: end;
    font-family: var(--font-card);
    font-weight: 800;
  }
  /* The table and the four hands around it, the same way round as the game. */
  .board {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 140px minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    grid-template-areas:
      'top top top'
      'left table right'
      'bottom bottom bottom';
    gap: 8px;
    align-items: center;
    align-content: center;
    touch-action: pan-y;
    min-height: 0;
  }
  .hand {
    display: grid;
    gap: 2px;
    justify-items: center;
    min-width: 0;
  }
  .top {
    grid-area: top;
  }
  .left {
    grid-area: left;
  }
  .right {
    grid-area: right;
  }
  .bottom {
    grid-area: bottom;
  }
  .who {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 4px;
    font-family: var(--font-name);
    font-weight: 700;
    font-size: 13px;
    color: var(--c);
    white-space: nowrap;
  }
  .tag {
    padding: 0 5px;
    border-radius: 6px;
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 15px;
  }
  .tag.led {
    background: color-mix(in srgb, var(--ink) 18%, transparent);
    color: var(--ink);
  }
  .tag.won {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .suits {
    display: grid;
    gap: 1px;
    padding: 4px 8px;
    border-radius: 8px;
    background: var(--panel);
    font-family: var(--font-card);
    font-size: 13.5px;
    line-height: 1.25;
    min-width: 0;
  }
  .suits div {
    display: flex;
    gap: 4px;
    align-items: baseline;
    white-space: nowrap;
  }
  .suits .red {
    color: var(--red-on-felt);
  }
  /* The card this player has just put on the table, struck out of their hand. */
  .gone {
    opacity: 0.55;
  }
  .table {
    grid-area: table;
    position: relative;
    width: 140px;
    height: 140px;
    border-radius: var(--surface-radius, 50%);
    background: var(--surface, rgba(0, 0, 0, 0.15));
    box-shadow: var(--surface-rim, none);
  }
  .spot {
    position: absolute;
    animation: land calc(var(--spring-pop-ms, 300ms) * var(--speed)) var(--spring-pop, cubic-bezier(0.3, 1.6, 0.6, 1)) backwards;
  }
  .spot.top {
    left: 50%;
    top: 4px;
    translate: -50% 0;
  }
  .spot.bottom {
    left: 50%;
    bottom: 4px;
    translate: -50% 0;
  }
  .spot.left {
    left: 6px;
    top: 50%;
    translate: 0 -50%;
  }
  .spot.right {
    right: 6px;
    top: 50%;
    translate: 0 -50%;
  }
  .spot.winner {
    z-index: 1;
    filter: drop-shadow(0 0 8px var(--accent-glow));
  }
  @keyframes land {
    from {
      transform: scale(0.7);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .spot,
  :global(.fx-off) .spot {
    animation: none;
  }
  .calls {
    position: absolute;
    inset: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    align-content: center;
    gap: 1px;
    overflow-y: auto;
    font-size: 12px;
    text-align: center;
  }
  .calls span {
    color: var(--ink-dim);
  }
  .status {
    margin: 0;
    text-align: center;
    font-size: 13px;
    line-height: 1.35;
    color: var(--ink-dim);
  }
  .status strong {
    color: var(--ink);
  }
  .note {
    margin: 0;
    text-align: center;
    font-size: 13px;
    color: var(--ink-dim);
  }
  .note.decisive {
    color: var(--accent);
    font-weight: 700;
  }
  .controls {
    display: grid;
    gap: 8px;
  }
  .step {
    min-height: 48px;
    font-size: 1.1rem;
  }
  /* The strip: a "Bids" column, the two team lanes' initials, then one column per set. */
  .lanes {
    display: grid;
    grid-template-columns: 34px 30px repeat(var(--n), minmax(0, 26px));
    grid-template-rows: 14px 28px 28px;
    justify-content: center;
    column-gap: 1px;
    align-items: center;
  }
  .bids {
    grid-column: 2;
    grid-row: 1 / 4;
    align-self: stretch;
    min-height: 0;
    padding: 0;
    border-radius: 8px;
    font-size: 9.5px;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    writing-mode: vertical-rl;
    rotate: 180deg;
    background: none;
    border: 1px solid var(--line);
    color: var(--ink-dim);
  }
  .bids.on {
    background: color-mix(in srgb, var(--accent) 30%, transparent);
    border-color: var(--accent);
    color: var(--ink);
  }
  .lane-name {
    grid-column: 1;
    font-family: var(--font-name);
    font-size: 11px;
    font-weight: 700;
    color: var(--t);
    white-space: nowrap;
  }
  /* A set: a whole column you can tap. Its number on top, its winner in their team's lane. */
  .set {
    grid-row: 1 / 4;
    align-self: stretch;
    display: grid;
    grid-template-rows: 14px 28px 28px;
    justify-items: center;
    align-items: center;
    min-height: 0;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: none;
    transition: background calc(150ms * var(--speed));
  }
  .num {
    grid-row: 1;
    font-size: 9.5px;
    line-height: 1;
    color: var(--ink-dim);
  }
  .set.decisive .num {
    color: var(--accent);
    font-size: 11px;
  }
  .slot {
    display: grid;
    font-size: 21px;
  }
  /* Where you are: the column lights up. */
  .set.on {
    background: color-mix(in srgb, var(--accent) 26%, transparent);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .set.on .num {
    color: var(--ink);
    font-weight: 700;
  }
  .nav {
    display: grid;
    grid-template-columns: 52px 1fr 52px;
    align-items: center;
    gap: 6px;
  }
</style>
