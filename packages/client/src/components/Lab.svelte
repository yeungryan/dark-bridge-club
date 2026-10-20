<script lang="ts">
  import { buzz, type Haptic } from '../lib/juice/haptics';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import { elementBurst, elementStrike, elementWin, flash, freeze, glyphs, lightBurst, pop, puff, ribbons, ring, screenFlash, sparks, type Element } from '../lib/juice/particles';
  import Particles from './Particles.svelte';
  import TableScene from './TableScene.svelte';
  import { applyTheme, THEMES } from '../lib/themes';
  import type { ThemeId } from '@dark/engine';

  let previewing = $state<ThemeId>('clubhouse');
  function preview(id: ThemeId) {
    previewing = id;
    applyTheme(id);
    sound.sold();
  }

  // lab.html: every game sound (and vibration) on its own button, to check volume on your
  // phone, ideally while on a Messenger call: can the others hear it? Is anything annoying?
  interface Item {
    label: string;
    play: () => void;
    haptic?: Haptic;
  }
  const after = (ms: number, fn: () => void) => setTimeout(fn, ms);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Bidding',
      items: [
        { label: 'Button press', play: () => sound.tap(), haptic: 'tap' },
        { label: 'Bid 1♣', play: () => sound.stamp(1, true), haptic: 'tap' },
        { label: 'Bid 4♠', play: () => sound.stamp(4, true), haptic: 'tap' },
        { label: 'Bid 7NT', play: () => sound.stamp(7, true), haptic: 'tap' },
        { label: 'Pass', play: () => sound.pass(true), haptic: 'tap' },
        { label: 'Going once', play: () => sound.going(1) },
        { label: 'Going twice', play: () => sound.going(2) },
        { label: 'Sold!', play: () => sound.sold(), haptic: 'sold' },
        { label: 'All pass (new game)', play: () => sound.passedOut() },
      ],
    },
    {
      title: 'Cards',
      items: [
        { label: 'Your card', play: () => sound.card(true), haptic: 'card' },
        { label: "Someone else's", play: () => sound.card(false) },
        { label: 'Takes the lead', play: () => (sound.card(true), sound.lead(1)), haptic: 'lead' },
        { label: '…takes it back', play: () => (sound.card(true), sound.lead(2)), haptic: 'lead' },
        { label: 'Trumps in', play: () => (sound.card(true), sound.trumpIn()), haptic: 'trumpIn' },
        { label: "Can't play that", play: () => sound.no(), haptic: 'no' },
      ],
    },
    {
      title: 'Sets',
      items: [
        { label: 'Set won', play: () => (sound.lead(2), after(650, () => sound.sweep()), after(1000, () => sound.pip(3))), haptic: 'trick' },
        { label: 'Won with a trump', play: () => (sound.trumpTrick(), after(650, () => sound.sweep()), after(1000, () => sound.pip(4))), haptic: 'trumpTrick' },
        { label: 'First trump!', play: () => (sound.firstTrump(), after(1100, () => sound.sweep()), after(1450, () => sound.pip(5))), haptic: 'firstTrump' },
        { label: 'One set away', play: () => sound.close() },
        { label: 'Decider', play: () => sound.decider() },
        { label: 'Contract made', play: () => sound.clinch(0), haptic: 'clinch' },
        { label: 'Made, dramatically', play: () => sound.clinch(3), haptic: 'clinch' },
      ],
    },
    {
      title: 'Juice',
      items: [
        { label: 'Pick up a card', play: () => sound.pickup() },
        { label: 'Combo ×2 → ×6', play: () => [1, 2, 3, 4, 5].forEach((n, i) => after(i * 420, () => (sound.lead(2), sound.combo(n)))) },
        { label: 'Impact (small)', play: () => sound.impact(0) },
        { label: 'Impact (big)', play: () => sound.impact(3), haptic: 'clinch' },
        { label: 'Tension (decider)', play: () => sound.riser(0.9) },
        { label: 'Whoosh', play: () => sound.whoosh() },
      ],
    },
    {
      title: 'Other',
      items: [
        { label: 'Last set peek', play: () => [0, 1, 2, 3].forEach((i) => after(i * 200, () => sound.flip())) },
        { label: 'Score ticking', play: () => [0, 2, 4, 5, 7].forEach((s, i) => after(i * 90, () => sound.count(s))) },
        { label: 'Night won', play: () => sound.fanfare() },
      ],
    },
  ];

  // Effects play from the middle of the button you tapped.
  type Fx = { label: string; play: (x: number, y: number) => void };
  const effects: Fx[] = [
    { label: 'Takes the lead (sparks)', play: (x, y) => (sound.lead(1), sparks(x, y, 12, ['#3fb27f', '#e8c25a', '#fff6d8'])) },
    { label: 'Set won (glow)', play: (x, y) => (sound.lead(2), flash(x, y, '#e8c25a', 42)) },
    { label: 'Trumps in (shockwave)', play: (x, y) => (sound.trumpIn(), ring(x, y, '#c58bff', { radius: 80, width: 4 }), glyphs(x, y, 8, '♠', ['#c58bff', '#f2e6ff'], 'shower')) },
    { label: 'Won with a trump', play: (x, y) => (sound.trumpTrick(), flash(x, y, '#c58bff', 46), glyphs(x, y, 7, '♥', ['#c58bff', '#f2e6ff'], 'rise')) },
    { label: 'First trump!', play: (x, y) => (sound.firstTrump(), ring(x, y, '#c58bff', { radius: 120, width: 5, frames: 30 }), glyphs(x, y, 22, '♦', ['#c58bff', '#f2e6ff', '#e8c25a'], 'shower')) },
    { label: 'Light burst', play: (x, y) => (sound.lead(2), lightBurst(x, y, ['#e8c25a', '#fff6d8'], 0)) },
    {
      label: 'Combo ×2 → ×6',
      play: (x, y) =>
        [1, 2, 3, 4, 5].forEach((n, i) =>
          after(i * 420, () => {
            sound.lead(2);
            sound.combo(n);
            lightBurst(x, y, ['#e8c25a', '#fff6d8', '#ff9a3a'], Math.min(3, n - 1));
          }),
        ),
    },
    {
      label: 'Hit-stop (freeze-frame)',
      play: (x, y) => {
        sound.impact(3);
        lightBurst(x, y, ['#e8c25a', '#fffbe8'], 3);
        elementStrike('fire', x, y, 2);
        screenFlash('#e8c25a', 0.35);
        freeze(130);
      },
    },
    { label: 'Score pop', play: (x, y) => (sound.pip(4), pop(x, y, '#e8c25a')) },
    { label: 'Sold! (stamp puff)', play: (x, y) => (sound.sold(), puff(x, y, 12, '#d8c38f')) },
    { label: 'Night won (confetti)', play: (x, y) => (sound.fanfare(), ribbons(x, y, 120, ['#3fb27f', '#3a8fe0', '#e8c25a', '#fbf8f0'])) },
  ];
  const elements: { element: Element; label: string }[] = [
    { element: 'fire', label: '🔥 Fire clinch' },
    { element: 'air', label: '🌬️ Air clinch' },
    { element: 'water', label: '🌊 Water clinch' },
    { element: 'earth', label: '🪨 Earth clinch' },
  ];
  const center = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2] as const;
  };

  function run(item: Item) {
    item.play();
    if (item.haptic) buzz(item.haptic);
  }

  /** A whole trick, start to finish, at game speed. */
  function demo() {
    sound.card(false);
    after(700, () => (sound.card(true), sound.lead(1)));
    after(1400, () => (sound.card(false), sound.trumpIn()));
    after(2100, () => sound.card(false));
    after(2350, () => (sound.firstTrump(), buzz('firstTrump')));
    after(3450, () => sound.sweep());
    after(3800, () => sound.pip(5));
  }
