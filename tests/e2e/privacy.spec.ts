// Seam 1, scenario 16: privacy. Learner data stays on the device, so while the app runs, no request may leave
// the app's own origin (no analytics, third-party fonts, CDNs, or anything else).
import { expect, test as base } from './harness.ts';
import { PracticeScreen } from './practice-driver.ts';

const test = base.extend<{ outsideRequests: string[] }>({
  // Collected at the context level, so requests from workers and any other page are seen as well as the page's own.
  outsideRequests: async ({ context, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    const outside: string[] = [];
    context.on('request', (request) => {
      const url = request.url();
      // data:, blob: and about: URLs are resolved on the device and cannot leave it.
      if (/^(https?|wss?|ftp):/i.test(url) && new URL(url).origin !== origin) outside.push(url);
    });
    await use(outside);
  },
});

// The one place that decides how the walk reaches each screen. When the first-run setup and the parent area land
// (tickets 06/07), extend this flow (or swap in their setup helper) and the test below follows.
test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test("across first load, practice and resuming, every request goes to the app's own origin", async ({
  page,
  audio,
  loadList,
  outsideRequests,
}) => {
  const practice = new PracticeScreen(page, audio, await loadList('fixture-three'));

  // A full practice: one wrong word, the round summary, the retry round, and the completion screen.
  await expect(practice.listCard()).toBeVisible();
  await practice.listCard().click();
  await practice.playRound((_, index) => index !== 0);
  await expect(practice.summary).toBeVisible();
  await practice.playRetryRound(() => true);
  await expect(practice.completion).toBeVisible();

  // Back home and a reload: reading saved data on the device is just as local.
  await practice.home.click();
  await page.reload();
  await expect(practice.listCard()).toBeVisible();

  expect(outsideRequests).toEqual([]);
});
