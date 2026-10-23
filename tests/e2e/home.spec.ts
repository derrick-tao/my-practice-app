import { expect, test } from './harness.ts';
import { setUpLearner } from './parent-driver.ts';
import { lessonGroup } from './practice-driver.ts';

test.describe('home screen', () => {
  test('shows a card for each published lesson with title, test dates and a button per practice type with its count', async ({ page }) => {
    await setUpLearner(page);

    const card = lessonGroup(page, 'Fixture Three');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Test: 2026-11-02 to 2026-11-06');
    await expect(card.getByRole('link')).toHaveCount(1);
    await expect(card.getByRole('link', { name: /Write · 3 characters/ })).toBeVisible();

    // Fixture Five has no test dates and offers two practice types: one button each.
    const both = lessonGroup(page, 'Fixture Five');
    await expect(both).toBeVisible();
    await expect(both).not.toContainText('Test:');
    await expect(both.getByRole('link')).toHaveCount(2);
    await expect(both.getByRole('link', { name: /Write · 5 characters/ })).toBeVisible();
    await expect(both.getByRole('link', { name: /Say · 6 phrases/ })).toBeVisible();
    await expect(both.getByRole('link', { name: /Write/ })).toContainText('✏️');
    await expect(both.getByRole('link', { name: /Say/ })).toContainText('🗣️');
  });

  test('fits every card inside the screen in this orientation', { tag: '@layout' }, async ({ page }) => {
    await setUpLearner(page);
    const viewport = page.viewportSize()!;
    for (const title of ['Fixture Three', 'Fixture Five']) {
      const card = lessonGroup(page, title);
      await card.scrollIntoViewIfNeeded();
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      // Big, finger-friendly buttons for each practice type.
      for (const button of await card.getByRole('link').all()) {
        const buttonBox = (await button.boundingBox())!;
        expect(buttonBox.x).toBeGreaterThanOrEqual(0);
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(viewport.width);
        expect(buttonBox.height).toBeGreaterThanOrEqual(96);
      }
    }
  });

  test('each practice type button opens its own list under subject / practice type / lesson', async ({ page }) => {
    await setUpLearner(page);
    await lessonGroup(page, 'Fixture Five').getByRole('link', { name: /Say/ }).click();
    await expect(page).toHaveURL(/#\/chinese\/phrase-recognition\/fixture-five$/);
    await expect(page.getByRole('heading', { name: 'Fixture Five' })).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();

    await lessonGroup(page, 'Fixture Five').getByRole('link', { name: /Write/ }).click();
    await expect(page).toHaveURL(/#\/chinese\/dictation\/fixture-five$/);
    await page.getByRole('link', { name: 'Home' }).click();

    await lessonGroup(page, 'Fixture Three').getByRole('link', { name: /Write/ }).click();

    await expect(page).toHaveURL(/#\/chinese\/dictation\/fixture-three$/);
    await expect(page.getByRole('heading', { name: 'Fixture Three' })).toBeVisible();

    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/#\/$/);
    // Each list started says Keep going on its own button (icon and label kept), on the lesson's one card.
    await expect(page.getByRole('link', { name: /Keep going/ })).toHaveCount(3);
    await expect(lessonGroup(page, 'Fixture Three').getByRole('link', { name: /^Write · Keep going/ })).toContainText('✏️');
    await expect(lessonGroup(page, 'Fixture Five').getByRole('link', { name: /^Say · Keep going/ })).toContainText('🗣️');
    await expect(lessonGroup(page, 'Fixture Five').getByRole('link', { name: /^Write · Keep going/ })).toBeVisible();
  });

  test('opening a lesson route directly works', async ({ page }) => {
    await setUpLearner(page);
    await page.goto('./#/chinese/dictation/fixture-five');
    await expect(page.getByRole('heading', { name: 'Fixture Five' })).toBeVisible();
  });

  test('a route that is not a lesson falls back to home; an unknown lesson offers a way home', async ({ page }) => {
    await setUpLearner(page);
    await page.goto('./#/nowhere');
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();

    await page.goto('./#/chinese/dictation/no-such-list');
    await expect(page.getByText("We couldn't find this lesson.")).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();
  });

  test('a practice type the lesson does not offer is not a screen', async ({ page }) => {
    await setUpLearner(page);
    // Fixture Three has no phrase-recognition list.
    await page.goto('./#/chinese/phrase-recognition/fixture-three');
    await expect(page.getByText("We couldn't find this lesson.")).toBeVisible();
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

    await setUpLearner(page);
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();

    expect(foreign).toEqual([]);
    expect(failures).toEqual([]);
  });
});
