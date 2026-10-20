<script lang="ts">
  import { buzz, type Haptic } from '../lib/juice/haptics';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';

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
        { label: 'All pass (redeal)', play: () => sound.passedOut() },
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
      title: 'Tricks',
      items: [
        { label: 'Trick won', play: () => (sound.lead(2), after(650, () => sound.sweep()), after(1000, () => sound.pip(3))), haptic: 'trick' },
        { label: 'Won with a trump', play: () => (sound.trumpTrick(), after(650, () => sound.sweep()), after(1000, () => sound.pip(4))), haptic: 'trumpTrick' },
        { label: 'First trump!', play: () => (sound.firstTrump(), after(1100, () => sound.sweep()), after(1450, () => sound.pip(5))), haptic: 'firstTrump' },
        { label: 'One trick away', play: () => sound.close() },
        { label: 'Decider', play: () => sound.decider() },
        { label: 'Contract made', play: () => sound.clinch(0), haptic: 'clinch' },
        { label: 'Made, dramatically', play: () => sound.clinch(3), haptic: 'clinch' },
      ],
    },
    {
      title: 'Other',
      items: [
        { label: 'Last trick peek', play: () => [0, 1, 2, 3].forEach((i) => after(i * 200, () => sound.flip())) },
        { label: 'Score ticking', play: () => [0, 2, 4, 5, 7].forEach((s, i) => after(i * 90, () => sound.count(s))) },
        { label: 'Night won', play: () => sound.fanfare() },
      ],
    },
  ];

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
  <h1>Sound check</h1>
  <p class="muted">
    Tap anything to hear it. Best test: join a Messenger call with a friend and ask whether they can hear the game, and whether anything is
    annoying. On an iPhone, the silent switch mutes these sounds.
  </p>

  <div class="volume panel">
    <span>Volume</span>
    <input type="range" min="0" max="1" step="0.05" aria-label="Volume" bind:value={settings.volume} disabled={settings.muted} />
    <button class:on={settings.muted} onclick={() => (settings.muted = !settings.muted)}>{settings.muted ? 'Muted' : 'Mute'}</button>
  </div>

  <button class="primary demo" onclick={demo}>Play a whole trick</button>

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
