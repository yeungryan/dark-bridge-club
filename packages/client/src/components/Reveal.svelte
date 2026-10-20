<script lang="ts">
  import { hcp, next, partner, seatsFrom, sideOf, type Seat } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { cardText, isRed, pairNames, profileOf } from '../lib/format';

  // Spec S14 (plain version): result, all four original hands with HCP, then wait for all four.
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
  const verdict = $derived(result.reason === 'conceded' ? 'Conceded' : result.winner === 'declarers' ? 'Made' : 'Set');
  const ready = $derived(view.readyForNext.includes(view.me));

  function suitLine(seat: Seat, suit: 'S' | 'H' | 'D' | 'C') {
    return hands[seat].filter((c) => c.suit === suit).map((c) => cardText(c).rank).join(' ') || '—';
  }
</script>

<div class="reveal panel">
  <h3>{verdict}: {pairNames(view, profiles, winningPair)} +1</h3>
  <p class="muted">
    {contract.level}{contract.strain === 'NT' ? 'NT' : cardText({ suit: contract.strain, rank: 2 }).suit} by
    {profileOf(profiles, view.seating![contract.declarer]).name} ·
    declarers took {result.declarerTricks}, defenders {result.defenderTricks}
    {#if result.overUnder !== null}· {result.overUnder >= 0 ? `+${result.overUnder}` : `${result.overUnder}`}{/if}
  </p>

  <div class="hands">
    {#each [view.mySeat!, partner(view.mySeat!), next(partner(view.mySeat!)), next(view.mySeat!)] as seat (seat)}
      {@const p = profileOf(profiles, view.seating![seat])}
      <div class="hand" style="--c: {p.color}">
        <div class="who">{p.name}{seat === view.mySeat ? ' (you)' : ''} <span class="muted">· {hcp(hands[seat])} HCP</span></div>
        {#each ['S', 'H', 'D', 'C'] as const as suit (suit)}
          <div class:red={isRed({ suit, rank: 2 })}>{cardText({ suit, rank: 2 }).suit} {suitLine(seat, suit)}</div>
        {/each}
      </div>
    {/each}
  </div>

  <p class="tally">Tonight: {pairNames(view, profiles, 'A')} {view.wins.A} · {view.wins.B} {pairNames(view, profiles, 'B')}</p>

  <button class="primary" disabled={ready} onclick={() => conn.intent({ type: 'readyForNext' })}>
    {ready ? 'Waiting for the others…' : 'Next deal'}
  </button>
  <div class="ready">
    {#each view.profiles as id (id)}
      {@const p = profileOf(profiles, id)}
      <span class:on={view.readyForNext.includes(id)} style="--c: {p.color}">{p.name}</span>
    {/each}
  </div>
</div>

<style>
  .reveal {
    display: grid;
    gap: 10px;
    text-align: center;
  }
  h3 {
    margin: 0;
    font-size: 1.25rem;
  }
  p {
    margin: 0;
  }
  .hands {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 10px;
    text-align: left;
    font-size: 14px;
  }
  .hand div {
    white-space: nowrap;
  }
  .hand {
    border-left: 4px solid var(--c);
    padding-left: 8px;
  }
  .who {
    font-weight: 650;
    color: var(--c);
  }
  .red {
    color: #ff8a7a;
  }
  .ready {
    display: flex;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
  }
  .ready span {
    opacity: 0.4;
  }
  .ready span.on {
    opacity: 1;
    color: var(--c);
  }
</style>
