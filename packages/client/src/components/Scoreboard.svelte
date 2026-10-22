<script lang="ts">
  import { next, partner, type PairId, type Seat, type Side } from '@dark/engine';
  import type { Connection } from '../lib/connection.svelte';
  import { avatarAtSeat, rimFor, teamColor, teamOf } from '../lib/avatars';
  import { nameAtSeat, profileOf } from '../lib/format';
  import { director } from '../lib/juice/director.svelte';
  import CallText from './CallText.svelte';
  import AnimalIcon from './AnimalIcon.svelte';

  // Spec S13, as a playoff score bug (Ryan): the winning bid is the hero on the left; on the
  // right, one row per pair with its initials, a silhouette of the animal that won each set
  // (team-coloured, empty outlines for sets still needed), sets/target, and the pair's games
  // won tonight. The newest set is the bigger, pulsing silhouette: tap it to see that set.
  let { conn, onPeek, onAuction }: { conn: Connection; onPeek: () => void; onAuction: () => void } = $props();

  const view = $derived(conn.view!);
  const deal = $derived(view.deal!);
  const profiles = $derived(conn.room!.profiles);
  const contract = $derived(deal.contract);

  const pairOfSeat = (seat: Seat): PairId => (view.pairs?.A.includes(view.seating![seat]) ? 'A' : 'B');
  const rimOf = (seat: Seat) => rimFor(teamOf(conn, seat));
  const initials = (pair: PairId) => (view.pairs?.[pair] ?? []).map((id) => profileOf(profiles, id).name[0]).join('·');
  const sideOfSeat = (seat: Seat): Side => (contract && (seat === contract.declarer || seat === partner(contract.declarer)) ? 'declarers' : 'defenders');

  // Each won set, in order, with its winner (a set's pip appears when its orb lands: director.pipHold).
  const rows = $derived.by(() => {
    if (!contract) return [];
    const decl = contract.declarer;
    return (['declarers', 'defenders'] as const).map((side) => {
      const seat: Seat = side === 'declarers' ? decl : next(decl);
      const won = deal.trickWinners.map((w, i) => ({ w, i })).filter(({ w }) => sideOfSeat(w) === side);
      const shown = Math.min(won.length, director.pipHold[side] ?? won.length);
      const need = side === 'declarers' ? deal.declarerTarget! : deal.defenderTarget!;
      return { side, seat, pair: pairOfSeat(seat), won: won.slice(0, shown), count: shown, need };
    });
  });
  const lastIndex = $derived(deal.trickWinners.length - 1);
  const settledBy = $derived(deal.clinch?.side ?? null);
  const glowing = $derived(settledBy !== null && !director.holding);
</script>

