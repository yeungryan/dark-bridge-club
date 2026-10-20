# Putting DARK Bridge Club online

This takes about 15 minutes, once. After that, every change merged into `main` goes live automatically.

It costs $0. Everything runs on Cloudflare's free plan.

---

## Step 1: Create a free Cloudflare account

1. Go to **https://dash.cloudflare.com/sign-up** and sign up. Verify your email.
2. In the left menu, open **Compute (Workers)** (it may be called **Workers & Pages**).
3. The first time, Cloudflare asks you to **choose a subdomain**, e.g. `dark-club`. This becomes part of your game's address:
   `https://dark-bridge-club.<your-subdomain>.workers.dev`
   If it doesn't ask, you'll find your subdomain on that page later.

## Step 2: Copy two values from Cloudflare

**Account ID**
1. On the **Compute (Workers)** overview page, look on the right side for **Account ID**.
2. Click copy, and paste it somewhere temporary, like a note on your phone.

**API token** (lets GitHub publish the game for you)
1. Click your profile icon (top right) → **My Profile** → **API Tokens**.
2. Click **Create Token**.
3. Next to **Edit Cloudflare Workers**, click **Use template**.
4. Under **Account Resources**, pick your account. Under **Zone Resources**, choose **All zones**.
5. Click **Continue to summary**, then **Create Token**.
6. **Copy the token now.** Cloudflare shows it only once.

## Step 3: Make up two passwords

- **ROOM_KEY**: the secret part of the link you'll share with the guys. Use **letters and numbers only** (no spaces or symbols), at least 20 characters, e.g. from a password generator.
- **ADMIN_KEY**: a different random password, just for you. It resets a forgotten PIN.

## Step 4: Add four secrets to GitHub

1. Open **https://github.com/yeungryan/dark-bridge-club**.
2. Click **Settings** (top tab), then in the left menu **Secrets and variables → Actions**.
3. Click **New repository secret** four times, once for each:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | the account ID from step 2 |
| `ROOM_KEY` | your link password from step 3 |
| `ADMIN_KEY` | your admin password from step 3 |

Names must match exactly (capital letters, underscores).

## Step 5: Publish

- When the pull request is merged into `main`, GitHub runs the **Tests**, then the **Deploy**. Watch them under the repository's **Actions** tab. A green tick means it worked.
- Or publish right away: **Actions** tab → **Deploy** (left list) → **Run workflow** → **Run workflow**.

## Step 6: Your link

```
https://dark-bridge-club.<your-subdomain>.workers.dev/?k=<ROOM_KEY>
```

- The first time each person opens it, they tap their name and **choose a 4-digit PIN**.
- After that, the link opens straight to the table on that device.
- Anyone without the `?k=…` part can't get in.

---

## Practising alone with bots (for the M1 checkpoint)

1. **On your phone**, open your link and sign in as Ryan.
2. **On a laptop**, open:
   ```
   https://dark-bridge-club.<your-subdomain>.workers.dev/dev.html?k=<ROOM_KEY>&seats=darren,adrian,kim&pins=1111,2222,4444&bots=1,1,1
   ```
   Darren, Adrian and Kim are now practice bots. The night starts as soon as all four are connected. Leave the laptop tab open while you play.
3. To finish, tap **☰ → End the night** on your phone. The bots agree automatically.

> ⚠️ **Before inviting the guys:** practising sets PINs 1111/2222/4444 on their profiles. Open
> `https://dark-bridge-club.<your-subdomain>.workers.dev/admin.html`, enter your **ADMIN_KEY**,
> and reset **Darren**, **Adrian** and **Kim**, so each can choose his own PIN.

## If something goes wrong

- **A red ✗ in the Actions tab:** click it to see the log, and tell Claude what it says.
- **Forgotten PIN:** use `admin.html` (above).
- **"That link is not right":** the `?k=` part doesn't match `ROOM_KEY`. Copy it again carefully.
