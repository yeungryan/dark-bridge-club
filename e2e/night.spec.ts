import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

// A whole night through the real UI and server: three practice bots plus Ryan,
// whom this test plays by tapping the screen like a person would.
// The server starts from a fixed seed (playwright.config.ts) in which Ryan is drawn captain.

type Frame = { type: string; view?: any; events?: any[] };

interface Player {
  id: string;
  pin: string;
  bot: boolean;
  context: BrowserContext;
  page: Page;
  frames: Frame[];
}

/** The login token a page saved (each test seat uses its own storage slot). */
async function tokenOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    const slot = new URLSearchParams(location.search).get('slot') ?? 'main';
    return localStorage.getItem(`dark.${slot}.token`) ?? '';
  });
}

const SEATS = [
  { id: 'darren', pin: '1111', bot: true, slot: 1 },
  { id: 'adrian', pin: '2222', bot: true, slot: 2 },
  { id: 'ryan', pin: '3333', bot: false, slot: 3 },
  { id: 'kim', pin: '4444', bot: true, slot: 4 },
];

async function openPlayer(browser: Browser, seat: (typeof SEATS)[number]): Promise<Player> {
  const context = await browser.newContext();
  // E2E_EFFECTS=off|reduced plays the night with that Effects setting (default: full).
  if (process.env.E2E_EFFECTS) {
    await context.addInitScript((effects) => {
      const slot = new URLSearchParams(location.search).get('slot') ?? 'main';
      localStorage.setItem(`dark.${slot}.settings`, JSON.stringify({ effects }));
    }, process.env.E2E_EFFECTS);
  }
  const page = await context.newPage();
  // E2E_CPU_SLOWDOWN=6 imitates a slow CI machine or an old phone.
  const slowdown = Number(process.env.E2E_CPU_SLOWDOWN ?? 1);
  if (slowdown > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: slowdown });
  const player: Player = { ...seat, context, page, frames: [] };
  watchFrames(player, page);
  await page.goto(`/?slot=${seat.slot}&k=dev&as=${seat.id}&pin=${seat.pin}&bot=${seat.bot ? 1 : 0}`);
  return player;
}

function watchFrames(player: Player, page: Page): void {
  page.on('websocket', (ws) => ws.on('framereceived', (f) => player.frames.push(JSON.parse(String(f.payload)))));
}

/** A tap that gives up after a moment if the screen changed underneath it, like a person tapping again. */
async function tap(locator: Locator, options: Parameters<Locator['click']>[0] = {}): Promise<boolean> {
  return locator.click({ timeout: 3000, ...options }).then(() => true, () => false);
}

/** isEnabled() waits for the element; if it vanished after an isVisible() check, give up quickly. */
async function isEnabledNow(locator: Locator): Promise<boolean> {
  return locator.isEnabled({ timeout: 1000 }).catch(() => false);
}

/** One line describing what Ryan's screen should be showing, for failure messages. */
function describeState(frames: Frame[]): string {
  const last = frames.filter((f) => f.type === 'state').at(-1);
  if (!last) return 'no state received';
  const v = last.view;
  const errors = frames.filter((f) => f.type === 'error').slice(-3).map((f: any) => f.code);
  return JSON.stringify({
    phase: v.phase,
    captain: v.captain,
    mySeat: v.mySeat,
    deal: v.deal && { phase: v.deal.phase, turn: v.deal.turn, calls: v.deal.calls.length, tricks: v.deal.tricksPlayed },
    ready: v.readyForNext,
    presence: (last as any).room?.presence,
    paused: (last as any).room?.paused,
    recentErrors: errors,
  });
}

/** Lobby (S24): tap the first animal and the first element, which locks the avatar in. */
async function pickAvatar(page: Page): Promise<void> {
  if (await tap(page.locator('.picker .animal').first())) await tap(page.locator('.picker .element').first());
  await page.waitForTimeout(300);
}

/** Drag a card from the hand onto the middle of the table, like a thumb would. */
async function dragToTable(page: Page, card: Locator): Promise<void> {
  const from = await card.boundingBox();
  const area = await page.locator('.area').boundingBox();
  if (!from || !area) return;
  const x0 = from.x + 10;
  const y0 = from.y + 30;
  const x1 = area.x + area.width / 2;
  const y1 = area.y + area.height * 0.7;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8);
  await page.mouse.up();
}

