<script lang="ts">
  import { onDestroy } from 'svelte';
  import { startAutopilot } from '../lib/autopilot';
  import { Connection } from '../lib/connection.svelte';
  import { director } from '../lib/juice/director.svelte';
  import { settings } from '../lib/juice/settings.svelte';
  import { TIMING } from '../lib/juice/timing';
  import { forgetLogin, options, rememberMe } from '../lib/session';
  import { applyTheme } from '../lib/themes';
  import Lobby from './Lobby.svelte';
  import NightEnded from './NightEnded.svelte';
  import PartnerPick from './PartnerPick.svelte';
  import Particles from './Particles.svelte';
  import PauseBanner from './PauseBanner.svelte';
  import ResetPrompt from './ResetPrompt.svelte';
  import SweepTakeover from './SweepTakeover.svelte';
  import Table from './Table.svelte';
  import TableScene from './TableScene.svelte';

  // `link`: the practice table passes its own in-browser table; otherwise we connect to the server.
  let { onSignedOut, link }: { onSignedOut: () => void; link?: Connection } = $props();

  // svelte-ignore state_referenced_locally
  const conn = link ?? new Connection();
  director.attach(conn);
  const stopBot = options.bot ? startAutopilot(conn) : null;
  onDestroy(() => stopBot?.());

  // When the night starts, the lobby stays up a moment so the completed crest can flare (S15).
  let flaring = $state(false);
  let lastPhase: string | null = null;
  $effect(() => {
    const phase = conn.view?.phase ?? null;
    if (lastPhase === 'lobby' && phase !== 'lobby' && settings.animated) {
      flaring = true;
      setTimeout(() => (flaring = false), settings.ms(TIMING.ceremony.crestFlare));
    }
    lastPhase = phase;
  });

  // Tonight's theme (S18) restyles every screen.
  $effect(() => {
    if (conn.room) applyTheme(conn.room.theme);
  });

  // Remember who's signed in here, so the practice table seats them as themselves (not Ryan).
  $effect(() => {
    if (!link && conn.view?.me) rememberMe(conn.view.me);
  });

  $effect(() => {
    if (conn.status === 'signedOut') {
      forgetLogin();
      onSignedOut();
    }
  });
</script>

{#if conn.status === 'replaced'}
  <div class="center panel">
    <p>You continued on another device.</p>
    <button onclick={() => location.reload()}>Use this device instead</button>
  </div>
{:else if !conn.view || !conn.room}
  <div class="center muted">Connecting to the club…</div>
{:else}
  {#if options.bot}<div class="bot-tag">🤖 bot</div>{/if}
  {#if conn.status === 'reconnecting'}<div class="status">Reconnecting…</div>{/if}
  <PauseBanner {conn} />

  {#if conn.view.phase === 'lobby' || flaring}
    <Lobby {conn} complete={flaring} />
  {:else if conn.view.phase === 'partnerPick'}
    <PartnerPick {conn} />
  {:else if conn.view.phase === 'ended'}
    <NightEnded {conn} />
  {:else}
    <Table {conn} />
  {/if}
{/if}

{#if conn.view && conn.room}<ResetPrompt {conn} />{/if}
<!-- A sweep's takeover (round 15): over everything, straight after the game-winning effects. -->
{#if director.sweepShow}{#key director.sweepShow.id}<SweepTakeover show={director.sweepShow} />{/key}{/if}
{#if conn.error}<div class="toast" role="alert">{conn.error}</div>{/if}
<Particles />
{#if conn.room}<TableScene theme={conn.room.theme} />{/if}

<style>
  .center {
    max-width: 360px;
    margin: 30vh auto 0;
    text-align: center;
  }
  .status {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    text-align: center;
    background: #6b4e12;
    font-size: 14px;
    padding: 4px;
    z-index: 30;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    background: #2b1b17;
    border: 1px solid var(--bad);
    padding: 10px 16px;
    border-radius: 10px;
    z-index: 40;
    max-width: calc(100% - 32px);
  }
  .bot-tag {
    position: fixed;
    bottom: 4px;
    right: 6px;
    font-size: 12px;
    opacity: 0.7;
    z-index: 50;
  }
</style>
