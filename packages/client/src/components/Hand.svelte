<script lang="ts">
  import type { Card as CardT } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { sameCard } from '../lib/format';
  import { buzz } from '../lib/juice/haptics';
  import { launch } from '../lib/juice/launch.svelte';
  import { director } from '../lib/juice/director.svelte';
  import { bidPreview } from '../lib/bidPreview.svelte';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import { TIMING } from '../lib/juice/timing';
  import Card from './Card.svelte';

  // Spec S11: tap a card to lift it for a closer look; drag or flick it up to the table to play.
  // The card follows your finger anywhere, the table glows once it will play, and it flies
  // on from exactly where you let go. Settings → "Play cards by: Tap twice" brings back
  // tap-to-raise, tap-again-to-play.
  let { conn }: { conn: Connection } = $props();

  const deal = $derived(conn.view!.deal!);
  const myTurnToPlay = $derived(deal.phase === 'play' && deal.turn === conn.view!.mySeat && !conn.room!.paused);
  let raised = $state<CardT | null>(null);
  let wobble = $state<CardT | null>(null);
  let nudge = $state(0);
  /** Played but not yet confirmed by the server: hidden from the hand, shown as a ghost. */
  let pending = $state<{ card: CardT; rect: DOMRect } | null>(null);
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let width = $state(360);

  // Clear the raised and pending cards only when the hand itself changes (a card was played or
  // a new deal started). Other server updates (presence, someone else's move) must not drop
  // them, or the second tap would just raise the card again.
  const handKey = $derived(deal.hand.map((c) => c.suit + c.rank).join(','));
  $effect(() => {
    void handKey;
    raised = null;
    pending = null;
  });

  // The deal: hidden while the cards fly, then the hand fans open from the middle.
  // (The fan class comes off once it has played, so a later animation can't replay it.)
  let fanning = $state(false);
  let wasDealing = false;
  $effect(() => {
    const dealing = director.dealing !== null;
    if (wasDealing && !dealing && settings.motion) {
      fanning = true;
      setTimeout(() => (fanning = false), settings.ms(1200));
    }
    wasDealing = dealing;
  });

  const cardWidth = $derived(Math.min(76, Math.max(46, Math.floor(width / 6.2))));
  const step = $derived(deal.hand.length > 1 ? Math.min(cardWidth * 0.82, (width - cardWidth) / (deal.hand.length - 1)) : 0);
  // The bid you've picked (or, before you pick, the bid to beat) raises the cards it's about:
  // its suit, or your honours for NT. Your screen only.
  const previewed = (c: CardT) =>
    bidPreview.strain !== null && (bidPreview.strain === 'NT' ? c.rank >= 11 : c.suit === bidPreview.strain);
  // Once the contract is set, your trumps carry a purple stripe for the rest of the game.
  const trumpSuit = $derived(deal.contract && deal.contract.strain !== 'NT' ? deal.contract.strain : null);
  const isLegal = (c: CardT) => deal.legalPlays.some((l) => sameCard(l, c));
  const tapStyle = $derived(settings.playStyle === 'tap');

  function reject(card: CardT) {
    wobble = card;
    sound.no();
    buzz('no');
    setTimeout(() => (wobble = null), 300);
  }

  function play(card: CardT, el: HTMLElement | null) {
    const rect = (el?.querySelector('.card') ?? el)?.getBoundingClientRect();
    if (rect) {
      launch.set(card, rect);
      pending = { card, rect };
      if (pendingTimer) clearTimeout(pendingTimer);
      // If the server never confirms (a lost message), give the card back.
      pendingTimer = setTimeout(() => {
        pending = null;
        launch.clear();
      }, 3000);
    }
    conn.intent({ type: 'deal', action: { type: 'play', card } });
    raised = null;
  }

  function tap(card: CardT, el: HTMLElement | null, keyboard = false) {
    const isRaised = raised !== null && sameCard(raised, card);
    if (!isRaised) {
      raised = card;
      sound.pickup();
      buzz('tap');
      return;
    }
    if (!myTurnToPlay) {
      raised = null;
      return;
    }
    if (!isLegal(card)) return reject(card);
    // Tap-twice style (and the keyboard) play on the second tap; drag style asks for a swipe.
    if (tapStyle || keyboard) return play(card, el);
    nudge++;
  }

  // Drag: the card follows your finger. Let go far enough up (or flick it) to play it.
  const MOVE_SLOP = 8;
  let drag = $state<{
    card: CardT;
    x: number;
    y: number;
    dx: number;
    dy: number;
    moved: boolean;
    vx: number;
    vy: number;
    t: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  /**
   * The held card leans in 3D (Balatro): toward your finger when you press it, and into the
   * direction of travel while you drag it, catching the light as it turns.
   */
  let lean = $state<{ card: CardT; rx: number; ry: number } | null>(null);
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  const leanOf = (card: CardT) => (settings.motion && lean !== null && sameCard(lean.card, card) ? lean : null);

  const playable = (card: CardT) => myTurnToPlay && isLegal(card);
  const willPlay = (d: NonNullable<typeof drag>) =>
    playable(d.card) && (d.dy <= -TIMING.dragToPlay || (d.vy <= -TIMING.flickSpeed && d.dy <= -TIMING.flickMin));

  $effect(() => {
    launch.armed = drag !== null && drag.moved && willPlay(drag);
  });

  function down(e: PointerEvent, card: CardT) {
    if (!e.isPrimary || pending) return;
    drag = { card, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false, vx: 0, vy: 0, t: e.timeStamp, lastX: e.clientX, lastY: e.clientY };
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    // Pressing a card tips it toward your finger, like pressing on a real card's edge.
    const r = (el.querySelector('.card') ?? el).getBoundingClientRect();
    const px = clamp(((e.clientX - r.left) / r.width) * 2 - 1, 1);
    const py = clamp(((e.clientY - r.top) / r.height) * 2 - 1, 1);
    lean = { card, rx: -py * 12, ry: px * 14 };
  }

  function move(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) > MOVE_SLOP || Math.abs(dy) > MOVE_SLOP) drag.moved = true;
    // Speed, smoothed (px/ms; negative vy is up).
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.vx = drag.vx * 0.4 + ((e.clientX - drag.lastX) / dt) * 0.6;
    drag.vy = drag.vy * 0.4 + ((e.clientY - drag.lastY) / dt) * 0.6;
    drag.t = e.timeStamp;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    // Dragged, it leans into its motion: moving right turns its face right, moving up tips it back.
    if (drag.moved) lean = { card: drag.card, rx: clamp(-drag.vy * 22, 24), ry: clamp(drag.vx * 26, 24) };
    // A card you can play follows your finger freely; others resist.
    const free = playable(drag.card);
    drag.dx = free ? dx : dx * 0.15;
    drag.dy = free ? dy : Math.min(0, dy) * 0.2;
  }

  function release(e: PointerEvent) {
    if (!drag) return;
    const d = drag;
    drag = null;
    lean = null;
    const el = e.currentTarget as HTMLElement;
    if (!d.moved) return tap(d.card, el);
    if (willPlay(d)) {
      // Measure where the card is now (under your finger) before it's hidden.
      return play(d.card, el);
    }
    if (d.dy < -MOVE_SLOP && myTurnToPlay && !isLegal(d.card)) reject(d.card);
  }

  const dragging = (card: CardT) => drag !== null && drag.moved && sameCard(drag.card, card);
  const isPending = (card: CardT) => pending !== null && sameCard(pending.card, card);