<div class="bug">
  {#if contract}
    <!-- The hero: the contract, and who declared it. Tap for the auction. -->
    {#key director.contractPulse}
      <button class="ghost contract" onclick={onAuction} aria-label="Contract (tap for the bidding)">
        <span class="bid"><CallText call={{ type: 'bid', level: contract.level, strain: contract.strain }} /></span>
        <span class="by">
          <!-- The declarer's animal as a silhouette the height of the name (Ryan), like the set icons. -->
          <AnimalIcon animal={avatarAtSeat(conn, contract.declarer)?.animal} silhouette={teamColor(conn, contract.declarer)} rim={rimOf(contract.declarer)} size="1.05em" />
          {nameAtSeat(view, profiles, contract.declarer)}
        </span>
        <!-- Tap for the bidding, in order (round 10: say so, it wasn't findable). -->
        <span class="bids" aria-hidden="true">bids ▾</span>
        {#if director.contractPulse > 0}<span class="sold" aria-hidden="true">Sold!</span>{/if}
      </button>
    {/key}
    <div class="meters">
      {#each rows as row (row.side)}
        <div
          class="row"
          data-side={row.side}
          data-team={teamOf(conn, row.seat)}
          style="--t: {teamColor(conn, row.seat)}"
          class:close={!settledBy && row.count === row.need - 1}
          class:done={row.count >= row.need}
          class:glow={glowing && settledBy === row.side}
          class:lost={glowing && settledBy !== row.side}
        >
          <span class="team">{initials(row.pair)}</span>
          <span class="pips">
            {#each Array.from({ length: Math.max(row.need, row.count) }, (_, i) => i) as i (i)}
              {@const set = row.won[i]}
              {#if set && set.i === lastIndex}
                <button class="pip on latest" style="--i: {i}" aria-label="Last set (tap to see it)" onclick={onPeek}
                  ><AnimalIcon animal={avatarAtSeat(conn, set.w)?.animal} silhouette="var(--t)" rim={rimOf(row.seat)} /></button
                >
              {:else if set}
                <i class="pip on" style="--i: {i}"><AnimalIcon animal={avatarAtSeat(conn, set.w)?.animal} silhouette="var(--t)" rim={rimOf(row.seat)} /></i>
              {:else}
                <i class="pip" style="--i: {i}"></i>
              {/if}
            {/each}
          </span>
          <span class="count"
            >{row.count}<small>/{row.need}</small
            >{#if director.combo?.side === row.side && director.combo.n >= 2}{#key director.combo.id}<b
                  class="combo"
                  aria-label="{director.combo.n} sets in a row">×{director.combo.n}</b
                >{/key}{/if}</span
          >
          <span class="series" aria-label="Games won tonight">{view.wins[row.pair]}</span>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Bidding: who dealt, and the night so far. -->
    <span class="dealing">{nameAtSeat(view, profiles, deal.dealer)} deals</span>
    {#if view.pairs}
      <span class="night">
        {initials('A')} <strong>{view.wins.A}</strong> – <strong>{view.wins.B}</strong> {initials('B')}
      </span>
    {/if}
  {/if}
</div>

<style>
  .bug {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    width: min(100%, 380px);
    margin: 0 auto;
    padding: 6px 8px;
    border-radius: 12px;
    background: var(--panel);
    border: 1px solid var(--line);
  }
  /* Contract: the biggest thing here. */
  .contract {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 1px;
    min-height: 0;
    padding: 2px 10px 2px 4px;
    border: 0;
    border-right: 1px solid var(--line);
    border-radius: 0;
    animation: stamp calc(420ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1);
    animation-duration: calc(var(--spring-wobble-ms, 320ms) * var(--speed));
    animation-timing-function: var(--spring-wobble, cubic-bezier(0.3, 1.6, 0.6, 1));
  }
  .bid {
    font-family: var(--font-card);
    font-weight: 800;
    font-size: 1.9rem;
    line-height: 1;
  }
  .by {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-name);
    font-weight: 700;
    font-size: 13px;
    line-height: 1;
    color: var(--ink-dim);
  }
  .bids {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1;
    color: var(--ink-dim);
    opacity: 0.8;
  }
  @keyframes stamp {
    from {
      transform: scale(2.2) rotate(-4deg);
      opacity: 0;
    }
  }
  :global(.fx-reduced) .contract {
    animation: fade-in calc(300ms * var(--speed));
  }
  .sold {
    position: absolute;
    top: -12px;
    left: 50%;
    padding: 0 6px;
    border-radius: 6px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    white-space: nowrap;
    opacity: 0;
    transform: translateX(-50%);
    animation: sold calc(1600ms * var(--speed)) cubic-bezier(0.3, 1.5, 0.6, 1);
  }
  @keyframes sold {
    0% {
      transform: translateX(-50%) scale(2) rotate(-12deg);
      opacity: 0;
    }
    15%,
    75% {
      transform: translateX(-50%) scale(1) rotate(-6deg);
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* The team rows: initials · sets · count · tonight's games. */
  .meters {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 2.4em minmax(0, 1fr) auto 1.6em;
    align-items: center;
    gap: 6px;
    transition: opacity calc(300ms * var(--speed));
  }
  /* Team Black on the dark panel: its initials and animals get a thin light rim, or they'd vanish. */
  .row[data-team='black'] {
    --t-ring: rgba(255, 255, 255, 0.75);
  }
  .row[data-team='black'] .team {
    text-shadow:
      0 0 1px #fff,
      0 0 1px #fff,
      0 0 3px rgba(255, 255, 255, 0.5);
  }
  .team {
    font-family: var(--font-name);
    font-weight: 700;
    font-size: 13px;
    color: var(--t);
    white-space: nowrap;
  }
  .pips {
    display: flex;
    align-items: center;
    gap: 1px;
    min-width: 0;
  }
  /* A set still needed: an empty outline. */
  .pip {
    display: grid;
    place-items: center;
    flex: none;
    width: 15px;
    height: 15px;
    padding: 0;
    border: 0;
    min-height: 0;
    background: none;
    font-style: normal;
    font-size: 13px;
    line-height: 1;
  }
  .pip:not(.on)::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--ink-dim);
    opacity: 0.6;
  }
  /* A set won: the winner's animal as a solid shape in the team colour. */
  :global(.fx-full) .pip.on {
    animation: pip calc(320ms * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1);
    animation-duration: calc(var(--spring-wobble-ms, 320ms) * var(--speed));
    animation-timing-function: var(--spring-wobble, cubic-bezier(0.3, 1.6, 0.6, 1));
  }
  /* A silhouette springs in from nothing and wobbles to rest. */
  @keyframes pip {
    from {
      transform: scale(0.2);
    }
  }
  /* The newest set: bigger, ringed and breathing, and tappable to see it. */
  .pip.latest {
    width: 22px;
    height: 22px;
    margin: 0 2px;
    font-size: 16px;
    border-radius: 50%;
    box-shadow:
      0 0 0 1.5px var(--t-ring, var(--t)),
      0 0 10px var(--accent-glow);
    cursor: pointer;
  }
  :global(.fx-full) .pip.latest {
    animation:
      pip calc(var(--spring-wobble-ms, 320ms) * var(--speed)) cubic-bezier(0.3, 1.6, 0.6, 1),
      latest calc(1800ms * var(--speed)) ease-in-out calc(400ms * var(--speed)) infinite;
    animation-timing-function: var(--spring-wobble, cubic-bezier(0.3, 1.6, 0.6, 1)), ease-in-out;
  }
  @keyframes latest {
    50% {
      box-shadow:
        0 0 0 1.5px var(--t-ring, var(--t)),
        0 0 2px var(--accent-glow);
    }
  }
  /* One set away: the next empty slot shimmers. */
  .row.close .pip:not(.on)::before {
    border-color: var(--accent);
    opacity: 1;
  }
  .count {
    position: relative;
    font-family: var(--font-card);
    font-weight: 700;
    font-size: 14px;
    white-space: nowrap;
  }
  /* Sets in a row: a little flame-coloured "×3" that springs in and grows with the run. */
  .combo {
    position: absolute;
    top: -9px;
    right: -10px;
    padding: 0 4px;
    border-radius: 6px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 10px;
    font-weight: 800;
    line-height: 14px;
    box-shadow: 0 0 10px var(--accent-glow);
    animation: combo calc(var(--spring-wobble-ms, 400ms) * var(--speed)) var(--spring-wobble, cubic-bezier(0.3, 1.6, 0.6, 1));
  }
  @keyframes combo {
    from {
      transform: scale(2.4) rotate(-12deg);
      opacity: 0;
    }
  }
  .count small {
    font-size: 11px;
    color: var(--ink-dim);
  }
  .row.done .count {
    color: var(--good);
  }
  /* Tonight's games, like a playoff series column. */
  .series {
    display: grid;
    place-items: center;
    height: 20px;
    border-radius: 5px;
    background: var(--sheet);
    border: 1px solid var(--line);
    font-family: var(--font-card);
    font-weight: 800;
    font-size: 13px;
  }
  .row.glow .team,
  .row.glow .count {
    color: var(--accent);
  }
  .row.lost {
    opacity: 0.45;
  }
  .dealing {
    font-family: var(--font-name);
    color: var(--ink-dim);
    font-size: 14px;
  }
  .night {
    justify-self: end;
    font-family: var(--font-name);
    font-size: 13px;
    color: var(--ink-dim);
  }
  .night strong {
    font-family: var(--font-card);
    color: var(--ink);
  }
</style>
