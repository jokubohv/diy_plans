import { defineConfig, devices } from '@playwright/test';

/**
 * Packet D (`p0.ifc-e2e`) Playwright configuration.
 *
 * The caller runs `npm run build` first; `npm run preview` serves the production build on
 * :4173. `reuseExistingServer` lets an already running preview server be reused so a full
 * `gate:p0` run does not restart the server between the thin-journey and UX slices.
 *
 * Traces are captured on the first retry; retries are otherwise disabled so a flaky failure is
 * reported as a failure (packet D: never weaken a check).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
