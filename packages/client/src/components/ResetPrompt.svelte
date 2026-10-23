<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { profileOf } from '../lib/format';
  import { sendChange } from '../lib/history';
  import { buzz } from '../lib/juice/haptics';
  import { sound } from '../lib/juice/sound';

  // Ryan (round 13): when someone asks to reset everything to 0–0, it pops up on every screen,
  // like the offer to concede a game but with no timer. It stays until all four agree (then it
  // happens) or anyone turns it down.
  let { conn }: { conn: Connection } = $props();

  const reset = $derived(conn.room?.pendingReset ?? null);
  const me = $derived(conn.view?.me ?? '');
  const profiles = $derived(conn.room?.profiles ?? []);
  const name = (id: string) => profileOf(profiles, id).name;
  const waiting = $derived(reset ? profiles.map((p) => p.id).filter((id) => !reset.approvals.includes(id)) : []);
  const iAnswer = $derived(!!reset && !reset.approvals.includes(me));

  let busy = $state(false);
  let error = $state<string | null>(null);

  // A ping when it lands on your screen.
  let seen: string | null = null;
  $effect(() => {
    if (reset && iAnswer && seen !== reset.id) {
      seen = reset.id;
      sound.tap();
      buzz('tap');
    }
  });

  async function act(type: 'approve' | 'reject') {
    if (!reset) return;
    busy = true;
    error = null;
    try {
      await sendChange({ type, id: reset.id });
      sound.tap();
    } catch (e) {
      error = e instanceof Error ? e.message : 'That didn’t go through.';
    } finally {
      busy = false;
    }
  }

  const list = (ids: string[]) => (ids.length < 2 ? ids.map(name).join('') : `${ids.slice(0, -1).map(name).join(', ')} and ${name(ids.at(-1)!)}`);
</script>

{#if reset}
  <div class="reset prompt panel" role="alertdialog" aria-label="Reset everything to 0–0?">
    {#if iAnswer}
      <strong>{name(reset.proposedBy)} wants to reset everything to 0–0.</strong>
      <span class="muted">Every matchup, player card, leaderboard and award count goes back to zero. The night log and replays stay.</span>
      <div class="two">
        <button disabled={busy} onclick={() => act('reject')}>Keep the scores</button>
        <button class="primary" disabled={busy} onclick={() => act('approve')}>Agree</button>
      </div>
    {:else}
      <strong>Reset everything to 0–0? {reset.approvals.length}/{profiles.length} agreed</strong>
      <span class="muted">Waiting for {list(waiting)} to agree…</span>
      <button class="ghost" disabled={busy} onclick={() => act('reject')}>Call it off</button>
    {/if}
    {#if error}<span class="error" role="alert">{error}</span>{/if}
  </div>
{/if}

<style>
  .reset {
    position: fixed;
    z-index: 70;
    top: max(64px, env(safe-area-inset-top));
    left: 50%;
    translate: -50% 0;
    width: min(360px, calc(100vw - 32px));
    /* Solid, so it reads over whatever screen it lands on. */
    background: rgba(10, 20, 16, 0.97);
    backdrop-filter: blur(6px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55);
    animation: fade-in calc(250ms * var(--speed)) ease-out backwards;
  }
  .prompt {
    display: grid;
    gap: 8px;
    text-align: center;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .muted {
    font-size: 14px;
  }
  .error {
    color: var(--bad, #ff7a5c);
    font-size: 14px;
  }
</style>
