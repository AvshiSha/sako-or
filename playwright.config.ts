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
      // The staff specs are excluded here and run in the iPad projects below.
      // Without this, a serial suite would walk them four times for no coverage.
      testIgnore: /staff-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Chromium with a phone's metrics, touch and DPR — the layout responds to
      // those, and Chromium is the only browser installed here. Kept because
      // the PDP renders a separate buy box per breakpoint, so a desktop-only
      // run would not exercise the controls a real ad click actually touches.
      name: 'mobile',
      testIgnore: /staff-.*\.spec\.ts/,
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', isMobile: true, hasTouch: true },
    },
    // The warehouse screen's primary device is a shared iPad, and the brief
    // requires both orientations, so it gets its own two projects rather than
    // riding on the phone profile.
    //
    // `testMatch` is what keeps these from re-running the whole suite: this
    // config is serial with a 90s timeout and a cold-start compile.
    //
    // `defaultBrowserType: 'chromium'` is load-bearing. `devices['iPad (gen 7)']`
    // defaults to webkit, which is not installed here - see the mobile note above.
    //
    // `isMobile: false`: Chromium's mobile emulation forces a narrow visual
    // viewport that does not match how iPadOS reports itself, and the layout
    // branches on width.
    {
      name: 'ipad-portrait',
      testMatch: /staff-.*\.spec\.ts/,
      use: {
        ...devices['iPad (gen 7)'],
        defaultBrowserType: 'chromium',
        isMobile: false,
        hasTouch: true,
        viewport: { width: 810, height: 1080 },
      },
    },
    {
      name: 'ipad-landscape',
      testMatch: /staff-.*\.spec\.ts/,
      use: {
        ...devices['iPad (gen 7) landscape'],
        defaultBrowserType: 'chromium',
        isMobile: false,
        hasTouch: true,
        viewport: { width: 1080, height: 810 },
      },
    },
  ],
})
