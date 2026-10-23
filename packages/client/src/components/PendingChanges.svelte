<script lang="ts">
  import { pairKey, type MatchupRecord, type PendingChange, type ProfileInfo } from '@dark/engine';
  import { profileOf } from '../lib/format';
  import { pairName, sendChange, type HistoryData } from '../lib/history';
  import { sound } from '../lib/juice/sound';

  // New all-time scores waiting for everyone's OK (Ryan). One applies once all four approve;
  // anyone can turn it down.
  let {
    profiles,
    me,
    pending,
    board,
    onUpdate,
  }: { profiles: readonly ProfileInfo[]; me: string; pending: readonly PendingChange[]; board: readonly MatchupRecord[]; onUpdate: (d: HistoryData) => void } = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);
  const name = (id: string) => (id === me ? 'you' : profileOf(profiles, id).name);

  /** "Darren & Kim 5–3 Adrian & Ryan · games 21–17 (now 3–2 · 14–11)". */
  function describe(p: PendingChange): { line: string; was: string } {
    if (p.change.kind === 'reset') return { line: 'Reset everything to 0–0', was: 'Every matchup, player card, leaderboard and award count back to zero. The night log and replays stay.' };
    const [a, b] = p.change.sides;
    const line = `${pairName(profiles, a.players)} ${a.nightsWon}–${b.nightsWon} ${pairName(profiles, b.players)} · games ${a.gamesWon}–${b.gamesWon}`;
    const now = board.find((m) => m.sides.some((s) => pairKey(s.players) === pairKey(a.players)));
    const side = (k: readonly string[]) => now?.sides.find((s) => pairKey(s.players) === pairKey(k));
    const was = now ? `now ${side(a.players)!.nightsWon}–${side(b.players)!.nightsWon} · games ${side(a.players)!.gamesWon}–${side(b.players)!.gamesWon}` : '';
    return { line, was };
  }

  async function act(type: 'approve' | 'reject', id: string) {
    busy = true;
    error = null;
    try {
      onUpdate(await sendChange({ type, id }));
      sound.tap();
    } catch (e) {
      error = e instanceof Error ? e.message : 'That didn’t go through.';
    } finally {
      busy = false;
    }
  }
</script>

{#if pending.length}
  <section class="pending" aria-label="Changes waiting for approval">
    <h3>New scores waiting for everyone's OK</h3>
    {#each pending as p (p.id)}
      {@const waiting = profiles.map((x) => x.id).filter((id) => !p.approvals.includes(id))}
      {@const d = describe(p)}
      <article class="change panel">
        <p class="what">{d.line}</p>
        {#if d.was}<p class="was">{d.was}</p>{/if}
        <p class="who">
          {p.proposedBy === me ? 'You proposed' : `${name(p.proposedBy)} proposed`} · {p.approvals.length} of {profiles.length} OK{#if waiting.length}
            · waiting on {waiting.map(name).join(', ')}{/if}
        </p>
        <div class="row">
          {#if !p.approvals.includes(me)}
            <button class="primary" disabled={busy} onclick={() => act('approve', p.id)}>Approve</button>
            <button disabled={busy} onclick={() => act('reject', p.id)}>Turn down</button>
          {:else}
            <button class="ghost" disabled={busy} onclick={() => act('reject', p.id)}>{p.proposedBy === me ? 'Withdraw' : 'Turn down'}</button>
          {/if}
        </div>
      </article>
    {/each}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </section>
{/if}

<style>
  .pending {
    display: grid;
    gap: 8px;
    margin-bottom: 18px;
  }
  h3 {
    margin: 4px 0 0;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .change {
    display: grid;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 14px;
    box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  p {
    margin: 0;
  }
  .what {
    font-weight: 650;
  }
  .was {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .who {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row button {
    min-height: 40px;
    flex: 1;
  }
  .error {
    color: var(--bad, #ff7a5c);
    font-size: 14px;
  }
</style>
