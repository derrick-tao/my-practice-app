// Seam 1: the What's new section of the parent area: the release log, newest first, with the installed
// release marked and newer ones flagged. Two kinds of test: those that stub the log (the plain harness, where
// the service worker is blocked so page.route sees every request) and those that need the real worker for the
// cached copy offline (pwa-site.ts, which can also publish a newer release).
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './harness.ts';
import { openParentArea, openParentSection, setUpLearner } from './parent-driver.ts';
import { expect as pwaExpect, test as pwaTest } from './pwa-site.ts';

// The fixture log (tests/fixtures/content/e2e/releases.json): the build is "Fixture second release", the newest in it.
const SECOND = { title: 'Fixture second release', date: 'Feb 2, 2026', bullet: 'The second thing got better.' };
const FIRST = { title: 'Fixture first release', date: 'Jan 1, 2026', bullet: 'The first thing got better.' };
const NEWER = { title: 'Fixture newer release', date: 'Mar 3, 2026', bullet: 'Something newer got better.' };

// Release dates are plain days; a grown-up west of Greenwich must still read the day that was written.
test.use({ timezoneId: 'America/Los_Angeles' });
pwaTest.use({ timezoneId: 'America/Los_Angeles' });

async function openWhatsNew(page: Page): Promise<void> {
  await openParentArea(page);
  await openParentSection(page, "What's new");
  await expect(page.getByRole('heading', { name: "What's new", exact: true })).toBeVisible();
}

/** One release in the list, found by its title. */
const release = (page: Page, title: string): Locator => page.getByRole('listitem').filter({ hasText: title });

/** The list holds exactly these releases, top to bottom. */
const expectTitles = (page: Page, expected: string[]): Promise<void> =>
  expect(page.getByTestId('release-title')).toHaveText(expected);

test.describe("What's new: the list", () => {
  test("appears in the parent area menu between Backup and Danger zone, with Danger zone last", async ({ page }) => {
    await setUpLearner(page);
    await openParentArea(page);
    const entries = await page.locator('.parent__entry').allTextContents();
    const names = entries.map((text) => text.replace(/^\S+\s/, '').trim());
    expect(names.slice(-3)).toEqual(['Backup', "What's new", 'Danger zone']);
  });

  test('lists every release newest first: the newest open, older ones folded to title and date, any can be opened', async ({ page }) => {
    await setUpLearner(page);
    await openWhatsNew(page);

    await expectTitles(page, [SECOND.title, FIRST.title]);
    await expect(release(page, SECOND.title)).toContainText(SECOND.date);
    await expect(release(page, FIRST.title)).toContainText(FIRST.date);

    // The newest shows its bullets; the older one shows only title and date.
    await expect(page.getByText(SECOND.bullet)).toBeVisible();
    await expect(page.getByText(FIRST.bullet)).toBeHidden();

    await release(page, FIRST.title).getByText(FIRST.title).click();
    await expect(page.getByText(FIRST.bullet)).toBeVisible();
    // Opening one leaves the other as it was.
    await expect(page.getByText(SECOND.bullet)).toBeVisible();

    await release(page, SECOND.title).getByText(SECOND.title).click();
    await expect(page.getByText(SECOND.bullet)).toBeHidden();
  });

  test('marks the release the app is as Installed, and nothing else when the app is the newest', async ({ page }) => {
    await setUpLearner(page);
    await openWhatsNew(page);

    await expect(release(page, SECOND.title)).toContainText('Installed');
    await expect(release(page, FIRST.title)).not.toContainText('Installed');
    await expect(page.getByText('Update available')).toHaveCount(0);
    await expect(page.getByText("Couldn't load the latest notes")).toHaveCount(0);
  });

  test("when the log is not the app's own (the installed release is missing from it), it says the notes could not load and still shows the installed release", async ({ page }) => {
    await page.route('**/content/releases.json', (route) =>
      route.fulfill({ json: [{ id: 'something-else', date: '2026-03-03', title: 'Some other release', bullets: ['Other.'] }] }),
    );
    await setUpLearner(page);
    await openWhatsNew(page);

    await expect(page.getByText("Couldn't load the latest notes")).toBeVisible();
    await expectTitles(page, [SECOND.title]);
    await expect(release(page, SECOND.title)).toContainText('Installed');
    await expect(page.getByText(SECOND.bullet)).toBeVisible();
    await expect(page.getByText('Some other release')).toHaveCount(0);
  });

  test('when the log cannot be loaded at all, it says so and still shows the installed release', async ({ page }) => {
    await page.route('**/content/releases.json', (route) => route.fulfill({ status: 500 }));
    await setUpLearner(page);
    await openWhatsNew(page);

    await expect(page.getByText("Couldn't load the latest notes")).toBeVisible();
    await expectTitles(page, [SECOND.title]);
    await expect(release(page, SECOND.title)).toContainText('Installed');
    await expect(page.getByText('Update available')).toHaveCount(0);
  });
});

