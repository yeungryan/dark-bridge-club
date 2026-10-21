<script lang="ts">
  import { allMatchups, type ProfileInfo } from '@dark/engine';
  import { pairName, sendChange, type HistoryData } from '../lib/history';
  import { sound } from '../lib/juice/sound';

  // Add a night played away from the app to the all-time scores (Ryan): when, who partnered whom,
  // and the games each pair won. It goes to the others for approval before it counts.
  let { profiles, onUpdate, onCancel }: { profiles: readonly ProfileInfo[]; onUpdate: (d: HistoryData) => void; onCancel: () => void } = $props();

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const splits = $derived(allMatchups(profiles.map((p) => p.id)));
  let date = $state(today());
  let split = $state(0);
  let wins = $state<[number, number]>([0, 0]);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const bump = (side: 0 | 1, by: number) => {
    sound.tap();
    wins[side] = Math.max(0, Math.min(99, wins[side] + by));
  };

  async function send() {
    const [A, B] = splits[split]!;
    // Noon on that day, local time: the date reads the same in every time zone nearby.
    const playedAt = new Date(`${date}T12:00:00`).getTime();
    busy = true;
    error = null;
    try {
      onUpdate(await sendChange({ type: 'propose', change: { kind: 'add', night: { playedAt, pairs: { A, B }, wins: { A: wins[0], B: wins[1] } } } }));
      sound.stamp(2, true);
      onCancel();
    } catch (e) {
      error = e instanceof Error ? e.message : 'That didn’t go through.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="form panel" aria-label="Add an offline night">
  <h3>Add an offline night</h3>
  <label class="field">
    <span>Played on</span>
    <input type="date" bind:value={date} max={today()} />
  </label>
  <div class="field">
    <span>Partners</span>
    <div class="splits">
      {#each splits as [a, b], i (i)}
        <button class="split" class:on={split === i} aria-pressed={split === i} onclick={() => (split = i)}>
          {pairName(profiles, a)} <small>vs</small> {pairName(profiles, b)}
        </button>
      {/each}
    </div>
  </div>
  <div class="field">
    <span>Games won</span>
    <div class="score">
      {#each [0, 1] as const as side (side)}
        <div class="side">
          <small>{pairName(profiles, splits[split]![side])}</small>
          <div class="stepper">
            <button aria-label="One fewer" onclick={() => bump(side, -1)}>−</button>
            <strong aria-live="polite">{wins[side]}</strong>
            <button aria-label="One more" onclick={() => bump(side, 1)}>＋</button>
          </div>
        </div>
      {/each}
    </div>
  </div>
  <p class="note">It counts once all four of you approve it.</p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="row">
    <button class="ghost" onclick={onCancel}>Cancel</button>
    <button class="primary" disabled={busy || !date || wins[0] + wins[1] === 0} onclick={send}>Send for approval</button>
  </div>
</section>

<style>
  .form {
    display: grid;
    gap: 12px;
    padding: 14px;
    border-radius: 14px;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .field {
    display: grid;
    gap: 6px;
  }
  .field > span {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  input {
    min-height: 42px;
  }
  .splits {
    display: grid;
    gap: 6px;
  }
  .split {
    min-height: 42px;
    font-size: 14px;
    font-weight: 650;
  }
  .split small {
    color: var(--ink-dim);
    font-weight: 400;
  }
  .split.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .split.on small {
    color: inherit;
  }
  .score {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .side {
    display: grid;
    gap: 4px;
    justify-items: center;
    text-align: center;
  }
  .side small {
    font-size: 12.5px;
    color: var(--ink-dim);
  }
  .stepper {
    display: grid;
    grid-template-columns: 40px 44px 40px;
    align-items: center;
    justify-items: center;
  }
  .stepper button {
    min-height: 40px;
    width: 40px;
    padding: 0;
    font-size: 1.1rem;
  }
  .stepper strong {
    font-family: var(--font-display);
    font-size: 1.6rem;
  }
  .note {
    margin: 0;
    font-size: 13px;
    color: var(--ink-dim);
  }
  .error {
    margin: 0;
    color: var(--bad, #ff7a5c);
    font-size: 14px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1.6fr;
    gap: 8px;
  }
  .row button {
    min-height: 46px;
  }
</style>
