<script lang="ts">
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Gauge from '@lucide/svelte/icons/gauge';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import VolumeX from '@lucide/svelte/icons/volume-x';
  import { settings, type EffectsMode, type SpeedMode } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';

  // Spec S16/S17: each player's own feel settings. Also used for the M2 side-by-side check
  // (play a few deals with Effects: Full, then Off).
  let { onClose }: { onClose: () => void } = $props();

  const effects: { value: EffectsMode; label: string }[] = [
    { value: 'full', label: 'Full' },
    { value: 'reduced', label: 'Calm' },
    { value: 'off', label: 'Off' },
  ];
  const speeds: { value: SpeedMode; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'fast', label: 'Fast' },
  ];
</script>

<div class="sheet panel" role="dialog" aria-label="Settings">
  <div class="row">
    <span class="label"><Sparkles size={18} strokeWidth={1.75} aria-hidden="true" /> Effects</span>
    <div class="seg">
      {#each effects as e (e.value)}
        <button class:on={settings.effects === e.value} onclick={() => (settings.effects = e.value)}>{e.label}</button>
      {/each}
    </div>
  </div>
  <div class="row">
    <span class="label"><Gauge size={18} strokeWidth={1.75} aria-hidden="true" /> Speed</span>
    <div class="seg">
      {#each speeds as s (s.value)}
        <button class:on={settings.speed === s.value} onclick={() => (settings.speed = s.value)}>{s.label}</button>
      {/each}
    </div>
  </div>
  <div class="row">
    <span class="label">{#if settings.muted}<VolumeX size={18} strokeWidth={1.75} aria-hidden="true" />{:else}<Volume2 size={18} strokeWidth={1.75} aria-hidden="true" />{/if} Sound</span>
    <div class="sound">
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        aria-label="Volume"
        bind:value={settings.volume}
        disabled={settings.muted}
        onchange={() => sound.sold()}
      />
      <button class:on={settings.muted} onclick={() => (settings.muted = !settings.muted)}>{settings.muted ? 'Muted' : 'Mute'}</button>
    </div>
  </div>
  <p class="muted">
    Calm keeps fades but no shaking or bursts. On an iPhone,
    the silent switch also mutes game sounds. These settings are only for this device.
  </p>
  <button class="ghost" onclick={onClose}>Close</button>
  <!-- The animal art's licence (CC-BY 4.0) asks for a credit. -->
  <p class="credit">
    Animal art: <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener">Twemoji</a>,
    <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC-BY 4.0</a>
  </p>
</div>

<style>
  .credit {
    margin: 0;
    text-align: center;
    font-size: 11px;
    color: var(--ink-dim);
  }
  .credit a {
    color: inherit;
  }
  .sheet {
    display: grid;
    gap: 10px;
    background: transparent;
    border: 0;
    padding: 4px 0;
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .row {
    display: grid;
    grid-template-columns: 7.2em 1fr;
    align-items: center;
    gap: 8px;
  }
  .seg {
    display: flex;
    gap: 4px;
  }
  .seg button {
    flex: 1;
    padding: 0 6px;
  }
  .on {
    outline: 3px solid var(--accent);
  }
  .sound {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  input[type='range'] {
    flex: 1;
    accent-color: var(--accent);
  }
  p {
    margin: 0;
    font-size: 13px;
  }
</style>
