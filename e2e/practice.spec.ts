import { expect, test, type Locator, type Page } from '@playwright/test';

// The practice table (you against three bots, all in the browser) on an emulated phone,
// which also lets us check what a real night can't easily show: that sound switches on
// after a tap, and that every step of the feel ladder actually fires.

// Practice tests run side by side. The ones that only check where things end up run at test
// speed (?turbo=1: animations at 0.15×, instant bots); the ones that check timing or look at a
// passing moment (sound, the feel ladder, the bid ladder's strip, the avatar flip) run for real.
test.describe.configure({ mode: 'parallel' });
const PRACTICE = '/practice.html?turbo=1';

const sounds = (page: Page) => page.evaluate(() => (window as unknown as { __darkSounds: string[] }).__darkSounds.slice());
/** How many times a sound has played since the page opened (never trimmed, unlike `sounds`). */
const soundCount = (page: Page, name: string) =>
  page.evaluate((n) => (window as unknown as { __darkSoundCount: Record<string, number> }).__darkSoundCount[n] ?? 0, name);

async function tap(locator: Locator): Promise<boolean> {
  return locator.tap({ timeout: 3000 }).then(
    () => true,
    () => false,
  );
}

/**
 * Play a card like a thumb would (round 19): tap it to raise it (unless it already is), wait out
 * the double-tap guard, then swipe the raised card up toward the table.
 */
async function dragToTable(page: Page, card: Locator): Promise<void> {
  const raised = await card.evaluate((e) => e.classList.contains('up')).catch(() => false);
  if (!raised) {
    await card.click({ position: { x: 10, y: 30 } });
    await page.waitForTimeout(300);
  }
  const up = page.locator('.hand .slot.up');
  const from = await up.boundingBox();
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

/** Move along (captain draw, partner pick, Next game, passing) until `until` is true. */
async function playUntil(page: Page, until: () => Promise<boolean>, opts: { stayOnReveal?: boolean; noPass?: boolean; noDeal?: boolean } = {}): Promise<void> {
  // Only catches a game that has truly stopped (a busy machine can be slow, not stuck).
  const deadline = Date.now() + 240_000;
  while (!(await until())) {
    if (Date.now() > deadline) throw new Error('Practice table got stuck');
    const skip = page.getByRole('button', { name: 'Skip the captain draw' });
    const partner = page.getByRole('button', { name: /^Partner with/ });
    const next = page.getByRole('button', { name: 'Next game' });
    const pass = page.getByRole('button', { name: 'Pass', exact: true });
    const dealButton = page.getByRole('button', { name: 'Deal', exact: true });
    const animal = page.locator('.picker .animal').first();
    if (await animal.isVisible()) {
      if (await tap(animal)) await tap(page.locator('.picker .element').first());
    } else if (await skip.isVisible()) await tap(skip);
    else if (await partner.isVisible()) await tap(partner);
    else if (!opts.stayOnReveal && (await next.isVisible()) && (await next.isEnabled())) await tap(next);
    else if (!opts.noDeal && (await dealButton.isVisible())) await tap(dealButton);
    else if (!opts.noPass && (await pass.isVisible())) await tap(pass);
    else if (await page.locator('.table[data-turn="my-play"]').isVisible()) {
      await dragToTable(page, page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first());
      await page.waitForTimeout(200);
    } else await page.waitForTimeout(150);
  }
}

test('no sound before the first tap; after it, the game is audible', async ({ page }) => {
  await page.goto('/practice.html');
  // The bots' avatar picks happen before anyone has touched the phone: no sound yet.
  await page.waitForTimeout(1500);
  expect(await sounds(page)).toEqual([]);
  await playUntil(page, async () => (await sounds(page)).length > 0);
  expect(await page.evaluate(() => (window as unknown as { __darkSounds: string[] }).__darkSounds.length)).toBeGreaterThan(0);
});

test('a link pasted into a chat shows the title-screen preview image', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('<meta property="og:image" content="https://dark-bridge-club.yeungryan2000.workers.dev/og.jpg"');
  expect(html).toContain('<meta property="og:title" content="DARK Bridge Club"');
  const image = await request.get('/og.jpg');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/jpeg');
});

test('the way back: the title screen links to the multiplayer table, and so does the menu mid-game', async ({ page }) => {
  await page.goto(PRACTICE);
  // You're already at the practice table, so the title screen offers the way back instead (Ryan).
  await expect(page.getByRole('link', { name: 'multiplayer table' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'practice table' })).toHaveCount(0);
  await playUntil(page, () => page.getByRole('button', { name: 'Menu' }).isVisible());
  await page.getByRole('button', { name: 'Menu' }).tap();
  await expect(page.getByRole('link', { name: /Back to the multiplayer table/ })).toHaveAttribute('href', '/');
});

