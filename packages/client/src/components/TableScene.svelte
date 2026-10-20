<script lang="ts">
  import type { ThemeId } from '@dark/engine';

  // Spec S18: each theme gets a sense of place: a quiet scene along the top of the screen
  // (behind the header and the top seat, faint, never behind the cards) that says where you
  // are. Drawn in code, no image files. The top-right corner is Messenger's video anyway.
  let { theme }: { theme: ThemeId } = $props();

  const TREES: [number, number][] = [[262, 118], [282, 128], [96, 126]];
  const FLOWERS: [number, number, number][] = [[22, 128, 0.9], [118, 150, 0.6]];
  const BULBS: [number, number][] = [[20, 30], [60, 46], [100, 52], [140, 48], [180, 36], [220, 26], [260, 18], [300, 16], [340, 22], [380, 32]];
</script>

<div class="scene" aria-hidden="true">
  <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMin slice">
    {#if theme === 'clubhouse'}
      <!-- A banker's lamp hanging over the table, and its pool of light. -->
      <defs>
        <radialGradient id="lamp-glow" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stop-color="#ffd98c" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#ffd98c" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path d="M120 70 L280 70 L400 240 L0 240 Z" fill="url(#lamp-glow)" />
      <line x1="200" y1="0" x2="200" y2="40" stroke="#c9a45c" stroke-width="1.5" opacity="0.6" />
      <path d="M168 66 Q200 34 232 66 Z" fill="#1f6b46" opacity="0.85" />
      <rect x="166" y="64" width="68" height="4" rx="2" fill="#c9a45c" opacity="0.9" />
      <ellipse cx="200" cy="70" rx="22" ry="3" fill="#fff2c6" opacity="0.8" />
      <!-- Wood panelling along the top. -->
      <g opacity="0.12" stroke="#c9a45c" fill="none">
        <rect x="8" y="8" width="70" height="44" rx="2" />
        <rect x="86" y="8" width="62" height="44" rx="2" />
      </g>
    {:else if theme === 'marina'}
      <!-- Sunset over the bay: the three towers with the ship on top, Supertrees, the water. -->
      <circle cx="250" cy="150" r="46" fill="#ffb38a" opacity="0.28" />
      <g fill="#04222b" opacity="0.7">
        <path d="M132 160 L136 92 L150 92 L152 160 Z" />
        <path d="M160 160 L163 88 L177 88 L180 160 Z" />
        <path d="M188 160 L190 84 L204 84 L208 160 Z" />
        <path d="M122 84 Q170 76 226 80 L228 88 L122 92 Z" />
        <rect x="40" y="128" width="26" height="32" />
        <rect x="70" y="118" width="18" height="42" />
        <rect x="236" y="122" width="22" height="38" />
        <rect x="300" y="110" width="30" height="50" />
        <rect x="334" y="126" width="22" height="34" />
      </g>
      <g fill="#0a3a45" opacity="0.75">
        {#each TREES as [x, top] (x)}
          <path d="M{x - 14} {top} L{x + 14} {top} L{x + 2} {top + 20} L{x + 2} 160 L{x - 2} 160 L{x - 2} {top + 20} Z" />
        {/each}
      </g>
      <rect x="0" y="160" width="400" height="80" fill="#0a3a45" opacity="0.35" />
      <g stroke="#ffb38a" opacity="0.25" stroke-width="1.5">
        <line x1="210" y1="172" x2="290" y2="172" />
        <line x1="225" y1="182" x2="275" y2="182" />
        <line x1="238" y1="192" x2="262" y2="192" />
      </g>
    {:else if theme === 'shibuya'}
      <!-- Towers with lit windows, and a neon sign hung on the edge building: ブリッジ ("bridge"). -->
      <defs>
        <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g fill="#0b0618" opacity="0.85">
        <rect x="0" y="40" width="56" height="200" />
        <rect x="60" y="80" width="44" height="160" />
        <rect x="300" y="60" width="50" height="180" />
        <rect x="352" y="96" width="48" height="144" />
      </g>
      <g fill="#ffd36b" opacity="0.25">
        {#each [0, 1, 2, 3, 4, 5] as r (r)}
          {#each [0, 1, 2] as c (c)}
            {#if (r + c) % 3 !== 1}<rect x={66 + c * 13} y={96 + r * 18} width="6" height="9" />{/if}
          {/each}
        {/each}
      </g>
      <g filter="url(#neon)" fill="none" stroke-linecap="round">
        <rect x="10" y="52" width="32" height="136" rx="5" stroke="#ff3ea5" stroke-width="2" opacity="0.8" />
        <text x="26" y="64" fill="#ff7fc8" stroke="none" font-size="20" font-family="'Hiragino Sans', 'Noto Sans JP', sans-serif" text-anchor="middle" writing-mode="tb" opacity="0.95"
          >ブリッジ</text
        >
      </g>
    {:else if theme === 'berlin'}
      <!-- Night skyline: the TV tower, the Brandenburg Gate, a moon. -->
      <circle cx="96" cy="44" r="12" fill="#efe9dc" opacity="0.5" />
      <circle cx="101" cy="40" r="11" fill="var(--felt)" opacity="1" />
      <g fill="#060a18" opacity="0.8">
        <rect x="56" y="34" width="3" height="40" />
        <circle cx="57.5" cy="80" r="10" />
        <path d="M54 88 L61 88 L64 170 L51 170 Z" />
        <rect x="150" y="128" width="100" height="10" />
        <rect x="146" y="138" width="108" height="6" />
        {#each [0, 1, 2, 3, 4, 5] as i (i)}<rect x={152 + i * 18} y="144" width="7" height="26" />{/each}
        <path d="M186 128 L200 112 L214 128 Z" />
        <rect x="0" y="146" width="44" height="24" />
        <rect x="270" y="138" width="40" height="32" />
        <rect x="312" y="150" width="88" height="20" />
      </g>
      <line x1="0" y1="170" x2="400" y2="170" stroke="#c9a45c" stroke-width="1" opacity="0.3" />
    {:else if theme === 'bali'}
      <!-- A split temple gate (candi bentar), palms, and frangipani. -->
      <g fill="#1c0f06" opacity="0.7">
        <path d="M150 170 L150 130 L156 130 L156 112 L162 112 L162 96 L168 96 L168 80 L176 80 L176 70 L184 70 L184 170 Z" />
        <path d="M250 170 L250 130 L244 130 L244 112 L238 112 L238 96 L232 96 L232 80 L224 80 L224 70 L216 70 L216 170 Z" />
        <path d="M60 170 Q66 120 58 74 L62 74 Q72 120 66 170 Z" />
        <path d="M60 76 Q36 66 22 80 Q42 72 60 80 Q48 58 34 52 Q56 58 62 76 Q74 56 92 54 Q74 64 64 78 Q86 70 100 82 Q80 76 62 80 Z" />
      </g>
      <line x1="0" y1="170" x2="400" y2="170" stroke="#f2c14e" stroke-width="1" opacity="0.25" />
      {#each FLOWERS as [x, y, s] (x)}
        <g transform="translate({x} {y}) scale({s})" opacity="0.75">
          {#each [0, 72, 144, 216, 288] as a (a)}
            <ellipse cx="0" cy="-9" rx="6" ry="10" fill="#fff4e0" transform="rotate({a})" />
          {/each}
          <circle r="4" fill="#f2c14e" />
        </g>
      {/each}
    {:else if theme === 'manila'}
      <!-- String lights over the bed, a pillow, and the electric fan in the corner. -->
      <path d="M-10 18 Q100 70 200 30 Q300 -6 410 40" fill="none" stroke="#0e1124" stroke-width="1.5" opacity="0.8" />
      {#each BULBS as [x, y] (x)}
        <circle cx={x} cy={y + 6} r="9" fill="#ffd36b" opacity="0.18" />
        <circle cx={x} cy={y + 6} r="3.2" fill="#ffe7a8" opacity="0.95" />
      {/each}
      <g opacity="0.55">
        <rect x="14" y="92" width="96" height="44" rx="20" fill="#e9e4f5" opacity="0.35" />
        <path d="M24 114 Q62 106 100 114" stroke="#c8c6dc" fill="none" opacity="0.5" />
      </g>
      <g opacity="0.5" stroke="#c8c6dc" fill="none" stroke-width="1.5">
        <circle cx="356" cy="140" r="22" />
        <circle cx="356" cy="140" r="4" fill="#c8c6dc" />
        <path d="M356 140 L340 128 M356 140 L372 128 M356 140 L356 160" stroke-width="3" opacity="0.6" />
        <line x1="356" y1="162" x2="356" y2="236" />
        <ellipse cx="356" cy="238" rx="16" ry="3" />
      </g>
    {/if}
  </svg>
</div>

<style>
  .scene {
    position: fixed;
    inset: 0 0 auto 0;
    height: 240px;
    z-index: -1;
    pointer-events: none;
    /* Fade out towards the table, so the scene never competes with the cards. */
    mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
