// Ryan (QoL): after a new build goes live, a tab that was open before keeps running the old code
// until it's reloaded. Each build writes version.json (vite.config.ts); an open tab checks it when
// it comes back to the screen and every few minutes, and offers a refresh when it has changed.

const EVERY_MS = 5 * 60 * 1000;

class Update {
  /** The newer build that's live, if there is one (and it hasn't been waved away). */
  ready = $state<string | null>(null);
  private dismissed: string | null = null;
  private started = false;

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void this.check());
    setInterval(() => void this.check(), EVERY_MS);
    void this.check();
  }

  async check(): Promise<void> {
    try {
      const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return; // The dev server has no version.json.
      const { build } = (await res.json()) as { build?: string };
      if (build && build !== __BUILD__ && build !== this.dismissed) this.ready = build;
    } catch {
      // Offline for a moment: the next check will tell.
    }
  }

  later(): void {
    this.dismissed = this.ready;
    this.ready = null;
  }
}

export const update = new Update();
