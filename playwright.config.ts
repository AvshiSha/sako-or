import { defineConfig, devices } from '@playwright/test'

/**
 * Browser-level regression tests: the two tracking defects fixed on 2026-10-08
 * and the two order-summary defects fixed on 2026-10-09 — see
 * tests/e2e/README.md.
 *
 * Deliberately has **no `webServer`**: these must run against a production
 * build, and starting one from here would rebuild or tear it down between
 * projects. Start the server yourself and point the run at it with
 * `QA_BASE_URL`; tests/e2e/README.md has the commands and explains why the dev
 * server cannot be used.
 *
 * 127.0.0.1 rather than `localhost`, because on Windows `localhost` resolves to
 * ::1 first and the connection is refused.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // The PDP hits Firestore and the real image CDN on a cold start.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Serial: the pixel assertions count events per page, and a parallel worker
  // would have these specs competing for the same cold-start compile.
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: 'test-results/report.json' }]],
  use: {
    baseURL: process.env.QA_BASE_URL || 'http://127.0.0.1:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Chromium with a phone's metrics, touch and DPR — the layout responds to
      // those, and Chromium is the only browser installed here. Kept because
      // the PDP renders a separate buy box per breakpoint, so a desktop-only
      // run would not exercise the controls a real ad click actually touches.
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', isMobile: true, hasTouch: true },
    },
  ],
})