const updateCard = (page: Page): Locator => page.getByTestId('update-card');

test.describe("What's new: the top card", () => {
  test("nothing waiting and the app is the newest release: \"You're up to date\" with its date, no Update now", async ({ page }) => {
    await setUpLearner(page);
    await openWhatsNew(page);

    await expect(updateCard(page)).toContainText("You're up to date");
    await expect(updateCard(page)).toContainText(SECOND.date);
    await expect(page.getByRole('button', { name: 'Update now' })).toHaveCount(0);
  });

  test('nothing waiting but the log already lists a newer release (deploy in flight): nothing to install yet, no Update now', async ({ page }) => {
    await page.route('**/content/releases.json', (route) =>
      route.fulfill({
        json: [
          { id: 'fixture-newer', date: '2026-03-03', title: NEWER.title, bullets: [NEWER.bullet] },
          { id: 'fixture-second', date: '2026-02-02', title: SECOND.title, bullets: [SECOND.bullet] },
        ],
      }),
    );
    await setUpLearner(page);
    await openWhatsNew(page);

    await expect(updateCard(page)).toContainText('Nothing to install yet');
    await expect(updateCard(page)).not.toContainText("You're up to date");
    await expect(page.getByRole('button', { name: 'Update now' })).toHaveCount(0);
    // The list still previews it, flagged as not installed.
    await expect(release(page, NEWER.title)).toContainText('Update available');
  });
});

async function startOnline(page: Page): Promise<void> {
  await setUpLearner(page);
  await pwaExpect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await pwaExpect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

pwaTest.describe("What's new: with a newer release published", () => {
  pwaTest('releases newer than the installed one are Update available, above Installed, newest first', async ({ page, site }) => {
    await startOnline(page);
    await site.deployNewVersion();
    await page.reload();
    await openWhatsNew(page);

    await expectTitles(page, [NEWER.title, SECOND.title, FIRST.title]);
    await pwaExpect(release(page, NEWER.title)).toContainText('Update available');
    await pwaExpect(release(page, NEWER.title)).toContainText(NEWER.date);
    await pwaExpect(release(page, SECOND.title)).toContainText('Installed');
    await pwaExpect(release(page, SECOND.title)).not.toContainText('Update available');
    await pwaExpect(release(page, FIRST.title)).not.toContainText('Installed');
    await pwaExpect(release(page, FIRST.title)).not.toContainText('Update available');

    // The newest is open (that is the one the grown-up has not seen); the installed one is folded.
    await pwaExpect(page.getByText(NEWER.bullet)).toBeVisible();
    await pwaExpect(page.getByText(SECOND.bullet)).toBeHidden();
  });
});

pwaTest.describe("What's new: offline", () => {
  pwaTest('shows the last log the device saw', async ({ page, context }) => {
    await startOnline(page);
    await context.setOffline(true);
    await page.reload();
    await openWhatsNew(page);

    await expectTitles(page, [SECOND.title, FIRST.title]);
    await pwaExpect(release(page, SECOND.title)).toContainText('Installed');
    await pwaExpect(page.getByText("Couldn't load the latest notes")).toHaveCount(0);
  });

  pwaTest('with no cached log, shows the installed release and says the notes could not load', async ({ page, context }) => {
    await startOnline(page);
    await page.evaluate(async () => {
      for (const name of await caches.keys()) await (await caches.open(name)).delete('content/releases.json');
    });
    await context.setOffline(true);
    await page.reload();
    await openWhatsNew(page);

    await pwaExpect(page.getByText("Couldn't load the latest notes")).toBeVisible();
    await expectTitles(page, [SECOND.title]);
    await pwaExpect(release(page, SECOND.title)).toContainText('Installed');
    await pwaExpect(page.getByText(SECOND.bullet)).toBeVisible();
  });
});

pwaTest.describe("What's new: an update waiting", () => {
  pwaTest('the top card offers Update now and previews the newer release', async ({ page, site }) => {
    await startOnline(page);
    await site.deployNewVersion();
    await page.evaluate(async () => void (await (await navigator.serviceWorker.getRegistration())!.update()));
    await pwaExpect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
    await openWhatsNew(page);

    await pwaExpect(page.getByRole('button', { name: 'Update now' })).toBeVisible();
    await pwaExpect(updateCard(page)).toContainText(NEWER.title);
    await pwaExpect(updateCard(page)).not.toContainText(SECOND.title);
    await pwaExpect(updateCard(page)).not.toContainText("You're up to date");
  });
});