/** Deals won so far tonight, from the latest server state. */
function dealsScored(frames: Frame[]): number {
  const v = frames.filter((f) => f.type === 'state').at(-1)?.view;
  return v ? v.wins.A + v.wins.B : 0;
}

/** Plays Ryan's turns until `deals` more deals have been scored. */
async function playAsHuman(player: Player, deals: number): Promise<void> {
  const page = player.page;
  // Count from the score, not from taps: on a slow machine one reveal can take two taps.
  const target = dealsScored(player.frames) + deals;
  const deadline = Date.now() + 4 * 60_000;
  while (dealsScored(player.frames) < target) {
    if (Date.now() > deadline) throw new Error(`Timed out playing as Ryan. Last state: ${describeState(player.frames)}`);

    // S24: pick an avatar in the lobby (an animal and an element; that locks it in).
    if (await page.locator('.picker .animal').first().isVisible()) {
      await pickAvatar(page);
      continue;
    }
    const partnerButton = page.getByRole('button', { name: /^Partner with/ });
    if (await partnerButton.isVisible()) {
      await tap(partnerButton);
      continue;
    }
    const nextDeal = page.getByRole('button', { name: 'Next game' });
    if ((await nextDeal.isVisible()) && (await isEnabledNow(nextDeal))) {
      await tap(nextDeal);
      continue;
    }
    const dealButton = page.getByRole('button', { name: 'Deal', exact: true });
    if (await dealButton.isVisible()) {
      await tap(dealButton);
      continue;
    }
    const pass = page.getByRole('button', { name: 'Pass', exact: true });
    if (await pass.isVisible()) {
      await tap(pass);
      continue;
    }
    if (await page.locator('.table[data-turn="my-play"]').isVisible()) {
      // Drag a playable (not dimmed) card to the table. Cards overlap, so grab the visible left edge.
      const playable = page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first();
      await dragToTable(page, playable);
      await page.waitForTimeout(250);
      continue;
    }
    await page.waitForTimeout(200);
  }
}

/** Moves Ryan along (partner pick, Next game, Pass) until it's his turn to play a card. */
async function reachMyTurnToPlay(player: Player): Promise<void> {
  const page = player.page;
  const deadline = Date.now() + 90_000;
  while (!(await page.locator('.table[data-turn="my-play"]').isVisible())) {
    if (Date.now() > deadline) throw new Error(`Never reached Ryan's turn. Last state: ${describeState(player.frames)}`);
    const partnerButton = page.getByRole('button', { name: /^Partner with/ });
    const nextDeal = page.getByRole('button', { name: 'Next game' });
    const pass = page.getByRole('button', { name: 'Pass', exact: true });
    if (await page.locator('.picker .animal').first().isVisible()) await pickAvatar(page);
    else if (await partnerButton.isVisible()) await tap(partnerButton);
    else if ((await nextDeal.isVisible()) && (await isEnabledNow(nextDeal))) await tap(nextDeal);
    else if (await page.getByRole('button', { name: 'Deal', exact: true }).isVisible()) await tap(page.getByRole('button', { name: 'Deal', exact: true }));
    else if (await pass.isVisible()) {
      await tap(pass);
    } else await page.waitForTimeout(200);
  }
}

