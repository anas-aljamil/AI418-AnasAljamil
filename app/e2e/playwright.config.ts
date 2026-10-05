import { defineConfig } from '@playwright/test';

/**
 * Screenshots and checks of the Expo web build (docs/plan.md, P3b).
 * Expects the exported site on :8081 (`npm run export:web && npx expo serve --port 8081`)
 * and, for the connection check, the API on :8000.
 */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:8081',
    launchOptions: {
      // The sandbox ships its own Chromium; elsewhere Playwright's bundled browser is used.
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  },
});
