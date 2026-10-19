import { defineConfig } from 'vitest/config';

// Seam 2 (content pipeline) tests, plus unit tests of pure computations (tests/unit, e.g. the progress
// numbers). Seam 1 lives in tests/e2e and is run by Playwright.
export default defineConfig({
  test: {
    include: ['tests/content/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    // CLI tests spawn `npx tsx` processes; give them room when the whole suite runs in parallel.
    testTimeout: 30_000,
  },
});
