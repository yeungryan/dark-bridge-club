<script lang="ts">
  import { partner, PLAY_ON_ANSWER_MS, PLAY_ON_MS, sideOf, sweepStillOn, type Seat } from '@dark/engine';
  import { onDestroy } from 'svelte';
  import type { Connection } from '../lib/connection.svelte';
  import { nameAtSeat } from '../lib/format';

  // The decisions that interrupt play: "Play it out?" (R11), concession offers (R7), ending the night (S05).
  let { conn }: { conn: Connection } = $props();

  let now = $state(Date.now());
  const timer = setInterval(() => (now = conn.now()), 200);
  onDestroy(() => clearInterval(timer));

  const view = $derived(conn.view!);
  const room = $derived(conn.room!);
  const deal = $derived(view.deal);
  const profiles = $derived(room.profiles);
  const secondsLeft = (deadline: number | null) => (deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0);
  const fraction = (deadline: number | null, total: number) => (deadline ? Math.max(0, Math.min(1, (deadline - now) / total)) : 0);

  const concession = $derived(deal?.concession ?? null);
  const iAnswer = $derived(concession !== null && view.mySeat === partner(concession.by));
  const iProposed = $derived(concession !== null && view.mySeat === concession.by);
  const votedEnd = $derived(view.endNightVotes.includes(view.me));

  // Play On (Ryan, round 21): one asks, their partner agrees. With a sweep still possible, the
  // winners "Go for a sweep" and the losers can "Ask to be swept".
  const ask = $derived(deal?.playOnAsk ?? null);
  const mySide = $derived(deal?.contract && view.mySeat !== null ? sideOf(view.mySeat, deal.contract) : null);
  const sweepOn = $derived(!!deal && sweepStillOn(deal));
  const playOnLabel = $derived(!sweepOn ? 'Play on' : mySide === deal?.clinch?.side ? 'Go for a sweep' : 'Ask to be swept');
  const asked = (label: string) => (label === 'Play on' ? 'play on' : label === 'Go for a sweep' ? 'go for a sweep' : 'be swept');
  const askLabel = $derived(
    !ask || !deal?.clinch ? 'Play on' : !sweepOn ? 'Play on' : ask.side === deal.clinch.side ? 'Go for a sweep' : 'Ask to be swept',
  );
  const iDeclined = $derived(!!deal?.playOnDeclined && deal.playOnDeclined === mySide);
  const otherDeclined = $derived(!!deal?.playOnDeclined && deal.playOnDeclined !== mySide);
  const windowMs = $derived(ask || deal?.playOnDeclined ? PLAY_ON_ANSWER_MS : PLAY_ON_MS);
  const pairOf = (seat: Seat) => `${nameAtSeat(view, profiles, seat)} & ${nameAtSeat(view, profiles, partner(seat))}`;
  const otherPairSeat = $derived(view.mySeat === null ? null : ((view.mySeat + 1) % 4) as Seat);
</script>

{#if deal?.phase === 'awaitingPlayOn' && deal.clinch}
  <div class="prompt panel clinch-prompt" role="status">
    <strong>{deal.clinch.side === 'declarers' ? 'Contract WON!' : 'Contract LOST!'}</strong>
    <div class="bar"><i style="width: {fraction(room.clinchDeadline, windowMs) * 100}%"></i></div>
    {#if ask && view.mySeat === partner(ask.by)}
      <span>{nameAtSeat(view, profiles, ask.by)} wants to {asked(askLabel)}.</span>
      <div class="two">
        <button onclick={() => conn.intent({ type: 'deal', action: { type: 'declinePlayOn' } })}>No</button>
        <button class="primary" onclick={() => conn.intent({ type: 'deal', action: { type: 'playOn' } })}>
          Agree ({secondsLeft(room.clinchDeadline)})
        </button>
      </div>
    {:else if ask && view.mySeat === ask.by}
      <span>Waiting for {nameAtSeat(view, profiles, partner(ask.by))} to agree… ({secondsLeft(room.clinchDeadline)})</span>
    {:else if ask}
      <span>{nameAtSeat(view, profiles, ask.by)} wants to {asked(askLabel)}. Waiting for their partner… ({secondsLeft(room.clinchDeadline)})</span>
    {:else if iDeclined}
      <span>{otherPairSeat !== null ? pairOf(otherPairSeat) : 'The other pair'} can still choose to play on… ({secondsLeft(room.clinchDeadline)})</span>
    {:else}
      <span>{otherDeclined && otherPairSeat !== null ? `${pairOf(otherPairSeat)} said no. ` : ''}Play the rest out?</span>
      <button class="primary" onclick={() => conn.intent({ type: 'deal', action: { type: 'playOn' } })}>
        {playOnLabel} ({secondsLeft(room.clinchDeadline)})
      </button>
      <span class="muted small">Your partner has to agree.</span>
    {/if}
  </div>
{/if}

{#if concession}
  <div class="prompt panel" role="status">
    {#if iAnswer}
      <strong>{nameAtSeat(view, profiles, concession.by)} wants to concede the rest of this game.</strong>
      <span class="muted">If you agree, the other side wins this deal.</span>
      <div class="bar"><i style="width: {fraction(room.concessionDeadline, 15000) * 100}%"></i></div>
      <div class="two">
        <button onclick={() => conn.intent({ type: 'deal', action: { type: 'declineConcession' } })}>Keep playing</button>
        <button class="primary" onclick={() => conn.intent({ type: 'deal', action: { type: 'acceptConcession' } })}>Agree</button>
      </div>
    {:else if iProposed}
      <span>Waiting for {nameAtSeat(view, profiles, partner(concession.by))} to agree to concede… ({secondsLeft(room.concessionDeadline)})</span>
    {:else}
      <span>{nameAtSeat(view, profiles, concession.by)} offered to concede. Waiting for their partner… ({secondsLeft(room.concessionDeadline)})</span>
    {/if}
  </div>
{/if}

{#if view.endGameVotes.length > 0}
  <div class="prompt panel" role="status">
    <strong>End this game? {view.endGameVotes.length}/4 agreed</strong>
    <span class="muted">Everyone has to agree. It won't count for anyone, and the next dealer deals.</span>
    <div class="two">
      <button onclick={() => conn.intent({ type: 'cancelEndGame' })}>Keep playing</button>
      {#if !view.endGameVotes.includes(view.me)}<button class="primary" onclick={() => conn.intent({ type: 'voteEndGame' })}>Agree</button>{/if}
    </div>
  </div>
{/if}

{#if view.endNightVotes.length > 0}
  <div class="prompt panel" role="status">
    <strong>End the night? {view.endNightVotes.length}/4 agreed</strong>
    <span class="muted">Everyone has to agree. An unfinished game won't count.</span>
    <div class="two">
      <button onclick={() => conn.intent({ type: 'cancelEndNight' })}>Keep playing</button>
      {#if !votedEnd}<button class="primary" onclick={() => conn.intent({ type: 'voteEndNight' })}>Agree</button>{/if}
    </div>
  </div>
{/if}

<style>
  .prompt {
    display: grid;
    gap: 8px;
    text-align: center;
    margin: 6px 0;
  }
  /* Appears just after the clinch moment has landed (hit-pause, shake, burst). */
  .clinch-prompt {
    animation: fade-in calc(250ms * var(--speed)) ease-out calc(650ms * var(--speed)) backwards;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .bar {
    height: 4px;
    background: var(--line);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.2s linear;
  }
</style>
