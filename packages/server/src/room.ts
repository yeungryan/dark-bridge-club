import { DurableObject } from 'cloudflare:workers';
import {
  applyAvatarAction,
  applySessionAction,
  avatarsOf,
  lockedIn,
  newAvatarLobby,
  FIRST_BAG,
  rollTheme,
  type AvatarLobby,
  type ThemeBag,
  type ThemeId,
  newSession,
  randomSeed,
  tableView,
  type ClientMessage,
  type Presence,
  type ProfileId,
  type PublicEvent,
  type RoomInfo,
  type ServerMessage,
  type SessionAction,
  type SessionEvent,
  type SessionState,
} from '@dark/engine';
import type { Env } from './index';
import { isProfile, PROFILE_IDS, PROFILES, USUAL_PARTNER } from './profiles';

// Specs S06–S09: the one trusted referee for the table.
// Runs the engine, holds every hand, sends each player only their own view,
// owns all timers, and saves everything to the Durable Object's SQLite storage.

const GRACE_MS = 10_000; // S08: reconnecting → away
const CLINCH_MS = 5_000; // R11: "Play it out?" window
const CONCESSION_MS = 15_000; // S04: concession offer expiry
const AUTO_CLOSE_MS = 30 * 60_000; // R13: away this long → the night closes
const MAX_FAILED_PINS = 5;
const LOCKOUT_MS = 10 * 60_000;
const SURPRISE_MS = 30_000; // S24: the last one to pick gets "Surprise me" after this long

type TimerKind = 'clinch' | 'concession' | 'grace' | 'autoClose' | 'surprise';
interface Timer {
  kind: TimerKind;
  at: number;
  profile?: ProfileId;
}

interface PresenceEntry {
  status: Presence;
  since: number;
}

interface Stored {
  session: SessionState;
  seq: number;
  timers: Timer[];
  presence: Record<ProfileId, PresenceEntry>;
  /** How many of session.records have been written to the deals table. */
  persistedDeals: number;
  /** Tonight's avatar picks (S24). Cosmetic; kept apart from the rules engine's state. */
  avatars: AvatarLobby;
  /** Tonight's theme and the bag it was drawn from (S18). */
  theme: ThemeId;
  themeBag: ThemeBag;
}

const IN_PROGRESS = new Set(['partnerPick', 'inDeal', 'betweenDeals']);

