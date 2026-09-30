/**
 * U4 compositor proof configuration (packet U4, deliverable 2).
 *
 * Own config: the repository's root `playwright.config.ts` (guide-site preview on :4173) is
 * untouched. This config serves the built candidate harness from `packages/viewer-thatopen/dist`
 * plus the published data tree read-only (see `e2e/serve.mjs`).
 */
import { defineConfig } from '@playwright/test';

const baseURL = `http://127.0.0.1:${process.env.U4_PORT ?? 4399}`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    trace: 'off',
  },
  webServer: {
    command: 'node e2e/serve.mjs',
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
