import { defineConfig } from 'vitest/config';

// Seam 2 (content pipeline) tests only. Seam 1 lives in tests/e2e and is run by Playwright.
export default defineConfig({
  test: {
    include: ['tests/content/**/*.test.ts'],
    environment: 'node',
  },
});
