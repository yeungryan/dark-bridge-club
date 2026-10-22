<script lang="ts">
  import CrestTile from './CrestTile.svelte';
  import { crestOf } from '../lib/avatars';
  import { fetchProfiles, login, roomKey, type ProfileListing } from '../lib/session';

  // Spec S07: open the private link → tap your name → enter your PIN.
  let { onSignedIn }: { onSignedIn: () => void } = $props();

  let profiles = $state<ProfileListing[]>([]);
  let problem = $state<string | null>(roomKey() ? null : 'Open the private link from the group chat to get in.');
  let chosen = $state<ProfileListing | null>(null);
  let pin = $state('');
  let firstPin = $state<string | null>(null);
  let message = $state<string | null>(null);
  let busy = $state(false);

  if (roomKey()) {
    fetchProfiles()
      .then((p) => (profiles = p))
      .catch((e: Error) => {
        problem = e.message === 'BAD_LINK' ? 'That link is not right. Ask for the private link again.' : 'The club is not reachable right now.';
      });
  }

  const creating = $derived(chosen !== null && !chosen.hasPin);
  const prompt = $derived(
    !creating ? 'Enter your PIN' : firstPin === null ? 'Choose a 4-digit PIN' : 'Type the same PIN again',
  );

  function choose(p: ProfileListing) {
    chosen = p;
    pin = '';
    firstPin = null;
    message = null;
  }

  async function press(digit: string) {
    if (busy || pin.length >= 4) return;
    pin += digit;
    if (pin.length < 4) return;

    if (creating && firstPin === null) {
      firstPin = pin;
      pin = '';
      return;
    }
    if (creating && firstPin !== pin) {
      message = "Those didn't match. Start again.";
      firstPin = null;
      pin = '';
      return;
    }
    busy = true;
    const result = await login(chosen!.id, pin);
    busy = false;
    if (result.ok) onSignedIn();
    else {
      message = result.message;
      pin = '';
    }
  }
</script>

<main>
  <!-- The title is the DARK crest, all four filled (Ryan), the same as in the lobby. -->
  <h1 aria-label="DARK Bridge Club">
    <span class="crest">
      {#each [['D', 'darren'], ['A', 'adrian'], ['R', 'ryan'], ['K', 'kim']] as [letter, id], i (id)}
        {@const c = crestOf(id!, i)}
        <CrestTile letter={letter!} suit={c.suit} team={c.team} size={60} />
      {/each}
    </span>
    <span class="club">Bridge Club</span>
  </h1>

  {#if problem}
    <p class="panel">{problem}</p>
  {:else if !chosen}
    <p class="muted">Who are you?</p>
    <div class="names">
      {#each profiles as p (p.id)}
        <button class="name" style="--c: {p.color}" onclick={() => choose(p)}>{p.name}</button>
      {/each}
    </div>
  {:else}
    <p><button class="ghost" onclick={() => (chosen = null)}>← {chosen.name}</button></p>
    <p aria-live="polite">{prompt}</p>
    <div class="dots" aria-label="{pin.length} of 4 digits">
      {#each [0, 1, 2, 3] as i (i)}<span class:filled={i < pin.length}></span>{/each}
    </div>
    {#if message}<p class="message" role="alert">{message}</p>{/if}
    <div class="pad">
      {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as d (d)}
        <button onclick={() => press(d)} disabled={busy}>{d}</button>
      {/each}
      <span></span>
      <button onclick={() => press('0')} disabled={busy}>0</button>
      <button class="ghost" onclick={() => (pin = pin.slice(0, -1))} aria-label="Delete">⌫</button>
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 380px;
    margin: 0 auto;
    padding: 32px 16px;
    text-align: center;
  }
  h1 {
    display: grid;
    justify-items: center;
    gap: 12px;
    margin: 12px 0 24px;
  }
  .crest {
    display: flex;
    gap: 8px;
  }
  h1 .club {
    display: block;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    font-family: Georgia, serif;
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--ink-dim);
  }
  .names {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .name {
    min-height: 72px;
    font-size: 1.15rem;
    border-left: 6px solid var(--c);
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 14px;
    margin: 12px 0 20px;
  }
  .dots span {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--ink-dim);
  }
  .dots span.filled {
    background: var(--accent);
    border-color: var(--accent);
  }
  .pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .pad button {
    min-height: 60px;
    font-size: 1.4rem;
  }
  .message {
    color: var(--bad);
  }
</style>
