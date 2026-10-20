<script lang="ts">
  import { onDestroy } from 'svelte';
  import { startAutopilot } from '../lib/autopilot';
  import { Connection } from '../lib/connection.svelte';
  import { forgetLogin, options } from '../lib/session';
  import Lobby from './Lobby.svelte';
  import NightEnded from './NightEnded.svelte';
  import PartnerPick from './PartnerPick.svelte';
  import PauseBanner from './PauseBanner.svelte';
  import Table from './Table.svelte';

  let { onSignedOut }: { onSignedOut: () => void } = $props();

  const conn = new Connection();
  const stopBot = options.bot ? startAutopilot(conn) : null;
  onDestroy(() => stopBot?.());

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

  {#if conn.view.phase === 'lobby'}
    <Lobby {conn} />
  {:else if conn.view.phase === 'partnerPick'}
    <PartnerPick {conn} />
  {:else if conn.view.phase === 'ended'}
    <NightEnded {conn} />
  {:else}
    <Table {conn} />
  {/if}
{/if}

{#if conn.error}<div class="toast" role="alert">{conn.error}</div>{/if}

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