</script>

<main>
  <h1>Sound &amp; effects check</h1>
  <p class="muted">
    Tap anything to hear it. Best test: join a Messenger call with a friend and ask whether they can hear the game, and whether anything is
    annoying. On an iPhone, the silent switch mutes these sounds.
  </p>

  <div class="volume panel">
    <span>Volume</span>
    <input type="range" min="0" max="1" step="0.05" aria-label="Volume" bind:value={settings.volume} disabled={settings.muted} />
    <button class:on={settings.muted} onclick={() => (settings.muted = !settings.muted)}>{settings.muted ? 'Muted' : 'Mute'}</button>
  </div>

  <button class="primary demo" onclick={demo}>Play a whole set</button>

  <h2>Themes</h2>
  <p class="muted small">Tap to restyle this page (sounds retune too), or practise a whole night in one.</p>
  <div class="grid">
    {#each Object.values(THEMES) as t (t.id)}
      <div class="theme" class:on={previewing === t.id}>
        <button onclick={() => preview(t.id)}>{t.name}<br /><small>{t.place}</small></button>
        <a href="practice.html?theme={t.id}">practise →</a>
      </div>
    {/each}
  </div>

  <h2>Effects</h2>
  <p class="muted small">Each moment has its own look; confetti is only for winning the night. Effects must be on Full.</p>
  <div class="grid">
    {#each effects as fx (fx.label)}
      <button onclick={(e) => fx.play(...center(e))}>{fx.label}</button>
    {/each}
  </div>
  <h2>Winning a set, by element</h2>
  <p class="muted small">Left: a normal win. Right: a win by trumping a different suit.</p>
  <div class="grid">
    {#each [['fire', '🔥 Fireball', '⚡ Lightning'], ['air', '🌪️ Tornado', '🔊 Sound'], ['water', '🌊 Tsunami', '❄️ Ice'], ['earth', '🪨 Rock smash', '⚙️ Metal']] as [el, win, strike] (el)}
      <button onclick={(e) => (sound.lead(2), elementWin(el as Element, ...center(e)))}>{win}</button>
      <button onclick={(e) => (sound.trumpTrick(), elementStrike(el as Element, ...center(e)))}>{strike}</button>
    {/each}
  </div>
  <h2>Element clinches (your avatar's signature)</h2>
  <div class="grid">
    {#each elements as el (el.element)}
      <button
        onclick={(e) => {
          sound.clinch(1);
          buzz('clinch');
          elementBurst(el.element, ...center(e), 1);
        }}>{el.label}</button
      >
    {/each}
  </div>

  {#each groups as g (g.title)}
    <h2>{g.title}</h2>
    <div class="grid">
      {#each g.items as item (item.label)}
        <button onclick={() => run(item)}>{item.label}</button>
      {/each}
    </div>
  {/each}

  <p class="muted"><a href="practice.html">Practice table →</a> (you against three bots; nothing is recorded)</p>
</main>
<Particles />
<TableScene theme={previewing} />

<style>
  main {
    max-width: 520px;
    margin: 0 auto;
    padding: 16px 16px 40px;
  }
  h1 {
    margin: 4px 0;
  }
  h2 {
    font-size: 1rem;
    margin: 18px 0 8px;
    color: var(--accent);
  }
  .theme {
    display: grid;
    gap: 2px;
    text-align: center;
  }
  .theme button {
    min-height: 56px;
    width: 100%;
  }
  .theme.on button {
    outline: 3px solid var(--accent);
  }
  .theme a {
    font-size: 13px;
  }
  .small {
    font-size: 13px;
    margin: 0 0 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .grid button {
    min-height: 48px;
  }
  .volume {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 12px 0;
  }
  .volume input {
    flex: 1;
    accent-color: var(--accent);
  }
  .on {
    outline: 3px solid var(--accent);
  }
  .demo {
    width: 100%;
    min-height: 52px;
  }
  a {
    color: var(--accent);
  }
</style>
