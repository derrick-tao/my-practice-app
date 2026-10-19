import { defineConfig, devices } from '@playwright/test';

// Seam 1: the built app served under the real base path, driven in WebKit with iPhone and iPad
// device profiles in portrait and landscape.
//
// Two servers:
//  - fixture build (`--mode e2e`, tests/fixtures/content/e2e) on 4173: used by almost every spec
//  - the production build (real content/) on 4174: used only by published-site.spec.ts
import { FIXTURE_BASE_URL as BASE_URL, FIXTURE_PORT as PORT, REAL_BASE_URL, REAL_PORT } from './tests/e2e/servers.ts';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    // The app registers a service worker (ticket 14). Almost every spec runs with it blocked, so a cached
    // response can never stand in for the server and page.route() interception keeps working. Only the
    // offline/update specs opt in (tests/e2e/pwa-site.ts).
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  // iphone-portrait runs every test. The other three profiles only run the tests tagged @layout (sizes, fit on
  // screen, touch targets), because everything else behaves the same at any screen size. Tag a test
  // `{ tag: '@layout' }` if its outcome depends on the viewport.
  projects: [
    { name: 'iphone-portrait', use: { ...devices['iPhone 15'] } },
    { name: 'iphone-landscape', use: { ...devices['iPhone 15 landscape'] }, grep: /@layout/ },
    { name: 'ipad-portrait', use: { ...devices['iPad (gen 11)'] }, grep: /@layout/ },
    { name: 'ipad-landscape', use: { ...devices['iPad (gen 11) landscape'] }, grep: /@layout/ },
  ],
  webServer: [
    {
      // Fixture content + the app into dist-e2e, then serve it.
      command: `npm run build:e2e && npx vite preview --mode e2e --outDir dist-e2e --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // The exact artifact that gets deployed (real content in dist/).
      command: `npm run build && npx vite preview --port ${REAL_PORT} --strictPort`,
      url: REAL_BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
