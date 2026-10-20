<script lang="ts">
  import { onMount } from 'svelte';
  import { attachParticleCanvas } from '../lib/juice/particles';

  let canvas: HTMLCanvasElement;
  onMount(() => attachParticleCanvas(canvas));
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 45;
  }
</style>
