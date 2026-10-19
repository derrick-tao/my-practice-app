// Seam 1, scenario 16: privacy. Learner data stays on the device, so while the app runs, no request may leave
// the app's own origin (no analytics, third-party fonts, CDNs, or anything else).
import { expect, test as base } from './harness.ts';
import { failGate, passGate, setUpLearner } from './parent-driver.ts';
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

test("across first run, the gate, the parent area, practice and resuming, every request goes to the app's own origin", async ({
  page,
  audio,
  loadLesson,
  outsideRequests,
}) => {
  const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));

  // First run (welcome, gate, profile with a name, assigning lessons) is part of the walk: the child's name is typed
  // here, and it must stay on the device.
  await setUpLearner(page);

  // A full practice: one wrong word, the round summary, the retry round, and the completion screen.
  await expect(practice.lessonCard()).toBeVisible();
  await practice.lessonCard().click();
  await practice.playRound((_, index) => index !== 0);
  await expect(practice.summary).toBeVisible();
  await practice.playRetryRound(() => true);
  await expect(practice.completion).toBeVisible();

  // Back home, then the parent side: a failed and a passed gate, every parent section, and a write (assigning).
  await practice.home.click();
  await page.getByRole('link', { name: 'Parent area' }).click();
  await failGate(page);
  await passGate(page);
  await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toBeVisible();
  const entries = page.locator('.parent__entry');
  const sectionCount = await entries.count();
  expect(sectionCount).toBeGreaterThan(0);
  for (let i = 0; i < sectionCount; i++) {
    await entries.nth(i).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Grown-ups');
    // Writing to the device is local too: flip every switch a section offers, then flip it back.
    for (const toggle of await page.getByRole('switch').all()) {
      const before = (await toggle.getAttribute('aria-checked')) === 'true';
      await toggle.click();
      await expect(toggle).toBeChecked({ checked: !before });
      await toggle.click();
      await expect(toggle).toBeChecked({ checked: before });
    }
    await page.getByRole('link', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: /^Hi / })).toBeVisible();

  // A reload: reading saved data on the device is just as local.
  await page.reload();
  await expect(practice.lessonCard()).toBeVisible();

  expect(outsideRequests).toEqual([]);
});