test.describe.serial('a night at the DARK table', () => {
  let players: Player[] = [];
  const ryan = () => players.find((p) => p.id === 'ryan')!;

  test.beforeAll(async ({ browser }) => {
    players = await Promise.all(SEATS.map((s) => openPlayer(browser, s)));
  });

  test.afterAll(async () => {
    await Promise.all(players.map((p) => p.context.close()));
  });

  test('the night starts once all four are here, and Ryan can bid and play two full deals', async () => {
    await playAsHuman(ryan(), 2);
    const last = ryan().frames.filter((f) => f.type === 'state').at(-1)!;
    expect(last.view.wins.A + last.view.wins.B).toBeGreaterThanOrEqual(2);
  });

  test('a raised card stays raised when unrelated updates arrive, and can then be swiped to play', async () => {
    const page = ryan().page;
    const darren = players[0]!;
    await reachMyTurnToPlay(ryan());
    const before = await page.locator('.hand .slot').count();
    const playable = page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first();
    await playable.click({ position: { x: 10, y: 30 } });
    await expect(page.locator('.hand .slot.up')).toHaveCount(1);

    // Darren's browser drops and reconnects: two updates reach Ryan while his card is raised.
    await darren.page.reload();
    await page.waitForTimeout(1500);
    await expect(page.locator('.hand .slot.up')).toHaveCount(1);

    await dragToTable(page, page.locator('.hand .slot.up'));
    await expect(page.locator('.hand .slot')).toHaveCount(before - 1);
  });

  test('dragging a playable card upward plays it; a short, slow drag springs back', async () => {
    const page = ryan().page;
    await reachMyTurnToPlay(ryan());
    const before = await page.locator('.hand .slot').count();
    const card = page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first();
    const box = (await card.boundingBox())!;
    const x = box.x + 10;
    const y = box.y + 30;

    // A short, slow drag (not past the line, and not a flick) leaves the card in the hand.
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(x, y - i * 5);
      await page.waitForTimeout(60);
    }
    await page.mouse.up();
    await page.waitForTimeout(400);
    await expect(page.locator('.hand .slot')).toHaveCount(before);

    // A long drag plays it.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 120, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.hand .slot')).toHaveCount(before - 1);
  });

  test('no browser ever receives another player’s cards or a deal seed before the reveal', async () => {
    for (const player of players) {
      const states = player.frames.filter((f) => f.type === 'state');
      expect(states.length).toBeGreaterThan(20);
      for (const s of states) {
        const deal = s.view.deal;
        for (const e of s.events ?? []) if (e.type === 'dealStarted') expect(e.seed).toBe('');
        // S24: avatar choices stay private until the night starts.
        if (s.view.phase === 'lobby') expect((s as any).room.avatars).toBeNull();
        if (!deal) continue;
        if (deal.phase !== 'complete') expect(deal.revealedHands).toBeNull();
        expect(deal.hand.length).toBe(s.view.mySeat === null ? 0 : deal.handCounts[s.view.mySeat]);
        expect(JSON.stringify(s)).not.toMatch(/"seed":"[0-9a-f]{32}"/);
      }
    }
  });

  test('if Ryan drops, the table pauses; when he comes back, play resumes with his hand restored', async () => {
    const darren = players[0]!;
    const before = ryan().frames.filter((f) => f.type === 'state').at(-1)!.view.deal?.hand ?? [];
    await ryan().page.close();

    await expect(darren.page.getByText('Waiting for Ryan')).toBeVisible({ timeout: 20_000 });

    const page = await ryan().context.newPage();
    ryan().page = page;
    watchFrames(ryan(), page);
    await page.goto('/?slot=3');
    await expect(darren.page.getByText('Waiting for Ryan')).toBeHidden({ timeout: 15_000 });
    const after = ryan().frames.filter((f) => f.type === 'state').at(-1)!.view.deal?.hand ?? [];
    // Bots may not move while paused, so the hand is unchanged unless Ryan was mid-trick.
    expect(after.length).toBeGreaterThanOrEqual(before.length - 1);
  });

  test('ending the night needs everyone, then shows the final score and the awards', async () => {
    const page = ryan().page;
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'End the night' }).click();
    await expect(page.getByText(/win the night|A dead heat/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Start a new night' })).toBeVisible();
    // S19: at least one award (two full games always have a clinching card), each naming a player.
    const awards = page.getByRole('region', { name: "Tonight's awards" }).locator('.award');
    await expect(awards.first()).toBeVisible({ timeout: 10_000 });
    await expect(awards.first().locator('.who')).toHaveText(/Darren|Adrian|Ryan|Kim/);
  });

  test('the end of the night leads to planning the next: propose, vote, lock, add to calendar', async ({ request }) => {
    // Not signed in: no schedule.
    expect((await request.get('/api/schedule')).status()).toBe(401);
    const page = ryan().page;
    await page.getByRole('button', { name: 'Plan the next night' }).click();
    const plan = page.getByRole('dialog', { name: 'Next night' });
    // Proposing takes three taps from here: Propose times, an evening, Propose.
    await plan.getByRole('button', { name: /Propose times/ }).click();
    await plan.locator('.chip').nth(1).click();
    await plan.getByRole('button', { name: /^Propose 1$/ }).click();
    await expect(plan.locator('.slot')).toHaveCount(1);
    await expect(plan.getByText(/Waiting on Darren, Adrian, Kim/)).toBeVisible();
    // The other three say Yes (from their own logins).
    const slotId = (await (await request.get(`/api/schedule?token=${await tokenOf(page)}`)).json()).schedule.slots[0].id;
    for (const seat of SEATS.filter((s) => s.id !== 'ryan')) {
      const login = await (await request.post('/api/login', { data: { k: 'dev', profile: seat.id, pin: seat.pin } })).json();
      const res = await request.post('/api/schedule', { data: { token: login.token, action: { type: 'vote', slot: slotId, vote: seat.id === 'kim' ? 'maybe' : 'yes' } } });
      expect(res.ok()).toBe(true);
    }
    // A Maybe doesn't lock it; Kim changes to Yes and it locks.
    const kim = await (await request.post('/api/login', { data: { k: 'dev', profile: 'kim', pin: '4444' } })).json();
    const locked = await (await request.post('/api/schedule', { data: { token: kim.token, action: { type: 'vote', slot: slotId, vote: 'yes' } } })).json();
    expect(locked.schedule.locked?.id).toBe(slotId);
    // Ryan's screen catches up: the night is on, with a calendar file.
    await plan.getByRole('button', { name: 'Close the scheduler' }).click();
    await page.getByRole('button', { name: 'Plan the next night' }).click();
    await expect(plan.getByRole('region', { name: 'The next night is on' })).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), plan.getByRole('button', { name: /Add to calendar/ }).click()]);
    const ics = await (await download.createReadStream()).toArray();
    const text = Buffer.concat(ics).toString();
    expect(text).toContain('BEGIN:VEVENT');
    expect(text).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    await plan.getByRole('button', { name: 'Close the scheduler' }).click();
  });

  test('the next night opens with "Last time…", and history replays any saved game', async ({ request }) => {
    // History is for the four of you only.
    expect((await request.get('/api/history')).status()).toBe(401);
    const page = ryan().page;
    await page.getByRole('button', { name: 'Start a new night' }).click();
    // S21: the home screen counts down to the night everyone said Yes to.
    await expect(page.getByRole('button', { name: 'Next night' })).toContainText(/Next night · (in|now)/, { timeout: 15_000 });
    const last = page.getByRole('region', { name: 'Last time' });
    await expect(last).toBeVisible({ timeout: 15_000 });
    // Round 9 (S1): the all-time games won, under "Bridge Club".
    await expect(page.getByLabel(/^All-time games won: /)).toBeVisible();
    await expect(last).toContainText(/won \d+–\d+|A dead heat/);
    await last.getByRole('button', { name: /History/ }).click();
    const history = page.getByRole('dialog', { name: 'History' });
    // The rivalry board: the three ways the four can pair up, and all six partnerships.
    await expect(history.locator('.match')).toHaveCount(3);
    await expect(history.locator('tbody tr')).toHaveCount(6);
    // The night log: last night's games, each one replayable.
    // Players: everyone's leaderboard (four champion cards), then one player's card.
    await history.getByRole('tab', { name: 'Players' }).click();
    await expect(history.locator('.champ')).toHaveCount(4);
    await expect(history.locator('.award')).toHaveCount(3);
    await history.getByRole('button', { name: /Ryan/ }).click();
    await expect(history.getByRole('region', { name: "Ryan's card" })).toBeVisible();
    // Moments live in the night log now (Ryan): three tabs.
    await expect(history.getByRole('tab')).toHaveCount(3);
    await history.getByRole('tab', { name: 'Nights' }).click();
    await history.locator('.night-head').first().click();
    await history.getByRole('button', { name: /^Replay game/ }).first().click();
    const replay = page.getByRole('dialog', { name: /Replay of game/ });
    await expect(replay).toBeVisible();
    await expect(replay.locator('.hand')).toHaveCount(4);
    await replay.locator('.lanes .set').first().click();
    await expect(replay.locator('.table .spot')).toHaveCount(4);
    await replay.getByRole('button', { name: 'Close the replay' }).click();
    await history.getByRole('button', { name: 'Close the history' }).click();
    await expect(history).toBeHidden();
  });

  test('a matchup\'s all-time score can be set by hand once all four approve', async ({ request }) => {
    const page = ryan().page;
    await page.getByRole('region', { name: 'Last time' }).getByRole('button', { name: /History/ }).click();
    const history = page.getByRole('dialog', { name: 'History' });
    const first = history.locator('.match').first();
    const before = Number(await first.locator('.big').first().textContent());
    await first.getByRole('button', { name: /^Change the score/ }).click();
    const editor = first.getByRole('region', { name: 'Change the score' });
    const more = editor.getByRole('button', { name: /^One more nights/ }).first();
    for (let i = 0; i < 3; i++) await more.click();
    await editor.getByRole('button', { name: 'Send for approval' }).click();
    const pending = history.getByRole('region', { name: 'Changes waiting for approval' });
    await expect(pending).toContainText(`${before + 3}–`);
    await expect(pending).toContainText('1 of 4 OK');
    // Not counted yet.
    await expect(first.locator('.big').first()).toHaveText(String(before));
    // The other three approve from their own logins; the last OK applies it.
    const id = (await (await request.get(`/api/history?token=${await tokenOf(page)}`)).json()).pending[0].id;
    for (const seat of SEATS.filter((s) => s.id !== 'ryan')) {
      const login = await (await request.post('/api/login', { data: { k: 'dev', profile: seat.id, pin: seat.pin } })).json();
      expect((await request.post('/api/history/change', { data: { token: login.token, action: { type: 'approve', id } } })).ok()).toBe(true);
    }
    await history.getByRole('button', { name: 'Close the history' }).click();
    await page.getByRole('region', { name: 'Last time' }).getByRole('button', { name: /History/ }).click();
    await expect(first.locator('.big').first()).toHaveText(String(before + 3));
    await expect(first).toContainText('Score agreed by all four');
    await expect(history.getByRole('region', { name: 'Changes waiting for approval' })).toHaveCount(0);
    await history.getByRole('button', { name: 'Close the history' }).click();
  });

  test('"Start again from 0–0" resets every matchup once all four approve (round 9)', async ({ request }) => {
    const page = ryan().page;
    await page.getByRole('region', { name: 'Last time' }).getByRole('button', { name: /History/ }).click();
    const history = page.getByRole('dialog', { name: 'History' });
    const first = history.locator('.match').first();
    await first.getByRole('button', { name: /^Change the score/ }).click();
    const editor = first.getByRole('region', { name: 'Change the score' });
    await editor.getByRole('button', { name: 'Start again from 0–0' }).click();
    await expect(editor).toContainText('Everything goes back to 0–0');
    await editor.getByRole('button', { name: 'Send reset for approval' }).click();
    await expect(history.getByRole('region', { name: 'Changes waiting for approval' })).toContainText('Start again from 0–0');
    const id = (await (await request.get(`/api/history?token=${await tokenOf(page)}`)).json()).pending[0].id;
    for (const seat of SEATS.filter((s) => s.id !== 'ryan')) {
      const login = await (await request.post('/api/login', { data: { k: 'dev', profile: seat.id, pin: seat.pin } })).json();
      expect((await request.post('/api/history/change', { data: { token: login.token, action: { type: 'approve', id } } })).ok()).toBe(true);
    }
    await history.getByRole('button', { name: 'Close the history' }).click();
    await page.getByRole('region', { name: 'Last time' }).getByRole('button', { name: /History/ }).click();
    for (const big of await history.locator('.match .big').all()) await expect(big).toHaveText('0');
    // The night log stays.
    await history.getByRole('tab', { name: 'Nights' }).click();
    await expect(history.locator('.night-head').first()).toBeVisible();
    await history.getByRole('button', { name: 'Close the history' }).click();
  });

  test('the admin page can set a player\'s PIN (and only with the admin key)', async ({ request }) => {
    const setPin = (adminKey: string, pin: string) => request.post('/api/admin/set-pin', { data: { adminKey, profile: 'kim', pin } });
    const login = (pin: string) => request.post('/api/login', { data: { k: 'dev', profile: 'kim', pin } });
    expect((await setPin('wrong', '9876')).status()).toBe(403);
    expect((await setPin('dev-admin', '98')).status()).toBe(400);
    expect((await setPin('dev-admin', '9876')).ok()).toBe(true);
    expect((await login('4444')).status()).toBe(401);
    expect((await login('9876')).ok()).toBe(true);
  });
});
