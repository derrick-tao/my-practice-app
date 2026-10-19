// Smoke test of the production build (real content/, the artifact that gets deployed to Pages).
import { REAL_BASE_URL } from './servers.ts';
import { expect, lessonPath, test } from './harness.ts';
import { setUpLearner } from './parent-driver.ts';

test.use({ baseURL: REAL_BASE_URL });

test('the Fall 2026 Assessment card shows its test dates and 37 characters', { tag: '@layout' }, async ({ page }) => {
  await setUpLearner(page); // against the real manifest, with every published lesson assigned
  const card = page.getByRole('link', { name: /Fall 2026 Assessment/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Test: 2026-10-26 to 2026-10-30');
  await expect(card).toContainText('37 characters');

  const viewport = page.viewportSize()!;
  const box = (await card.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
});

test('the deployed app carries no test-only hooks (seeded random, forced storage failures)', async ({ page }) => {
  await page.goto('./');
  const scripts = await page.evaluate(() =>
    Array.from(document.scripts, (s) => s.src).filter((src) => src.includes('/assets/')),
  );
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) {
    const code = await (await page.request.get(src)).text();
    expect(code, src).not.toContain('__practiceSeed');
    expect(code, src).not.toContain('__failStorageWrites');
  }
});

test('every one of the 37 items has normal and slow audio references that resolve', async ({
  page,
  loadLesson,
}) => {
  const lesson = await loadLesson('fall-2026-assessment');
  expect(lesson.lists.dictation!).toHaveLength(37);
  for (const item of lesson.lists.dictation!) {
    for (const ref of [item.audio.normal, item.audio.slow]) {
      expect((await page.request.get(`content/${ref}`)).status(), `${item.target} ${ref}`).toBe(200);
    }
  }
});

test('the service worker precaches the shell, the content manifest, every lesson and all 74 audio files', async ({
  page,
  loadLesson,
}) => {
  const lesson = await loadLesson('fall-2026-assessment');
  const source = await (await page.request.get('sw.js')).text();
  const precache = JSON.parse(/const PRECACHE = (\{.*\});/.exec(source)![1]!) as { buildId: string; urls: string[] };
  expect(precache.buildId).toMatch(/^[0-9a-f]{12}$/);

  const audio = lesson.lists.dictation!.flatMap((item) => [item.audio.normal, item.audio.slow]);
  expect(audio).toHaveLength(74);
  expect(precache.urls).toEqual(
    expect.arrayContaining([
      'index.html',
      'manifest.webmanifest',
      'content/manifest.json',
      await lessonPath(page.request, 'fall-2026-assessment'),
    ]),
  );
  expect(precache.urls).toEqual(expect.arrayContaining(audio.map((ref) => `content/${ref}`)));
  // Same-origin only: every entry is a relative path inside the site.
  for (const url of precache.urls) expect(url, url).not.toMatch(/^([a-z]+:)?\/\//);
  // Every entry exists on the server (otherwise the worker could never finish installing).
  for (const url of precache.urls) expect((await page.request.get(url)).status(), url).toBe(200);
});

test('the web app manifest makes the app installable: standalone, any orientation, icons', async ({ page }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await page.request.get(new URL(href!, page.url()).href);
  expect(response.status()).toBe(200);
  const manifest = (await response.json()) as {
    display: string;
    orientation: string;
    start_url: string;
    scope: string;
    theme_color: string;
    icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  };
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('any');
  expect(manifest.theme_color).toMatch(/^#/);
  expect(new URL(manifest.start_url, response.url()).href).toBe(new URL('./', page.url()).href);
  expect(new URL(manifest.scope, response.url()).href).toBe(new URL('./', page.url()).href);
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons.find((i) => i.sizes === size && i.type === 'image/png');
    expect(icon, size).toBeDefined();
    expect((await page.request.get(new URL(icon!.src, response.url()).href)).status(), size).toBe(200);
  }
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  expect(await page.locator('link[rel="apple-touch-icon"]').count()).toBe(1);
});
