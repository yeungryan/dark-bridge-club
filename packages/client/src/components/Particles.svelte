<script lang="ts">
  import { onMount } from 'svelte';
  import { attachParticleCanvas } from '../lib/juice/particles';

  let canvas: HTMLCanvasElement;
  let wash: HTMLElement;
  onMount(() => attachParticleCanvas(canvas, wash));
</script>

<!-- Big hits wash the screen with light. Screen-blended, it only brightens what's under it
     (a plain tint would grey the table out). -->
<div class="wash" bind:this={wash} aria-hidden="true"></div>
<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  .wash {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 44;
    mix-blend-mode: screen;
  }
  canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 45;
  }
</style>
