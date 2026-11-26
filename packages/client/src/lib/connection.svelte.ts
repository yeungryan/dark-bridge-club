import type { AvatarPick, ClientIntent, ClientMessage, PublicEvent, RoomInfo, ServerMessage, TableView } from '@dark/engine';
import { checkLogin, token } from './session';

// Spec S08: a WebSocket that shrugs off locked screens and app switches.
// Every server message carries the full view, so after any reconnect we're instantly current.

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'signedOut';

const BACKOFF_MS = [500, 1000, 2000, 4000, 8000];
/** Heartbeat (round 23): a "ping" this often; the server's runtime answers "pong" by itself. */
const PING_MS = 15_000;
/** No "pong" for this long: the connection is dead even if it still looks open. */
const DEAD_MS = 35_000;
/** Coming back to the app: if the connection doesn't answer within this, reconnect at once. */
const RETURN_CHECK_MS = 3_000;

export class Connection {
  status = $state<ConnectionStatus>('connecting');
  view = $state<TableView | null>(null);
  room = $state<RoomInfo | null>(null);
  /** Your own private avatar pick (S24), while in the lobby. */
  myAvatar = $state<AvatarPick | null>(null);
  error = $state<string | null>(null);
  /** Server clock minus local clock, for countdowns. */
  clockOffset = 0;

  private ws: WebSocket | null = null;
  private attempt = 0;
  private seq = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(events: readonly PublicEvent[]) => void>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private returnCheck: ReturnType<typeof setTimeout> | null = null;
  private lastPong = 0;

  /** `offline`: no server (the practice table drives this connection itself). */
  readonly offline: boolean;

  constructor(offline = false) {
    this.offline = offline;
    if (offline) {
      this.status = 'open';
      return;
    }
    document.addEventListener('visibilitychange', () => {
      this.sendScreen();
      if (document.visibilityState !== 'visible') return;
      if (this.status === 'reconnecting') return this.reconnectNow();
      // Back in the app: a phone may wake up holding a connection that died while it slept
      // (iPhone), so check it now rather than waiting for the next heartbeat.
      if (this.status === 'open') this.checkAlive(RETURN_CHECK_MS);
    });
    window.addEventListener('online', () => this.reconnectNow());
    this.open();
  }

  /** Server-side "now", for countdown bars. */
  now(): number {
    return Date.now() + this.clockOffset;
  }

  onEvents(listener: (events: readonly PublicEvent[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  intent(intent: ClientIntent): void {
    this.send({ type: 'intent', intent });
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
    else this.showError('Not connected. Retrying…');
  }

  private open(): void {
    const t = token();
    if (!t) {
      this.status = 'signedOut';
      return;
    }
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${scheme}://${location.host}/api/ws?token=${encodeURIComponent(t)}`);
    this.ws = ws;
    let opened = false;

    ws.onopen = () => {
      opened = true;
      this.attempt = 0;
      this.status = 'open';
      this.lastPong = Date.now();
      this.sendScreen();
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return;
        if (Date.now() - this.lastPong > DEAD_MS) return this.drop(ws);
        ws.send('ping');
      }, PING_MS);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') {
        this.lastPong = Date.now();
        return;
      }
      this.receive(JSON.parse(e.data as string) as ServerMessage);
    };
    ws.onclose = async (e) => {
      if (this.ws !== ws) return;
      if (e.code === 4001) {
        this.status = 'replaced';
        return;
      }
      if (!opened && !(await checkLogin())) {
        this.status = 'signedOut';
        return;
      }
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.status = 'reconnecting';
      this.scheduleRetry();
    };
  }

  /** Whether the game is on this screen, so the others can see "on another screen" (round 23). */
  private sendScreen(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'screen', hidden: document.visibilityState === 'hidden' } satisfies ClientMessage));
  }

  /** Ping now; if nothing comes back within `ms`, the connection is dead: reconnect. */
  private checkAlive(ms: number): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const asked = Date.now();
    ws.send('ping');
    if (this.returnCheck) clearTimeout(this.returnCheck);
    this.returnCheck = setTimeout(() => {
      if (this.ws === ws && this.lastPong < asked) this.drop(ws);
    }, ms);
  }

  /** Give up on a connection that stopped answering, and open a fresh one straight away. */
  private drop(ws: WebSocket): void {
    if (this.ws !== ws) return;
    this.ws = null;
    if (this.pingTimer) clearInterval(this.pingTimer);
    ws.onclose = null;
    ws.onmessage = null;
    try {
      ws.close();
    } catch {
      // Already gone.
    }
    this.status = 'reconnecting';
    this.attempt = 0;
    this.open();
  }

  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
    this.attempt++;
    this.retryTimer = setTimeout(() => this.open(), delay);
  }

  private reconnectNow(): void {
    if (this.status !== 'reconnecting') return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.open();
  }

  protected receive(message: ServerMessage): void {
    switch (message.type) {
      case 'state':
        if (message.seq < this.seq && message.events.length === 0) return; // stale
        this.seq = message.seq;
        this.clockOffset = message.room.serverTime - Date.now();
        this.view = message.view;
        this.room = message.room;
        this.myAvatar = message.myAvatar ?? null;
        if (message.events.length) for (const l of this.listeners) l(message.events);
        break;
      case 'error':
        this.showError(message.message);
        break;
      case 'replaced':
        this.status = 'replaced';
        break;
    }
  }

  private showError(text: string): void {
    this.error = text;
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => (this.error = null), 3500);
  }
}
