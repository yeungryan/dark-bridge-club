<script lang="ts">
  import type { Connection } from '../lib/connection.svelte';
  import { pairNames } from '../lib/format';
  import { themeOf } from '../lib/themes';
  import SettingsSheet from './SettingsSheet.svelte';

  // The table menu (S10): a sheet that rises from the bottom, within thumb reach, over a dimmed
  // table. Tap outside to close. Settings open inside it.
  let { conn, canConcede, onClose }: { conn: Connection; canConcede: boolean; onClose: () => void } = $props();

  const view = $derived(conn.view!);
  const room = $derived(conn.room!);
  const theme = $derived(themeOf(room.theme));
  const votes = $derived(view.endNightVotes.length);
  const voted = $derived(view.endNightVotes.includes(view.me));
  let page = $state<'menu' | 'settings'>('menu');

  function act(fn: () => void) {
    fn();
    onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}></div>
<div class="sheet" role="dialog" aria-label="Menu">
  <div class="handle" aria-hidden="true"></div>
  {#if page === 'settings'}
    <button class="ghost back" onclick={() => (page = 'menu')}>‹ Menu</button>
    <SettingsSheet onClose={() => (page = 'menu')} />
  {:else}
    <div class="night">
      <span class="theme">{theme.name} <small>{theme.place}</small></span>
      {#if view.pairs}
        <span class="score">
          {pairNames(view, room.profiles, 'A')} <strong>{view.wins.A}</strong> · <strong>{view.wins.B}</strong>
          {pairNames(view, room.profiles, 'B')}
        </span>
      {/if}
    </div>

    <button class="row" disabled={!canConcede} onclick={() => act(() => conn.intent({ type: 'deal', action: { type: 'proposeConcession' } }))}>
      <span class="icon" aria-hidden="true">🏳️</span>
      <span class="text"><strong>Concede the rest of this deal</strong><small>{canConcede ? 'Your partner has to agree' : 'Only while cards are being played'}</small></span>
    </button>

    {#if voted}
      <button class="row" onclick={() => act(() => conn.intent({ type: 'cancelEndNight' }))}>
        <span class="icon" aria-hidden="true">↩️</span>
        <span class="text"><strong>Take back my vote to end</strong><small>{votes}/4 want to end the night</small></span>
      </button>
    {:else}
      <button class="row" onclick={() => act(() => conn.intent({ type: 'voteEndNight' }))}>
        <span class="icon" aria-hidden="true">🌙</span>
        <span class="text"><strong>End the night</strong><small>All four have to agree{votes ? ` · ${votes}/4 so far` : ''}</small></span>
      </button>
    {/if}

    <button class="row" onclick={() => (page = 'settings')}>
      <span class="icon" aria-hidden="true">⚙️</span>
      <span class="text"><strong>Settings</strong><small>Effects, speed, playing cards, sound, vibration</small></span>
    </button>

    <a class="row" href="lab.html" target="_blank" rel="noopener">
      <span class="icon" aria-hidden="true">🔊</span>
      <span class="text"><strong>Sound &amp; effects check</strong><small>Opens in a new tab</small></span>
    </a>

    <button class="close" onclick={onClose}>Close</button>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.5);
    animation: fade-in calc(160ms * var(--speed)) ease-out;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 41;
    max-width: 560px;
    margin: 0 auto;
    max-height: 85dvh;
    overflow-y: auto;
    display: grid;
    gap: 8px;
    padding: 8px 16px max(16px, env(safe-area-inset-bottom));
    background: var(--sheet);
    border: 1px solid var(--line);
    border-bottom: 0;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.45);
    animation: rise calc(260ms * var(--speed)) cubic-bezier(0.2, 0.9, 0.3, 1.05);
  }
  @keyframes rise {
    0% {
      transform: translateY(100%);
    }
  }
  :global(.fx-reduced) .sheet {
    animation-name: fade-in;
  }
  .handle {
    justify-self: center;
    width: 40px;
    height: 5px;
    border-radius: 3px;
    background: var(--line);
    margin-bottom: 4px;
  }
  .night {
    display: grid;
    gap: 2px;
    text-align: center;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 2px;
  }
  .theme {
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--accent);
  }
  .theme small {
    color: var(--ink-dim);
    font-family: var(--font);
    font-weight: 400;
  }
  .score {
    font-size: 14px;
    color: var(--ink-dim);
  }
  .score strong {
    color: var(--ink);
  }
  .row {
    display: grid;
    grid-template-columns: 36px 1fr;
    align-items: center;
    gap: 10px;
    text-align: left;
    min-height: 60px;
    padding: 8px 12px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--felt-light);
    color: var(--ink);
    text-decoration: none;
    font: inherit;
  }
  .row:active:not(:disabled) {
    transform: scale(0.98);
  }
  .icon {
    font-size: 22px;
    text-align: center;
  }
  .text {
    display: grid;
  }
  .text small {
    color: var(--ink-dim);
    font-size: 13px;
  }
  .close,
  .back {
    justify-self: stretch;
  }
  .back {
    justify-self: start;
    min-height: 36px;
  }
</style>
