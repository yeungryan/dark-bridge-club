// The Worker: serves the built client as static assets and forwards /api/* to the one table.
export { TableRoom } from './room';

export interface Env {
  TABLE: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** Secret part of the private link (?k=...). */
  ROOM_KEY: string;
  /** Lets Ryan reset a forgotten PIN. */
  ADMIN_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      // A single table for the four of you, so a single, fixed Durable Object.
      const stub = env.TABLE.get(env.TABLE.idFromName('dark-bridge-club'));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
