<script lang="ts">
  import { buzz } from '../lib/juice/haptics';
  import { settings, type EffectsMode, type PlayStyle, type SpeedMode } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';

  // Spec S16/S17: each player's own feel settings. Also used for the M2 side-by-side check
  // (play a few deals with Effects: Full, then Off).
  let { onClose }: { onClose: () => void } = $props();

  const effects: { value: EffectsMode; label: string }[] = [
    { value: 'full', label: 'Full' },
    { value: 'reduced', label: 'Calm' },
    { value: 'off', label: 'Off' },
  ];
  const styles: { value: PlayStyle; label: string }[] = [
    { value: 'drag', label: 'Drag up' },
    { value: 'tap', label: 'Tap twice' },
  ];
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  const speeds: { value: SpeedMode; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'fast', label: 'Fast' },
  ];
</script>

<div class="sheet panel" role="dialog" aria-label="Settings">
  <div class="row">
    <span>Effects</span>
    <div class="seg">
      {#each effects as e (e.value)}
        <button class:on={settings.effects === e.value} onclick={() => (settings.effects = e.value)}>{e.label}</button>
      {/each}
    </div>
  </div>
  <div class="row">
    <span>Speed</span>
    <div class="seg">
      {#each speeds as s (s.value)}
        <button class:on={settings.speed === s.value} onclick={() => (settings.speed = s.value)}>{s.label}</button>
      {/each}
    </div>
  </div>
  <div class="row">
    <span>Play cards</span>
    <div class="seg">
      {#each styles as p (p.value)}
        <button class:on={settings.playStyle === p.value} onclick={() => (settings.playStyle = p.value)}>{p.label}</button>
      {/each}
    </div>
  </div>
  <div class="row">
    <span>Vibrate</span>
    <div class="seg">
      <button
        class:on={settings.haptics}
        disabled={!canVibrate}
        onclick={() => {
          settings.haptics = true;
          buzz('sold');
        }}>On</button
      >
      <button class:on={!settings.haptics} disabled={!canVibrate} onclick={() => (settings.haptics = false)}>Off</button>
    </div>
  </div>
  <div class="row">
    <span>Sound</span>
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
    Calm keeps fades but no shaking or bursts.{#if !canVibrate} This browser can't vibrate (iPhones can't).{/if} On an iPhone,
    the silent switch also mutes game sounds. These settings are only for this device.
  </p>
  <button class="ghost" onclick={onClose}>Close</button>
</div>

<style>
  .sheet {
    display: grid;
    gap: 10px;
    background: transparent;
    border: 0;
    padding: 4px 0;
  }
  .row {
    display: grid;
    grid-template-columns: 5.5em 1fr;
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
