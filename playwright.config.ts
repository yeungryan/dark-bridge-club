import { defineConfig, devices } from '@playwright/test';

const PORT = 8788;
// A night where Ryan (played by the test, not a bot) is drawn captain, so the partner pick is covered.
const TEST_SEED = '000000080000dea100b21d9e0000c1ab';

export default defineConfig({
  testDir: 'e2e',
  timeout: 5 * 60_000,
  workers: 1,
  // On GitHub, also report failures as annotations so they're readable from the API.
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
  },
  webServer: {
    // A fresh, throwaway table every run. Keys are passed explicitly because .dev.vars is not committed.
    command: `rm -rf .e2e-state && cd packages/server && WRANGLER_SEND_METRICS=false npx wrangler dev --port ${PORT} --ip 127.0.0.1 --persist-to ../../.e2e-state --var ROOM_KEY:dev --var ADMIN_KEY:dev-admin --var TEST_SEED:${TEST_SEED}`,
    url: `http://127.0.0.1:${PORT}/api/profiles?k=dev`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