</script>

<div class="hand" class:dealing={director.dealing !== null} bind:clientWidth={width} style="height: {cardWidth * 1.4 + 22}px">
  {#each deal.hand as card, i (card.suit + card.rank)}
    {@const up = raised !== null && sameCard(raised, card)}
    {@const held = dragging(card)}
    {@const l = leanOf(card)}
    <button
      class="slot"
      class:up
      class:wobble={wobble !== null && sameCard(wobble, card)}
      class:dragging={held}
      class:armed={held && launch.armed}
      class:gone={isPending(card)}
      class:tilt={settings.motion}
      class:fan={fanning}
      class:preview={!up && !held && previewed(card)}
      style="--i: {i}; --dx: {width / 2 - cardWidth / 2 - i * step}px; left: {i * step}px; {held ? `transform: translate(${drag!.dx}px, ${drag!.dy}px) rotate(${drag!.dx * 0.04}deg) scale(1.1)` : ''}"
      onpointerdown={(e) => down(e, card)}
      onpointermove={move}
      onpointerup={release}
      onpointercancel={() => {
        drag = null;
        lean = null;
      }}
      onclick={(e) => {
        // Keyboard activation only; pointer taps are handled in release().
        if (e.detail === 0) tap(card, e.currentTarget as HTMLElement, true);
      }}
      aria-label={up ? (tapStyle ? 'Tap again to play' : 'Swipe up to play') : 'Select card'}
    >
      {#key up ? nudge : 0}
        <div class="lift" class:nudge={up && nudge > 0} class:idle={up && !l && !held}>
          <div
            class="glowable"
            class:playable={myTurnToPlay && isLegal(card) && !up && !held}
            class:leaning={l !== null}
            class:suit-start={i > 0 && deal.hand[i - 1]!.suit !== card.suit}
            style="--rx: {l?.rx ?? 0}deg; --ry: {l?.ry ?? 0}deg; --sx: {50 + (l?.ry ?? 0) * 2.2}%; --sy: {50 - (l?.rx ?? 0) * 2.2}%"
          >
            <Card {card} width={cardWidth} dim={myTurnToPlay && !isLegal(card)} highlight={up || held} trump={card.suit === trumpSuit} />
            <!-- A sheen of light that slides across the face as the card turns. -->
            {#if l}<span class="sheen" aria-hidden="true"></span>{/if}
          </div>
        </div>
      {/key}
    </button>
  {/each}
</div>
{#if pending}
  <!-- Your card, waiting where you let go until the table confirms it (a few tens of ms). -->
  <div class="ghost" style="left: {pending.rect.left}px; top: {pending.rect.top}px">
    <Card card={pending.card} width={pending.rect.width} highlight />
  </div>
{/if}
{#if raised && myTurnToPlay && !pending}
  {#key nudge}
    <p class="hint" class:flash={nudge > 0}>{tapStyle ? 'Tap it again, or drag it up, to play.' : 'Swipe it up to the table to play.'}</p>
  {/key}
{/if}

<style>
  .hand {
    position: relative;
    margin: 0 auto;
    width: 100%;
  }
  .slot {
    position: absolute;
    bottom: 0;
    padding: 0;
    border: 0;
    background: none;
    min-height: 0;
    touch-action: none;
    transition: transform calc(180ms * var(--speed)) cubic-bezier(0.34, 1.56, 0.64, 1);
    transition-duration: calc(var(--spring-pop-ms, 180ms) * var(--speed));
    transition-timing-function: var(--spring-pop, cubic-bezier(0.34, 1.56, 0.64, 1));
  }
  /* A lifted card rises, grows, and sits on top of its neighbours. */
  /* Raised for the bid you've picked. */
  .slot.preview {
    transform: translateY(-16px);
  }
  /* Where a suit starts (Ryan): a deeper shadow and a thin outline on its first card, so ♦
     and ♥ (and ♣ and ♠) never run together. */
  .glowable.suit-start :global(.card:not(.highlight)) {
    box-shadow:
      -5px 0 7px rgba(0, 0, 0, 0.55),
      0 0 0 1.5px rgba(29, 29, 29, 0.55);
  }
  /* While the deal flies in, the hand is empty; then it fans open from the middle. */
  .hand.dealing .slot {
    visibility: hidden;
  }
  .slot.fan {
    animation: fan-in calc(var(--spring-pop-ms, 400ms) * var(--speed)) var(--spring-pop, cubic-bezier(0.3, 1.5, 0.6, 1))
      calc(var(--i) * 22ms * var(--speed)) backwards;
  }
  @keyframes fan-in {
    from {
      transform: translateX(var(--dx)) translateY(18px) rotate(calc((var(--i) - 6) * 3deg));
      opacity: 0;
    }
  }
  .slot.up {
    transform: translateY(-26px) scale(1.12);
    z-index: 2;
  }
  .slot.up.tilt {
    transform: translateY(-26px) scale(1.12) rotate(-2deg);
  }
  .slot.dragging {
    transition: none;
    z-index: 30;
    filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.5));
  }
  .slot.armed {
    filter: drop-shadow(0 0 14px var(--accent-glow));
  }
  .slot.gone {
    visibility: hidden;
  }
  .slot.wobble {
    animation: wobble 0.3s;
  }
  @keyframes wobble {
    25% { transform: translate(-5px, -26px) scale(1.12); }
    75% { transform: translate(5px, -26px) scale(1.12); }
  }
  /* Tapping a lifted card (drag style): it hops, as if to say "throw me". */
  :global(.fx-full) .lift.nudge {
    animation: hop calc(360ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
  }
  @keyframes hop {
    40% {
      transform: translateY(-16px);
    }
  }
  /* A raised card sways gently while it waits, as if held in a hand. */
  :global(.fx-full) .lift.idle {
    animation: sway calc(2600ms * var(--speed)) ease-in-out infinite;
  }
  @keyframes sway {
    0%,
    100% {
      transform: perspective(600px) rotateZ(-1.2deg) rotateY(-6deg) translateY(0);
    }
    50% {
      transform: perspective(600px) rotateZ(1.2deg) rotateY(6deg) translateY(-2px);
    }
  }
  /* Your turn: the cards you can play give off a soft glow. */
  .glowable {
    position: relative;
    border-radius: 6px;
    transform: perspective(600px) rotateX(var(--rx)) rotateY(var(--ry));
    transition:
      box-shadow calc(250ms * var(--speed)),
      transform calc(var(--spring-wobble-ms, 300ms) * var(--speed)) var(--spring-wobble, ease-out);
  }
  /* While held, the lean follows the finger quickly; letting go springs it back with a wobble. */
  .glowable.leaning {
    transition:
      box-shadow calc(250ms * var(--speed)),
      transform 90ms ease-out;
  }
  .sheen {
    position: absolute;
    inset: 0;
    border-radius: 6px;
    pointer-events: none;
    background: radial-gradient(circle at var(--sx) var(--sy), rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.12) 30%, transparent 60%);
    mix-blend-mode: soft-light;
  }
  .glowable.playable {
    box-shadow: 0 -2px 12px var(--accent-glow);
  }
  .ghost {
    position: fixed;
    z-index: 40;
    pointer-events: none;
    filter: drop-shadow(0 0 14px var(--accent-glow));
  }
  .hint {
    text-align: center;
    font-size: 14px;
    color: var(--ink-dim);
    margin: 4px 0 0;
  }
  .hint.flash {
    color: var(--accent);
    font-weight: 650;
    animation: fade-in calc(200ms * var(--speed));
  }
</style>
