/**
 * Playwright config for Electron end-to-end tests.
 *
 * E2E was the one missing tier (the audit listed it as absent): every other check
 * either exercises pure logic or a headless IPC path, so nothing verified that the
 * app actually boots, renders a panel and completes the "click a graph node → open
 * the file" loop.
 *
 * Playwright drives the project's own Electron binary, so no browser download is
 * needed. Tests run serially: they share one Electron app instance per file and
 * mutate a temp APPDATA.
 *
 *   pnpm build && pnpm test:e2e
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // A packaged-style boot takes a few seconds; keep per-test budgets generous.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
})
