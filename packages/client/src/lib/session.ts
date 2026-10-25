// Login state and URL options. Storage keys are namespaced by `slot` so the four-seat
// test page can hold four separate logins in one browser.

const params = new URLSearchParams(location.search);

export const options = {
  slot: params.get('slot') ?? 'main',
  /** Dev autologin (four-seat test page). */
  autoProfile: params.get('as'),
  autoPin: params.get('pin'),
  /** Dev-only practice bot plays this seat (spec S22). */
  bot: params.get('bot') === '1',
};

const key = (name: string) => `dark.${options.slot}.${name}`;

function read(name: string): string | null {
  try {
    return localStorage.getItem(key(name));
  } catch {
    return null;
  }
}

function write(name: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key(name));
    else localStorage.setItem(key(name), value);
  } catch {
    // Private mode: the login simply won't be remembered.
  }
}

// The private link carries the room key as ?k=...; remember it so later visits work without it.
const linkKey = params.get('k');
if (linkKey) write('roomKey', linkKey);

export function roomKey(): string | null {
  return read('roomKey');
}

export function token(): string | null {
  return read('token');
}

export function saveLogin(newToken: string): void {
  write('token', newToken);
}

export function forgetLogin(): void {
  write('token', null);
}

/** Who last signed in on this device, so the practice table seats them as themselves. */
export const rememberMe = (profile: string): void => write('me', profile);
export const lastMe = (): string | null => read('me');

export interface ProfileListing {
  id: string;
  name: string;
  color: string;
  hasPin: boolean;
}

export async function fetchProfiles(): Promise<ProfileListing[]> {
  const res = await fetch(`/api/profiles?k=${encodeURIComponent(roomKey() ?? '')}`);
  if (!res.ok) throw new Error(res.status === 403 ? 'BAD_LINK' : 'UNAVAILABLE');
  return ((await res.json()) as { profiles: ProfileListing[] }).profiles;
}

export async function login(profile: string, pin: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ k: roomKey(), profile, pin }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !body.token) return { ok: false, message: body.message ?? 'Could not sign in.' };
  saveLogin(body.token);
  return { ok: true };
}

/** Is the stored login still valid? */
export async function checkLogin(): Promise<boolean> {
  const t = token();
  if (!t) return false;
  const res = await fetch(`/api/me?token=${encodeURIComponent(t)}`).catch(() => null);
  if (res && res.status === 401) {
    forgetLogin();
    return false;
  }
  return true;
}
