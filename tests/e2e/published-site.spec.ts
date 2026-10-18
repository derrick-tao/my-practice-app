// Smoke test of the production build (real content/, the artifact that gets deployed to Pages).
import { REAL_BASE_URL } from './servers.ts';
import { expect, test } from './harness.ts';

test.use({ baseURL: REAL_BASE_URL });

test('the Fall 2026 Assessment card shows its test dates and 37 characters', async ({ page }) => {
  await page.goto('./');
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
  loadList,
}) => {
  const list = await loadList('fall-2026-assessment');
  expect(list.items).toHaveLength(37);
  for (const item of list.items) {
    for (const ref of [item.audio.normal, item.audio.slow]) {
      expect((await page.request.get(`content/${ref}`)).status(), `${item.target} ${ref}`).toBe(200);
    }
  }
});
