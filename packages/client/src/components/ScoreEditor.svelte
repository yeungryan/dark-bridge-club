<script lang="ts">
  import type { MatchupRecord, ProfileInfo, ScoreSide } from '@dark/engine';
  import { pairName, sendChange, type HistoryData } from '../lib/history';
  import { sound } from '../lib/juice/sound';

  // Set a matchup's all-time score by hand (Ryan): add nights played away from the app, stop
  // counting some wins, or start again from zero. It starts from the score as it stands, and goes
  // to the others: it counts once all four of you approve it.
  let {
    profiles,
    match,
    onUpdate,
    onCancel,
  }: { profiles: readonly ProfileInfo[]; match: MatchupRecord; onUpdate: (d: HistoryData) => void; onCancel: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let counts = $state(match.sides.map((s) => ({ nights: s.nightsWon, games: s.gamesWon })));
  let busy = $state(false);
  let error = $state<string | null>(null);
  const unchanged = $derived(counts.every((c, i) => c.nights === match.sides[i]!.nightsWon && c.games === match.sides[i]!.gamesWon));

  const bump = (side: number, what: 'nights' | 'games', by: number) => {
    sound.tap();
    counts[side]![what] = Math.max(0, Math.min(9999, counts[side]![what] + by));
  };
  const zero = () => {
    sound.tap();
    counts = counts.map(() => ({ nights: 0, games: 0 }));
  };

  async function send() {
    const side = (i: number): ScoreSide => ({ players: match.sides[i]!.players, nightsWon: counts[i]!.nights, gamesWon: counts[i]!.games });
    busy = true;
    error = null;
    try {
      onUpdate(await sendChange({ type: 'propose', change: { kind: 'score', sides: [side(0), side(1)] } }));
      sound.stamp(2, true);
      onCancel();
    } catch (e) {
      error = e instanceof Error ? e.message : 'That didn’t go through.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="editor" aria-label="Change the score">
  <div class="grid">
    <span></span>
    <small>Nights won</small>
    <small>Games won</small>
    {#each match.sides as side, i (i)}
      <span class="who">{pairName(profiles, side.players)}</span>
      {#each ['nights', 'games'] as const as what (what)}
        <div class="stepper">
          <button aria-label="One fewer {what} for {pairName(profiles, side.players)}" onclick={() => bump(i, what, -1)}>−</button>
          <strong aria-live="polite">{counts[i]![what]}</strong>
          <button aria-label="One more {what} for {pairName(profiles, side.players)}" onclick={() => bump(i, what, 1)}>＋</button>
        </div>
      {/each}
    {/each}
  </div>
  <button class="ghost zero" onclick={zero}>Start again from 0–0</button>
  <p class="note">It counts once all four of you approve. Nights played after that add on top.</p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="row">
    <button class="ghost" onclick={onCancel}>Cancel</button>
    <button class="primary" disabled={busy || unchanged} onclick={send}>Send for approval</button>
  </div>
</section>

<style>
  .editor {
    grid-column: 1 / -1;
    display: grid;
    gap: 10px;
    margin: 6px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 6px 8px;
    align-items: center;
  }
  .grid small {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim);
    text-align: center;
  }
  .who {
    font-family: var(--font-name);
    font-weight: 700;
    font-size: 14px;
    line-height: 1.2;
  }
  .stepper {
    display: grid;
    grid-template-columns: 34px 38px 34px;
    align-items: center;
    justify-items: center;
  }
  .stepper button {
    min-height: 36px;
    width: 34px;
    padding: 0;
    font-size: 1rem;
  }
  .stepper strong {
    font-family: var(--font-display);
    font-size: 1.3rem;
  }
  .zero {
    justify-self: start;
    min-height: 36px;
    font-size: 13.5px;
  }
  p {
    margin: 0;
  }
  .note {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .error {
    color: var(--bad, #ff7a5c);
    font-size: 14px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1.6fr;
    gap: 8px;
  }
  .row button {
    min-height: 44px;
  }
</style>