export class TableRoom extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  private data!: Stored;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => {
      this.migrate();
      this.data = this.load();
      // After a restart, sockets may be gone even though we last saw them connected.
      const now = Date.now();
      for (const id of PROFILE_IDS) {
        if (this.data.presence[id]!.status === 'connected' && this.openSockets(id).length === 0) {
          this.markReconnecting(id, now);
        }
      }
      await this.scheduleAlarm();
    });
  }

  // ------------------------------------------------------------------ storage

  private migrate(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pins (
        profile_id TEXT PRIMARY KEY, pin_hash TEXT NOT NULL, pin_salt TEXT NOT NULL,
        failed INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS devices (
        token_hash TEXT PRIMARY KEY, profile_id TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, ended_at INTEGER,
        pairs_json TEXT, final_json TEXT);
      CREATE TABLE IF NOT EXISTS session_avatars (
        session_id TEXT NOT NULL, profile_id TEXT NOT NULL, animal TEXT NOT NULL, element TEXT NOT NULL,
        offered_json TEXT NOT NULL, rerolled INTEGER NOT NULL, PRIMARY KEY (session_id, profile_id));
      CREATE TABLE IF NOT EXISTS deals (
        session_id TEXT NOT NULL, deal_number INTEGER NOT NULL, seed TEXT NOT NULL, dealer INTEGER NOT NULL,
        record_json TEXT NOT NULL, auction_json TEXT, tricks_json TEXT, hands_json TEXT, completed_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, deal_number));
    `);
    // Added in M3 (S18): which theme each night had, for history.
    const columns = this.sql.exec<{ name: string }>('PRAGMA table_info(sessions)').toArray().map((c) => c.name);
    if (!columns.includes('theme')) this.sql.exec('ALTER TABLE sessions ADD COLUMN theme TEXT');
  }

  private load(): Stored {
    const row = this.sql.exec<{ v: string }>('SELECT v FROM kv WHERE k = ?', 'room').toArray()[0];
    if (row) {
      const stored = JSON.parse(row.v) as Stored;
      // Saved before avatars existed (M3): a night already under way simply has none.
      stored.avatars ??= newAvatarLobby(PROFILE_IDS, Math.random);
      // Saved before themes existed: tonight is the Clubhouse, and the next roll starts the bag.
      stored.theme ??= 'clubhouse';
      stored.themeBag ??= { remaining: [] };
      return stored;
    }
    const presence = Object.fromEntries(PROFILE_IDS.map((id) => [id, { status: 'away', since: 0 }])) as Stored['presence'];
    const roll = rollTheme(FIRST_BAG, Math.random);
    return {
      session: this.freshSession(),
      seq: 0,
      timers: [],
      presence,
      persistedDeals: 0,
      avatars: newAvatarLobby(PROFILE_IDS, Math.random),
      theme: roll.theme,
      themeBag: roll.bag,
    };
  }

  private freshSession(): SessionState {
    return newSession({ profiles: PROFILE_IDS, usualPartner: USUAL_PARTNER, seed: this.env.TEST_SEED || randomSeed() });
  }

  private save(): void {
    this.sql.exec('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', 'room', JSON.stringify(this.data));
  }

  // ------------------------------------------------------------------ HTTP

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      switch (url.pathname) {
        case '/api/profiles':
          return this.handleProfiles(url);
        case '/api/login':
          return await this.handleLogin(request);
        case '/api/me':
          return await this.handleMe(url);
        case '/api/ws':
          return await this.handleWebSocket(request, url);
        case '/api/admin/reset-pin':
          return await this.handleResetPin(request);
        default:
          return json({ error: 'NOT_FOUND' }, 404);
      }
    } catch (err) {
      console.error(err);
      return json({ error: 'SERVER_ERROR' }, 500);
    }
  }

  private roomKeyOk(key: unknown): boolean {
    return typeof key === 'string' && key.length > 0 && key === this.env.ROOM_KEY;
  }

  private handleProfiles(url: URL): Response {
    if (!this.roomKeyOk(url.searchParams.get('k'))) return json({ error: 'BAD_LINK' }, 403);
    const withPin = new Set(this.sql.exec<{ profile_id: string }>('SELECT profile_id FROM pins').toArray().map((r) => r.profile_id));
    return json({ profiles: PROFILES.map((p) => ({ ...p, hasPin: withPin.has(p.id) })) });
  }

  /** S07: tap your name, enter your PIN. The first login for a profile sets its PIN. */
  private async handleLogin(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'METHOD' }, 405);
    const body = (await request.json().catch(() => null)) as { k?: unknown; profile?: unknown; pin?: unknown } | null;
    if (!body || !this.roomKeyOk(body.k)) return json({ error: 'BAD_LINK' }, 403);
    const { profile, pin } = body;
    if (!isProfile(profile) || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return json({ error: 'BAD_REQUEST', message: 'Enter a 4-digit PIN.' }, 400);
    }

    const now = Date.now();
    const row = this.sql
      .exec<{ pin_hash: string; pin_salt: string; failed: number; locked_until: number }>(
        'SELECT pin_hash, pin_salt, failed, locked_until FROM pins WHERE profile_id = ?',
        profile,
      )
      .toArray()[0];

    if (!row) {
      const salt = randomHex(16);
      this.sql.exec('INSERT INTO pins (profile_id, pin_hash, pin_salt) VALUES (?, ?, ?)', profile, await sha256(salt + pin), salt);
    } else {
      if (row.locked_until > now) {
        const minutes = Math.ceil((row.locked_until - now) / 60_000);
        return json({ error: 'LOCKED', message: `Too many tries. Try again in ${minutes} min.` }, 429);
      }
      if ((await sha256(row.pin_salt + pin)) !== row.pin_hash) {
        const failed = row.failed + 1;
        if (failed >= MAX_FAILED_PINS) {
          this.sql.exec('UPDATE pins SET failed = 0, locked_until = ? WHERE profile_id = ?', now + LOCKOUT_MS, profile);
        } else {
          this.sql.exec('UPDATE pins SET failed = ? WHERE profile_id = ?', failed, profile);
        }
        return json({ error: 'WRONG_PIN', message: 'That PIN is not right.' }, 401);
      }
      this.sql.exec('UPDATE pins SET failed = 0, locked_until = 0 WHERE profile_id = ?', profile);
    }

    const token = randomHex(32);
    this.sql.exec('INSERT INTO devices (token_hash, profile_id, created_at) VALUES (?, ?, ?)', await sha256(token), profile, now);
    return json({ token, profile });
  }

  /** Lets a browser check whether its saved login still works. */
  private async handleMe(url: URL): Promise<Response> {
    const profile = await this.profileForToken(url.searchParams.get('token') ?? '');
    return profile ? json({ profile }) : json({ error: 'NOT_SIGNED_IN' }, 401);
  }

  private async profileForToken(token: string): Promise<string | null> {
    if (!token) return null;
    const row = this.sql
      .exec<{ profile_id: string }>('SELECT profile_id FROM devices WHERE token_hash = ?', await sha256(token))
      .toArray()[0];
    return row?.profile_id ?? null;
  }

  private async handleResetPin(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { adminKey?: unknown; profile?: unknown } | null;
    if (!body || typeof body.adminKey !== 'string' || !this.env.ADMIN_KEY || body.adminKey !== this.env.ADMIN_KEY) {
      return json({ error: 'FORBIDDEN' }, 403);
    }
    if (!isProfile(body.profile)) return json({ error: 'BAD_REQUEST' }, 400);
    this.sql.exec('DELETE FROM pins WHERE profile_id = ?', body.profile);
    this.sql.exec('DELETE FROM devices WHERE profile_id = ?', body.profile);
    return json({ ok: true });
  }

  private async handleWebSocket(request: Request, url: URL): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'EXPECTED_WEBSOCKET' }, 426);
    const profile = await this.profileForToken(url.searchParams.get('token') ?? '');
    if (!profile) return json({ error: 'NOT_SIGNED_IN' }, 401);

    // S07: the newest device takes the seat.
    for (const old of this.openSockets(profile)) {
      send(old, { type: 'replaced' });
      old.close(4001, 'replaced');
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [profile]);

    this.data.presence[profile] = { status: 'connected', since: Date.now() };
    this.data.timers = this.data.timers.filter((t) => !(t.profile === profile && (t.kind === 'grace' || t.kind === 'autoClose')));
    const events = this.maybeStartNight();
    await this.commit(events);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ------------------------------------------------------------------ WebSocket events

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const profile = this.ctx.getTags(ws)[0]!;
    let message: ClientMessage;
    try {
      message = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as ClientMessage;
    } catch {
      return send(ws, { type: 'error', code: 'BAD_MESSAGE', message: 'Could not read that message.' });
    }

    if (message.type === 'snapshot') return send(ws, this.stateMessage(profile, []));

    if (message.type === 'newNight') {
      if (this.data.session.phase !== 'ended') {
        return send(ws, { type: 'error', code: 'NIGHT_IN_PROGRESS', message: 'A night is already in progress.' });
      }
      this.data.session = this.freshSession();
      this.data.persistedDeals = 0;
      const last = Object.fromEntries(PROFILE_IDS.map((id) => [id, this.data.avatars.picks[id]?.avatar?.animal]));
      this.data.avatars = newAvatarLobby(PROFILE_IDS, Math.random, last);
      const roll = rollTheme(this.data.themeBag, Math.random, this.data.theme);
      this.data.theme = roll.theme;
      this.data.themeBag = roll.bag;
      return this.commit(this.maybeStartNight());
    }

    if (message.type === 'avatar') {
      if (this.data.session.phase !== 'lobby') {
        return send(ws, { type: 'error', code: 'NIGHT_STARTED', message: 'Avatars are picked before the night starts.' });
      }
      const outcome = applyAvatarAction(this.data.avatars, profile, message.action, Math.random);
      if (!outcome.ok) return send(ws, { type: 'error', code: outcome.error.code, message: outcome.error.message });
      this.data.avatars = outcome.state;
      return this.commit(this.maybeStartNight());
    }

    if (message.type !== 'intent' || !message.intent) {
      return send(ws, { type: 'error', code: 'BAD_MESSAGE', message: 'Unknown message.' });
    }
    if (this.isPaused()) {
      return send(ws, { type: 'error', code: 'PAUSED', message: 'Waiting for everyone to be back.' });
    }
    const outcome = applySessionAction(this.data.session, { ...message.intent, by: profile } as SessionAction);
    if (!outcome.ok) return send(ws, { type: 'error', code: outcome.error.code, message: outcome.error.message });
    this.data.session = outcome.state;
    await this.commit(outcome.events);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.socketGone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.socketGone(ws);
  }

  private async socketGone(ws: WebSocket): Promise<void> {
    const profile = this.ctx.getTags(ws)[0];
    if (!profile || this.openSockets(profile).some((s) => s !== ws)) return;
    this.markReconnecting(profile, Date.now());
    await this.commit([]);
  }

  private markReconnecting(profile: ProfileId, now: number): void {
    this.data.presence[profile] = { status: 'reconnecting', since: now };
    this.data.timers.push({ kind: 'grace', at: now + GRACE_MS, profile });
  }

  // ------------------------------------------------------------------ timers

  async alarm(): Promise<void> {
    const now = Date.now();
    const due = this.data.timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at);
    this.data.timers = this.data.timers.filter((t) => t.at > now);
    const events: SessionEvent[] = [];
    const run = (action: SessionAction) => {
      const outcome = applySessionAction(this.data.session, action);
      if (outcome.ok) {
        this.data.session = outcome.state;
        events.push(...outcome.events);
      }
    };

    for (const timer of due) {
      const session = this.data.session;
      switch (timer.kind) {
        case 'clinch':
          if (session.deal?.phase === 'awaitingPlayOn') run({ type: 'dealTimer', action: 'endAtClinch' });
          break;
        case 'concession':
          if (session.deal?.concession) run({ type: 'dealTimer', action: 'expireConcession' });
          break;
        case 'grace': {
          const p = timer.profile!;
          if (this.data.presence[p]!.status === 'reconnecting' && this.openSockets(p).length === 0) {
            this.data.presence[p] = { status: 'away', since: now };
          }
          break;
        }
        case 'autoClose':
          if (this.data.presence[timer.profile!]!.status === 'away' && IN_PROGRESS.has(session.phase)) {
            run({ type: 'autoClose' });
          }
          break;
        case 'surprise':
          if (session.phase === 'lobby') {
            for (const id of PROFILE_IDS) {
              const out = applyAvatarAction(this.data.avatars, id, { type: 'surprise' }, Math.random);
              if (out.ok) this.data.avatars = out.state;
            }
          }
          break;
      }
    }
    events.push(...this.maybeStartNight());
    await this.commit(events);
  }

  /** Timers that follow directly from the current state (clinch window, concession, auto-close). */
  private reconcileTimers(events: readonly SessionEvent[]): void {
    const session = this.data.session;
    const now = Date.now();
    const dealEvents = events.flatMap((e) => (e.type === 'deal' ? [e.event.type] : []));
    let timers = this.data.timers;

    // A fresh clinch or a fresh concession offer always gets a fresh deadline.
    if (dealEvents.includes('clinched')) timers = timers.filter((t) => t.kind !== 'clinch');
    if (dealEvents.includes('concessionProposed')) timers = timers.filter((t) => t.kind !== 'concession');

    const wantClinch = session.deal?.phase === 'awaitingPlayOn';
    if (!wantClinch) timers = timers.filter((t) => t.kind !== 'clinch');
    else if (!timers.some((t) => t.kind === 'clinch')) timers.push({ kind: 'clinch', at: now + CLINCH_MS });

    const wantConcession = session.phase === 'inDeal' && !!session.deal?.concession;
    if (!wantConcession) timers = timers.filter((t) => t.kind !== 'concession');
    else if (!timers.some((t) => t.kind === 'concession')) timers.push({ kind: 'concession', at: now + CONCESSION_MS });

    // S24: once the other three are here and locked in, the last one has 30 s before "Surprise me".
    const allHere = PROFILE_IDS.every((id) => this.data.presence[id]!.status === 'connected');
    const wantSurprise = session.phase === 'lobby' && allHere && lockedIn(this.data.avatars).length === PROFILE_IDS.length - 1;
    if (!wantSurprise) timers = timers.filter((t) => t.kind !== 'surprise');
    else if (!timers.some((t) => t.kind === 'surprise')) timers.push({ kind: 'surprise', at: now + SURPRISE_MS });

    for (const id of PROFILE_IDS) {
      const presence = this.data.presence[id]!;
      const want = IN_PROGRESS.has(session.phase) && presence.status === 'away';
      const has = timers.some((t) => t.kind === 'autoClose' && t.profile === id);
      if (!want) timers = timers.filter((t) => !(t.kind === 'autoClose' && t.profile === id));
      else if (!has) timers.push({ kind: 'autoClose', at: Math.max(now, presence.since) + AUTO_CLOSE_MS, profile: id });
    }
    this.data.timers = timers;
  }

  private async scheduleAlarm(): Promise<void> {
    const next = Math.min(...this.data.timers.map((t) => t.at));
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
    else await this.ctx.storage.deleteAlarm();
  }

  // ------------------------------------------------------------------ session flow

  /** The night starts once all four are connected (S05) and have locked in an avatar (S24). */
  private maybeStartNight(): SessionEvent[] {
    const session = this.data.session;
    const allHere = PROFILE_IDS.every((id) => this.data.presence[id]!.status === 'connected');
    const allPicked = lockedIn(this.data.avatars).length === PROFILE_IDS.length;
    if (session.phase !== 'lobby' || !allHere || !allPicked) return [];
    const outcome = applySessionAction(session, { type: 'start' });
    if (!outcome.ok) return [];
    this.data.session = outcome.state;
    return outcome.events;
  }

  private isPaused(): boolean {
    return (
      IN_PROGRESS.has(this.data.session.phase) &&
      PROFILE_IDS.some((id) => this.data.presence[id]!.status === 'away')
    );
  }

  /** Save, schedule timers, write history, and send everyone their view. */
  private async commit(events: SessionEvent[]): Promise<void> {
    this.reconcileTimers(events);
    this.persistHistory(events);
    this.data.seq++;
    this.save();
    await this.scheduleAlarm();
    this.broadcast(events);
  }

  private persistHistory(events: readonly SessionEvent[]): void {
    const session = this.data.session;
    const id = session.config.seed;
    const now = Date.now();
    for (const event of events) {
      if (event.type === 'captainDrawn') {
        for (const id of PROFILE_IDS) {
          const pick = this.data.avatars.picks[id];
          if (!pick?.avatar) continue;
          this.sql.exec(
            'INSERT OR REPLACE INTO session_avatars (session_id, profile_id, animal, element, offered_json, rerolled) VALUES (?, ?, ?, ?, ?, ?)',
            session.config.seed,
            id,
            pick.avatar.animal,
            pick.avatar.element,
            JSON.stringify(pick.offered),
            0, // Rerolls were dropped before launch; the column stays for history.
          );
        }
      }
      if (event.type === 'partnerChosen') {
        this.sql.exec(
          'INSERT OR IGNORE INTO sessions (id, started_at, pairs_json, theme) VALUES (?, ?, ?, ?)',
          id,
          now,
          JSON.stringify(event.pairs),
          this.data.theme,
        );
      }
      if (event.type === 'nightEnded') {
        this.sql.exec('UPDATE sessions SET ended_at = ?, final_json = ? WHERE id = ?', now, JSON.stringify(event.final), id);
      }
    }
    // S09: every finished or passed-out deal, with enough detail to replay it exactly.
    for (const record of session.records.slice(this.data.persistedDeals)) {
      const full = session.deal && session.deal.phase === 'complete' && record.dealNumber === session.dealNumber ? session.deal : null;
      this.sql.exec(
        `INSERT OR REPLACE INTO deals (session_id, deal_number, seed, dealer, record_json, auction_json, tricks_json, hands_json, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        record.dealNumber,
        record.seed,
        record.dealer,
        JSON.stringify(record),
        full ? JSON.stringify(full.auction.calls) : null,
        full ? JSON.stringify(full.tricks) : null,
        full ? JSON.stringify(full.originalHands) : null,
        now,
      );
    }
    this.data.persistedDeals = session.records.length;
  }

  // ------------------------------------------------------------------ sending

  private openSockets(profile: ProfileId): WebSocket[] {
    return this.ctx.getWebSockets(profile).filter((ws) => ws.readyState === WebSocket.OPEN);
  }

  private roomInfo(): RoomInfo {
    const timer = (kind: TimerKind) => this.data.timers.find((t) => t.kind === kind)?.at ?? null;
    const autoClose = this.data.timers.filter((t) => t.kind === 'autoClose').map((t) => t.at);
    return {
      profiles: PROFILES,
      presence: Object.fromEntries(PROFILE_IDS.map((id) => [id, this.data.presence[id]!.status])),
      paused: this.isPaused(),
      autoCloseAt: autoClose.length ? Math.min(...autoClose) : null,
      clinchDeadline: timer('clinch'),
      concessionDeadline: timer('concession'),
      serverTime: Date.now(),
      avatarReady: Object.fromEntries(PROFILE_IDS.map((id) => [id, !!this.data.avatars.picks[id]?.avatar])),
      // Choices stay hidden until everyone flips together at the start of the night.
      avatars: this.data.session.phase === 'lobby' ? null : avatarsOf(this.data.avatars),
      surpriseAt: timer('surprise'),
      theme: this.data.theme,
    };
  }

  private stateMessage(profile: ProfileId, events: readonly PublicEvent[]): ServerMessage {
    return {
      type: 'state',
      seq: this.data.seq,
      view: tableView(this.data.session, profile),
      room: this.roomInfo(),
      events,
      myAvatar: this.data.avatars.picks[profile] ?? null,
    };
  }

  private broadcast(events: readonly SessionEvent[]): void {
    // Never send deal seeds: they would let a browser recompute every hand.
    const publicEvents = events.map((e) => (e.type === 'dealStarted' ? { ...e, seed: '' } : e));
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const profile = this.ctx.getTags(ws)[0];
      if (profile) send(ws, this.stateMessage(profile, publicEvents));
    }
  }
}

// ------------------------------------------------------------------ helpers

function send(ws: WebSocket, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // The socket closed between checks; its close handler will run.
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
