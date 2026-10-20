import { defineConfig, devices } from '@playwright/test';

const PORT = 8788;

export default defineConfig({
  testDir: 'e2e',
  timeout: 5 * 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
  },
  webServer: {
    // A fresh, throwaway table every run.
    command: `rm -rf .e2e-state && cd packages/server && WRANGLER_SEND_METRICS=false npx wrangler dev --port ${PORT} --ip 127.0.0.1 --persist-to ../../.e2e-state`,
    url: `http://127.0.0.1:${PORT}/api/profiles?k=dev`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
