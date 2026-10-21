<script lang="ts">
  import { hcp, next, partner, seatsFrom, sideOf, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { onMount } from 'svelte';
  import { cardText, isRed, pairNames, profileOf } from '../lib/format';
  import { director } from '../lib/juice/director.svelte';
  import { avatarAtSeat, teamColor } from '../lib/avatars';
  import { ring, sparks } from '../lib/juice/particles';
  import { cssColor } from '../lib/themes';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import { TIMING } from '../lib/juice/timing';
  import CountUp from './CountUp.svelte';
  import CallText from './CallText.svelte';
  import { MOMENT_EMOJI, momentCaption } from '../lib/stories';
  import Replay from './Replay.svelte';
  import { liveReplay } from '../lib/replayGame';
  import Suit from './Suit.svelte';
  import AnimalIcon from './AnimalIcon.svelte';

  // Spec S14: the payoff for hidden hands. The result lands, the score ticks up, then the four
  // hands flip one by one (from declarer's right, in play order) with their HCP counting up.
  // Tap the panel to skip to the end. It then waits for all four to tap "Next game".
  // Wording (Ryan): a trick is a "set", a deal is a "game", so a defeated contract is "Defeated".
  let { conn }: { conn: Connection } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  const profiles = $derived(conn.room!.profiles);
  const result = $derived(deal.result!);
  const contract = $derived(deal.contract!);
  const hands = $derived(deal.revealedHands!);
  const winningSeat = $derived<Seat>(
    seatsFrom(contract.declarer).find((s) => sideOf(s, contract) === result.winner)!,
  );
  const winningPair = $derived(view.pairs!.A.includes(view.seating![winningSeat]) ? 'A' : 'B');
  const verdict = $derived(result.reason === 'conceded' ? 'Conceded' : result.winner === 'declarers' ? 'Made' : 'Defeated');
  const ready = $derived(view.readyForNext.includes(view.me));

  // Hands flip in play order, starting from declarer's right.
  const flipOrder = $derived(seatsFrom(next(contract.declarer)));
  // svelte-ignore state_referenced_locally
  let flipped = $state<Seat[]>(settings.animated ? [] : [0, 1, 2, 3]);
  let skipped = $state(!settings.animated);
  let banner = $state<HTMLElement>();
  const timers: ReturnType<typeof setTimeout>[] = [];

  // S19: this game's moments, shown once the hands are all face up.
  const moments = $derived((conn.room!.gameMoments ?? []).filter((m) => m.dealNumber === view.dealNumber));
  const allFlipped = $derived(flipped.length === 4);

  // The replay (step back through the game set by set), on this phone only.
  let replaying = $state(false);

  // A big contract or a dramatic clinch gets a richer reveal.
  const dramatic = $derived(contract.level >= 5 || (director.clinch?.drama ?? 0) >= 2);

  onMount(() => {
    if (skipped) return;
    const { firstFlip, flipGap } = TIMING.reveal;
    flipOrder.forEach((seat, i) => {
      timers.push(
        setTimeout(() => {
          flipped = [...flipped, seat];
          sound.flip();
        }, settings.ms(firstFlip + i * flipGap)),
      );
    });
    if (dramatic && settings.motion) {
      timers.push(
        setTimeout(() => {
          const r = banner?.getBoundingClientRect();
          const colors = view.pairs![winningPair].map((id) => profileOf(profiles, id).color);
          if (!r) return;
          // A big contract: a golden ring and sparks (confetti is kept for winning the night).
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const gold = cssColor('--accent', '#e8c25a');
          ring(x, y, gold, { radius: 120, width: 4, frames: 28 });
          sparks(x, y, 30, [...colors, gold]);
        }, settings.ms(TIMING.reveal.banner)),
      );
    }
    return () => timers.forEach(clearTimeout);
  });

  function skip() {
    if (skipped) return;
    skipped = true;
    timers.forEach(clearTimeout);
    flipped = [0, 1, 2, 3];
  }

  function suitLine(seat: Seat, suit: 'S' | 'H' | 'D' | 'C') {
    return hands[seat].filter((c) => c.suit === suit).map((c) => cardText(c).rank).join(' ') || '—';
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="reveal panel" class:skipped class:move={settings.motion} onclick={skip}>
  <!-- The result (Ryan: trimmed): one bold line, one quiet line, then the hands. Tap to skip. -->
  <header class="result">
    <h3 bind:this={banner} class="banner {result.winner}">
      {verdict}{#if result.overUnder !== null && result.overUnder !== 0}
        <span class="margin">{result.overUnder > 0 ? `+${result.overUnder}` : `−${-result.overUnder}`}</span>{/if}
    </h3>
    <p class="line">
      <span class="bid"><CallText call={{ type: 'bid', level: contract.level, strain: contract.strain }} /></span>
      <span class="by"><AnimalIcon animal={avatarAtSeat(conn, contract.declarer)?.animal} /> {profileOf(profiles, view.seating![contract.declarer]).name}</span>
      <span class="sets" aria-label="Sets: declarers {result.declarerTricks}, defenders {result.defenderTricks}"
        >{result.declarerTricks}–{result.defenderTricks} sets</span
      >
    </p>
    <p class="winners">{pairNames(view, profiles, winningPair)} take the game</p>
  </header>

  {#if moments.length > 0 && allFlipped}
    <ul class="moments" aria-label="Moments">
      {#each moments as m, i (m.kind + i)}
        <li style="--i: {i}"><span aria-hidden="true">{MOMENT_EMOJI[m.kind]}</span> {momentCaption(m, profiles)}</li>
      {/each}
    </ul>
  {/if}

  <div class="hands">
    {#each [view.mySeat!, partner(view.mySeat!), next(partner(view.mySeat!)), next(view.mySeat!)] as seat (seat)}
      {@const p = profileOf(profiles, view.seating![seat])}
      <div class="hand" class:flipped={flipped.includes(seat)} style="--c: {teamColor(conn, seat)}">
        <div class="who">
          <AnimalIcon animal={avatarAtSeat(conn, seat)?.animal} />
          <span class="name">{p.name}</span>
          <span class="hcp" aria-label="high-card points">{#if flipped.includes(seat)}<CountUp value={hcp(hands[seat])} />{:else}?{/if}</span>
        </div>
        {#if flipped.includes(seat)}
          <div class="face">
            {#each ['C', 'D', 'H', 'S'] as const as suit (suit)}
              <div class:red={isRed({ suit, rank: 2 })}><Suit {suit} /> {suitLine(seat, suit)}</div>
            {/each}
          </div>
        {:else}
          <div class="back" aria-label="Face down"></div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="actions">
    <button
      class="ghost rewind"
      aria-label="Replay this game"
      title="Replay this game"
      onclick={(e) => {
        e.stopPropagation();
        skip();
        replaying = true;
      }}
      ><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M11 6v12L2.5 12zm10 0v12l-8.5-6z" /></svg></button
    >
    <button
      class="primary next"
      disabled={ready}
      onclick={(e) => {
        e.stopPropagation();
        skip();
        conn.intent({ type: 'readyForNext' });
      }}
    >
      {ready ? 'Waiting for the others…' : 'Next game'}
    </button>
  </div>
  <!-- Who's ready for the next game: their animals light up. -->
  <div class="ready" aria-label="Ready for the next game">
    {#each view.profiles as id (id)}
      {@const p = profileOf(profiles, id)}
      {@const on = view.readyForNext.includes(id)}
      <span class:on title={p.name} aria-label="{p.name}{on ? ' is ready' : ''}"><AnimalIcon animal={conn.room!.avatars?.[id]?.animal} /></span>
    {/each}
  </div>
</div>

{#if replaying}<Replay game={liveReplay(conn)} onClose={() => (replaying = false)} />{/if}

<style>
  .reveal {
    display: grid;
    gap: 18px;
    padding: 18px 16px 16px;
    text-align: center;
  }
  p {
    margin: 0;
  }
  .result {
    display: grid;
    gap: 6px;
  }
  h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.9rem;
    line-height: 1.05;
  }
  .margin {
    font-size: 0.7em;
    opacity: 0.85;
  }
  .banner.declarers,
  .banner.defenders {
    color: var(--accent);
  }
  .line {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
    font-size: 15px;
    color: var(--ink);
  }
  .bid {
    font-family: var(--font-card);
    font-weight: 800;
    font-size: 1.15rem;
  }
  .by {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-name);
    font-weight: 700;
  }
  .sets {
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
    color: var(--ink-dim);
  }
  .winners {
    font-size: 13px;
    color: var(--ink-dim);
  }
  /* Moments: little caption chips that spring in one after another. */
  .moments {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .moments li {
    padding: 6px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 16%, var(--panel));
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    font-size: 13.5px;
    animation: chip calc(var(--spring-pop-ms, 400ms) * var(--speed)) var(--spring-pop, cubic-bezier(0.3, 1.6, 0.6, 1))
      calc(var(--i) * 180ms * var(--speed)) backwards;
  }
  @keyframes chip {
    from {
      transform: translateY(8px) scale(0.85);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .moments li,
  :global(.fx-off) .moments li {
    animation: fade-in calc(250ms * var(--speed)) backwards;
  }
  /* The result lands first. */
  .move .banner {
    animation: drop calc(450ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1) backwards;
  }
  .reveal:not(.move) .banner {
    animation: fade-in calc(300ms * var(--speed)) backwards;
  }
  @keyframes drop {
    0% {
      transform: scale(1.7);
      opacity: 0;
    }
  }
  .skipped .banner {
    animation: none;
  }
  /* The four hands, two by two, each edged in its team colour. */
  .hands {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px 14px;
    text-align: left;
    font-size: 14.5px;
    line-height: 1.45;
  }
  .hand div {
    white-space: nowrap;
  }
  .hand {
    border-left: 3px solid var(--c);
    padding-left: 10px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
    font-family: var(--font-name);
    font-weight: 700;
    color: var(--ink);
  }
  .hcp {
    margin-left: auto;
    padding: 0 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 10%, transparent);
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-dim);
    font-variant-numeric: tabular-nums;
  }
  .red {
    color: var(--red-on-felt);
  }
  /* Face-down until each hand's turn, then it flips over. */
  .back {
    height: 5.8em;
    margin-top: 2px;
    border-radius: 6px;
    background: var(--card-back);
    border: 1px solid var(--line);
  }
  .move .flipped .face {
    animation: flip calc(320ms * var(--speed)) ease-out backwards;
    transform-origin: left center;
  }
  .reveal:not(.move) .flipped .face {
    animation: fade-in calc(250ms * var(--speed)) backwards;
  }
  .skipped .flipped .face {
    animation: none;
  }
  @keyframes flip {
    0% {
      transform: perspective(400px) rotateY(80deg);
      opacity: 0;
    }
  }
  /* Rewind (the replay) beside a wide Next game. */
  .actions {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 10px;
  }
  .rewind {
    display: grid;
    place-items: center;
    min-height: 52px;
    padding: 0;
  }
  .next {
    min-height: 52px;
  }
  .ready {
    display: flex;
    justify-content: center;
    gap: 12px;
    font-size: 22px;
  }
  .ready span {
    display: grid;
    opacity: 0.25;
    filter: grayscale(1);
    transition:
      opacity calc(200ms * var(--speed)),
      filter calc(200ms * var(--speed));
  }
  .ready span.on {
    opacity: 1;
    filter: none;
  }
</style>
