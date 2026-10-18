// Ports and URLs of the two servers playwright.config.ts starts. Both serve under the real base path.
// E2E_FIXTURE_PORT / E2E_REAL_PORT let several checkouts run Seam 1 at the same time.
export const BASE_PATH = '/my-practice-app/';
/** Fixture-content build (`--mode e2e`): used by almost every spec. */
export const FIXTURE_PORT = Number(process.env.E2E_FIXTURE_PORT ?? 4173);
export const FIXTURE_BASE_URL = `http://localhost:${FIXTURE_PORT}${BASE_PATH}`;
/** Production build with the real content/: used only by published-site.spec.ts. */
export const REAL_PORT = Number(process.env.E2E_REAL_PORT ?? 4174);
export const REAL_BASE_URL = `http://localhost:${REAL_PORT}${BASE_PATH}`;
