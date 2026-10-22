<script lang="ts">
  import { partner } from '@dark/engine';
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
</script>

{#if deal?.phase === 'awaitingPlayOn' && deal.clinch}
  <div class="prompt panel clinch-prompt" role="status">
    <strong>{deal.clinch.side === 'declarers' ? 'Contract WON!' : 'Contract LOST!'}</strong>
    <span>Play the rest out?</span>
    <div class="bar"><i style="width: {fraction(room.clinchDeadline, 5000) * 100}%"></i></div>
    <button class="primary" onclick={() => conn.intent({ type: 'deal', action: { type: 'playOn' } })}>
      Play on ({secondsLeft(room.clinchDeadline)})
    </button>
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
