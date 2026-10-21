import type { AvatarPick, ClientIntent, ClientMessage, PublicEvent, RoomInfo, ServerMessage, TableView } from '@dark/engine';
import { checkLogin, token } from './session';

// Spec S08: a WebSocket that shrugs off locked screens and app switches.
// Every server message carries the full view, so after any reconnect we're instantly current.

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'signedOut';

const BACKOFF_MS = [500, 1000, 2000, 4000, 8000];

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

  /** `offline`: no server (the practice table drives this connection itself). */
  readonly offline: boolean;

  constructor(offline = false) {
    this.offline = offline;
    if (offline) {
      this.status = 'open';
      return;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.status === 'reconnecting') this.reconnectNow();
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
    };
    ws.onmessage = (e) => this.receive(JSON.parse(e.data as string) as ServerMessage);
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
      this.status = 'reconnecting';
      this.scheduleRetry();
    };
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
