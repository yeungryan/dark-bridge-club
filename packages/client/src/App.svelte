<script lang="ts">
  import Game from './components/Game.svelte';
  import Login from './components/Login.svelte';
  import { login, options, roomKey, token } from './lib/session';

  const hadLogin = !!token();
  let signedIn = $state(hadLogin);

  // Four-seat test page: sign in automatically with the PIN in the address.
  if (!hadLogin && options.autoProfile && options.autoPin && roomKey()) {
    login(options.autoProfile, options.autoPin).then((r) => (signedIn = r.ok));
  }
</script>

{#if signedIn}
  <Game onSignedOut={() => (signedIn = false)} />
{:else}
  <Login onSignedIn={() => (signedIn = true)} />
{/if}