test('the bid ladder: tap a bid to see what it needs, tap it again (now "Bid …") to bid; Pass is one tap', async ({ page }) => {
  await page.goto('/practice.html');
  await playUntil(page, () => page.locator('.box .ladder').isVisible());
  // Nothing picked yet: the bid to beat's suit is raised, as many as the top line counts.
  const context = (await page.locator('.box .context').textContent()) ?? '';
  const held = /you hold (\d+|no)(?! aces?)\b/.exec(context);
  if (held) await expect(page.locator('.hand .slot.preview')).toHaveCount(held[1] === 'no' ? 0 : Number(held[1]));
  else if (context.startsWith('No bids yet')) await expect(page.locator('.hand .slot.preview')).toHaveCount(0);
  // A suit bid (not NT): picking it raises exactly my cards of that suit.
  const tile = page.locator('.ladder .tile:not([disabled]):not([aria-label$="no trumps"])').first();
  const label = ((await tile.textContent()) ?? '').trim();
  const strain = ((await tile.getAttribute('aria-label')) ?? '').split(' ')[1] as 'C' | 'D' | 'H' | 'S';
  const symbol = { C: '♣', D: '♦', H: '♥', S: '♠' }[strain];
  await tile.tap();
  await expect(page.locator('.box .context')).toContainText(/you need \d+ sets, they need \d+/);
  await expect(page.locator('.hand .slot.preview')).toHaveCount(await page.locator(`.hand .card[aria-label$="of ${symbol}"]`).count());
  // Round 19 (Ryan): the picked tile itself turns gold and becomes the Bid button.
  const picked = page.locator('.ladder .tile.on');
  await expect(picked).toContainText(/Bid\s*\d/);
  await expect(page.locator('.box .confirm')).toHaveCount(0);
  await page.waitForTimeout(300); // past the double-tap guard
  await picked.tap();
  // My bid lands on the table in front of me (Ryan: like a played card, so no name is needed).
  await expect(page.locator('.calls .at-bottom .tile').last()).toContainText(label);
  // Next time it's my call (this auction or the next game's), Pass goes straight in.
  await playUntil(page, () => page.locator('.box .ladder').isVisible(), { noPass: true });
  const before = await soundCount(page, 'pass');
  await page.getByRole('button', { name: 'Pass', exact: true }).tap();
  // One tap and it's in: the box closes (no longer my call) and the pass is heard. (At test
  // speed the bots may finish the auction at once, so the strip itself may already be gone.)
  await expect(page.locator('.box .ladder')).toBeHidden();
  await expect.poll(async () => soundCount(page, 'pass')).toBeGreaterThan(before);
});

test('a whole deal by dragging cards: every beat of the feel ladder fires', async ({ page }) => {
  await page.goto('/practice.html');
  await playUntil(page, () => page.getByRole('button', { name: 'Next game' }).isVisible());
  // A deal settled on its last trick ends at once; its clinch lands a moment later.
  await expect.poll(async () => soundCount(page, 'clinch'), { timeout: 3000 }).toBeGreaterThan(0);
  // (Counted since the page opened: a whole game plays more sounds than the recent-sounds list keeps.)
  for (const beat of ['card', 'pass', 'sold', 'sweep', 'pip', 'clinch']) expect(await soundCount(page, beat), `missing "${beat}"`).toBeGreaterThan(0);
  // Every set won plays the winner's element attack (S24): its sound at each impact on the losing cards.
  const hits = ['fireHit', 'airCut', 'waterHole', 'earthHit', 'boltZap', 'crumple', 'iceTink', 'bladeSlash'];
  let attacks = 0;
  for (const name of hits) attacks += await soundCount(page, name);
  expect(attacks, 'no set-won attack was heard').toBeGreaterThan(0);
});

test('tap a card to raise it (a blinking double chevron appears on it), tap it again to play', async ({ page }) => {
  await page.goto(PRACTICE);
  await playUntil(page, () => page.locator('.table[data-turn="my-play"]').isVisible());
  const before = await page.locator('.hand .slot').count();
  const card = page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first();
  await card.click({ position: { x: 10, y: 30 } });
  await expect(page.locator('.hand .slot.up')).toHaveCount(1);
  await expect(page.locator('.hand .slot.up .go')).toHaveCount(1);
  // No text hint under the hand any more (round 19): the chevron says it.
  await expect(page.getByText(/to play\.$/)).toHaveCount(0);
  await page.waitForTimeout(300); // past the double-tap guard
  await page.locator('.hand .slot.up').click({ position: { x: 10, y: 30 } });
  await expect(page.locator('.hand .slot')).toHaveCount(before - 1);
});

