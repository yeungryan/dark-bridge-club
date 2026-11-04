// The Worker: serves the built client as static assets and forwards /api/* to the one table.
export { TableRoom } from './room';

export interface Env {
  TABLE: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** Secret part of the private link (?k=...). */
  ROOM_KEY: string;
  /** Lets Ryan reset a forgotten PIN. */
  ADMIN_KEY: string;
  /** Tests only: start nights from a fixed seed so they're reproducible. Never set in production. */
  TEST_SEED?: string;
  /** Local checks only: keep this many games instead of KEEP_GAMES. */
  TEST_KEEP_GAMES?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      // A single table for the four of you, so a single, fixed Durable Object.
      const stub = env.TABLE.get(env.TABLE.idFromName('dark-bridge-club'));
      return stub.fetch(request);
    }
    if (url.pathname === '/manifest.webmanifest') return manifest(url.searchParams.get('k') === env.ROOM_KEY ? env.ROOM_KEY : null);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

/**
 * Add to home screen (Ryan, QoL). The app opens at the private link, key included, but only for a
 * request that already holds the right key: a stranger's manifest just opens the sign-in page.
 */
function manifest(key: string | null): Response {
  const body = {
    name: 'DARK Bridge Club',
    short_name: 'DARK Bridge',
    description: "Bridge time? Let's go.",
    start_url: key ? `/?k=${encodeURIComponent(key)}` : '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1c24',
    theme_color: '#0b1c24',
    icons: [
      { src: '/icon-v3-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-v3-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' },
  });
}
