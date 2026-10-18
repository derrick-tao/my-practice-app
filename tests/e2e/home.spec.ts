import { expect, test } from './harness.ts';

test.describe('home screen', () => {
  test('shows a card for each published list with title, test dates and character count', async ({ page }) => {
    await page.goto('./');

    const card = page.getByRole('link', { name: /Fixture Three/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Test: 2026-11-02 to 2026-11-06');
    await expect(card).toContainText('3 characters');

    const noDates = page.getByRole('link', { name: /Fixture Five/ });
    await expect(noDates).toBeVisible();
    await expect(noDates).toContainText('5 characters');
    await expect(noDates).not.toContainText('Test:');
  });

  test('fits every card inside the screen in this orientation', async ({ page }) => {
    await page.goto('./');
    const viewport = page.viewportSize()!;
    for (const name of [/Fixture Three/, /Fixture Five/]) {
      const card = page.getByRole('link', { name });
      await card.scrollIntoViewIfNeeded();
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      // Big, finger-friendly cards.
      expect(box.height).toBeGreaterThanOrEqual(96);
    }
  });

  test('tapping a card opens its list route under subject / practice type / list', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('link', { name: /Fixture Three/ }).click();

    await expect(page).toHaveURL(/#\/chinese\/dictation\/fixture-three$/);
    await expect(page.getByRole('heading', { name: 'Fixture Three' })).toBeVisible();

    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();
  });

  test('opening a list route directly works', async ({ page }) => {
    await page.goto('./#/chinese/dictation/fixture-five');
    await expect(page.getByRole('heading', { name: 'Fixture Five' })).toBeVisible();
  });

  test('a route that is not a list falls back to home; an unknown list offers a way home', async ({ page }) => {
    await page.goto('./#/nowhere');
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();

    await page.goto('./#/chinese/dictation/no-such-list');
    await expect(page.getByText("We couldn't find this list.")).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();
  });

  test('loads everything from the app origin under the base path, with no failures', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const failures: string[] = [];
    const foreign: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(origin)) foreign.push(request.url());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => failures.push(`failed ${request.url()}`));

    await page.goto('./');
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();

    expect(foreign).toEqual([]);
    expect(failures).toEqual([]);
  });
});