test('swipes: an unraised card swiped up only rises; a raised card swiped down lowers, swiped up plays', async ({ page }) => {
  await page.goto(PRACTICE);
  await playUntil(page, () => page.locator('.table[data-turn="my-play"]').isVisible());
  const before = await page.locator('.hand .slot').count();
  const card = page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first();
  const swipe = async (dy: number) => {
    const box = (await page.locator('.hand .slot.up').or(card).first().boundingBox())!;
    const x = box.x + 10;
    const y = box.y + 30;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + dy, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  };
  // Not raised: a long swipe up does not play it; it only raises it.
  await swipe(-150);
  await expect(page.locator('.hand .slot')).toHaveCount(before);
  await expect(page.locator('.hand .slot.up')).toHaveCount(1);
  // Raised: a swipe down lowers it.
  await swipe(40);
  await expect(page.locator('.hand .slot.up')).toHaveCount(0);
  await expect(page.locator('.hand .slot')).toHaveCount(before);
  // Raise it again; tapping anywhere else lowers it too.
  await card.click({ position: { x: 10, y: 30 } });
  await expect(page.locator('.hand .slot.up')).toHaveCount(1);
  await page.locator('header').click();
  await expect(page.locator('.hand .slot.up')).toHaveCount(0);
  // Raised, then a short swipe up plays it.
  await card.click({ position: { x: 10, y: 30 } });
  await expect(page.locator('.hand .slot.up')).toHaveCount(1);
  await swipe(-45);
  await expect(page.locator('.hand .slot')).toHaveCount(before - 1);
});

test('avatars: two animals, tap one and an element to lock in; the crest shows who is ready', async ({ page }) => {
  await page.goto('/practice.html');
  await expect(page.getByText('Who are you tonight?')).toBeVisible();
  // Two animals on offer; no names, no reroll, no confirm or "Surprise me" buttons.
  await expect(page.locator('.picker .animal')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Surprise me|Lock in|Show me/ })).toHaveCount(0);
  // The bots fill their crest letters as they pick.
  await expect(page.locator('.crest .slot.ready')).toHaveCount(3, { timeout: 10_000 });

  await page.locator('.picker .animal').first().tap();
  await page.getByRole('button', { name: 'Water' }).tap();
  // That locks it in: the four avatars flip. Avatars aren't named in words.
  await expect(page.locator('.reveal .card')).toHaveCount(4, { timeout: 15_000 });
  const mine = page.locator('.reveal .card').filter({ hasText: 'Ryan' });
  await expect(mine.locator('.token.el-water')).toHaveCount(1);
  await expect(page.locator('.reveal')).not.toContainText('Water');
  // Four different animals, each drawn as an animal picture.
  const faces = await page.locator('.reveal .card .face [data-animal]').evaluateAll((els) => els.map((e) => e.getAttribute('data-animal')));
  expect(new Set(faces).size).toBe(4);
  // At the table, all four seats (yours too) show the avatar with its element and cards left.
  await playUntil(page, () => page.locator('[data-badge-seat] .count').first().isVisible());
  await expect(page.locator('.seat .token[class*="el-"]')).toHaveCount(4);
  await expect(page.locator('.seat .count')).toHaveCount(4);
});

test('seats stay put from bidding to play; the newest set on the scoreboard opens the last set', async ({ page }) => {
  await page.goto(PRACTICE);
  // Each seat's avatar (the badge itself is centred, so its edge moves a hair with the role
  // tag or the card count; the avatar is what has to stay put).
  const seats = ['top', 'left', 'right', 'me'];
  // My seat's 4px lift on my turn is the turn cue, not layout: hold it still while measuring.
  const centres = async () => {
    const still = await page.addStyleTag({ content: '.seat { transform: none !important; transition: none !important; }' });
    const out = await Promise.all(
      seats.map(async (s) => {
        const b = (await page.locator(`.seat-${s} .seat .token`).boundingBox())!;
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }),
    );
    await still.evaluate((el) => el.remove());
    return out;
  };
  await playUntil(page, () => page.locator('.box .ladder').isVisible());
  const bidding = await centres();
  // Play on until a set has been won, measuring while the game is still being played (a slow
  // machine can reach the end of the game first; then it plays on into the next one).
  await playUntil(page, async () => (await page.locator('.pip.latest').isVisible()) && (await page.locator('.hand .slot').count()) > 0);
  const playing = await centres();
  playing.forEach((p, i) => {
    expect(Math.abs(p.x - bidding[i].x), `${seats[i]} x`).toBeLessThanOrEqual(1);
    // (On failure, every seat's centre at both moments, to tell a real shift from a race.)
    expect(Math.abs(p.y - bidding[i].y), `${seats[i]} y ${JSON.stringify({ bidding, playing })}`).toBeLessThanOrEqual(1);
  });
  // No separate "Last set" button any more: the latest silhouette is the way in.
  await expect(page.getByRole('button', { name: /^Last set$/ })).toHaveCount(0);
  // Read the table's position instantly: the bots may finish the game meanwhile, and then the
  // results replace the table (waiting for it would hang the test).
  const areaTop = () => page.evaluate(() => document.querySelector('.area')?.getBoundingClientRect().top ?? null);
  const before = await areaTop();
  await page.locator('.pip.latest').tap();
  await expect(page.getByRole('button', { name: 'Last set (tap to close)' })).toBeVisible();
  // Round 15: it floats over the felt like the auction, so the table doesn't move.
  const after = await areaTop();
  if (before !== null && after !== null) expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});

test('after a game, replay it set by set with every hand face up', async ({ page }) => {
  await page.goto(PRACTICE);
  const open = page.getByRole('button', { name: /Replay this game/ });
  // Never tap "Next game" here: the reveal must still be up when the replay opens.
  await playUntil(page, () => open.isVisible(), { stayOnReveal: true });
  await open.tap();
  const replay = page.getByRole('dialog', { name: /Replay of game/ });
  await expect(replay).toBeVisible();
  // It opens on the set that decided the game (Ryan), lit up on the strip.
  await expect(replay.getByText('This set decided it.')).toBeVisible();
  await expect(replay.locator('.lanes .set.decisive')).toHaveAttribute('aria-current', 'step');
  await expect(replay.locator('.hand')).toHaveCount(4);
  const sets = await replay.locator('.lanes .set').count();
  expect(sets).toBeGreaterThanOrEqual(1);
  // Back to the bidding, then set 1: four cards on the table, one marked as led and one as won.
  await replay.getByRole('button', { name: 'The bidding' }).tap();
  await expect(replay.getByText('The bidding', { exact: true })).toBeVisible();
  await replay.locator('.lanes .set').first().tap();
  await expect(replay.getByText(`Set 1 of ${sets}`)).toBeVisible();
  await expect(replay.locator('.table .spot')).toHaveCount(4);
  // One player led and one won (the same player gets a single "led · won" tag).
  await expect(replay.locator('.tag.led')).toHaveCount(1);
  await expect(replay.locator('.tag.won')).toHaveCount(1);
  // Each set's mark is the animal of the player who won it (as on the scoreboard), in their lane.
  const winner = await replay.locator('.hand').filter({ has: page.locator('.tag.won') }).locator('.who [data-animal]').getAttribute('data-animal');
  await expect(replay.locator('.lanes .set').first().locator('[data-animal]')).toHaveAttribute('data-animal', winner!);
  // Trumps carry the purple stripe, as at the table (Ryan): exactly the cards of the trump suit.
  const trump = await replay.getAttribute('data-trump');
  const symbol = { S: '♠', H: '♥', D: '♦', C: '♣' }[trump!] ?? null;
  for (let i = 1; i <= sets; i++) {
    await replay.locator('.lanes .set').nth(i - 1).tap();
    await expect(replay.getByText(`Set ${i} of ${sets}`)).toBeVisible();
    const labels = await replay.locator('.table .card').evaluateAll((cards) =>
      cards.map((c) => ({ label: c.getAttribute('aria-label') ?? '', trump: c.classList.contains('trump') })),
    );
    for (const { label, trump: striped } of labels) expect(striped, label).toBe(symbol !== null && label.endsWith(symbol));
  }
  await replay.getByRole('button', { name: 'Close the replay' }).tap();
  await expect(replay).toBeHidden();
  await expect(page.getByRole('button', { name: 'Next game' })).toBeVisible();
});

test('each game waits for its dealer: shuffle, tap Deal, and 52 cards fly out', async ({ page }) => {
  await page.goto(PRACTICE);
  const dealButton = page.getByRole('button', { name: 'Deal', exact: true });
  const shuffling = page.getByText(/is shuffling…/);
  // Play along until a game is waiting to be dealt (by me, or by a bot). Note which: at test
  // speed a bot deals within a fraction of a second, so it can't be checked again afterwards.
  let botDeals = false;
  await playUntil(page, async () => (await dealButton.isVisible()) || (botDeals = await shuffling.isVisible()), { noDeal: true });
  if (botDeals) {
    // A bot is dealing: no Deal button for me, and the cards arrive when it deals.
    await expect(dealButton).toHaveCount(0);
    await expect(page.locator('.hand .slot')).toHaveCount(13, { timeout: 15_000 });
    return;
  }
  // I'm the dealer: the deck shuffles, and nothing happens until I tap Deal (no automatic deal).
  await expect(page.locator('.deck')).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(dealButton).toBeVisible();
  await expect(page.locator('.hand .slot')).toHaveCount(0);
  const before = await soundCount(page, 'dealCard');
  await dealButton.tap();
  await expect(page.locator('.hand .slot')).toHaveCount(13);
  await expect.poll(async () => (await soundCount(page, 'dealCard')) - before).toBe(52);
  await expect.poll(async () => (await sounds(page)).includes('fan')).toBe(true);
});
