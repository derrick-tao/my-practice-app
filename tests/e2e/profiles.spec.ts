// Seam 1: several learners on one device (ticket 08): add / edit / delete / switch profiles.
import type { Page } from '@playwright/test';
import type { ListData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { addLearner, openProfiles, openSettings, setUpLearner } from './parent-driver.ts';
import { PracticeScreen } from './practice-driver.ts';
import { savedSessionProfileIds } from './saved-data.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadList: (id: string) => Promise<ListData>;
}

async function screenFor({ page, audio, loadList }: Fixtures, listId: string): Promise<PracticeScreen> {
  return new PracticeScreen(page, audio, await loadList(listId));
}

/** Grown-up adds a learner from the home screen and comes back to the child's home. */
async function addLearnerFromHome(page: Page, learner: Parameters<typeof addLearner>[1]): Promise<void> {
  await openProfiles(page);
  await addLearner(page, learner);
  await page.getByRole('link', { name: 'Home' }).click();
}

const switcher = (page: Page) => page.getByRole('group', { name: 'Who is practicing?' });

test.describe('profiles: switching', () => {
  test('two learners keep separate lists and in-progress sessions; the avatar row switches between them', async ({
    page,
    audio,
    loadList,
  }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼', lists: ['fixture-three'] });
    const three = await screenFor({ page, audio, loadList }, 'fixture-three');
    const five = await screenFor({ page, audio, loadList }, 'fixture-five');

    // Mia is half way through fixture-three.
    await three.listCard().click();
    await three.markNext(true);
    await expect(three.progressText()).toHaveText('1 / 3');
    await three.home.click();
    await expect(three.keepGoing).toBeVisible();

    await addLearnerFromHome(page, { name: 'Leo', avatar: '🦊', lists: ['fixture-five'] });
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible(); // adding does not switch
    await expect(switcher(page).getByRole('button')).toHaveCount(2);

    // Leo: his own lists, no Keep going.
    await switcher(page).getByRole('button', { name: 'Leo' }).click();
    await expect(page.getByRole('heading', { name: 'Hi 🦊 Leo!' })).toBeVisible();
    await expect(five.listCard()).toBeVisible();
    await expect(three.listCard()).toHaveCount(0);
    await expect(three.keepGoing).toHaveCount(0);

    // Leo practices fixture-five.
    await five.listCard().click();
    await five.markMany(2);
    await expect(five.progressText()).toHaveText('2 / 5');
    await five.home.click();
    await expect(five.keepGoing).toContainText('Fixture Five');

    // Back to Mia: her card, her list, her place.
    await switcher(page).getByRole('button', { name: 'Mia' }).click();
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await expect(three.keepGoing).toContainText('Fixture Three');
    await expect(five.listCard()).toHaveCount(0);
    await three.keepGoing.click();
    await expect(three.progressText()).toHaveText('1 / 3');
  });

  test('the chosen learner is remembered after a reload', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    await addLearnerFromHome(page, { name: 'Leo', avatar: '🦊' });
    await switcher(page).getByRole('button', { name: 'Leo' }).click();
    await expect(page.getByRole('heading', { name: 'Hi 🦊 Leo!' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hi 🦊 Leo!' })).toBeVisible();
    await expect(switcher(page).getByRole('button', { name: 'Leo' })).toHaveAttribute('aria-pressed', 'true');
    await expect(switcher(page).getByRole('button', { name: 'Mia' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('a grown-up can switch the active learner from the Profiles section', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    await openProfiles(page);
    await addLearner(page, { name: 'Leo', avatar: '🦊' });
    await page.getByRole('button', { name: 'Switch to Leo' }).click();
    await expect(page.getByRole('button', { name: 'Switch to Leo' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Switch to Mia' })).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Hi 🦊 Leo!' })).toBeVisible();
  });

  test('with a single learner there is no avatar row', async ({ page }) => {
    await setUpLearner(page);
    await expect(switcher(page)).toHaveCount(0);
  });

  test('the avatar buttons are finger-sized and fit on screen', async ({ page }) => {
    await setUpLearner(page);
    await addLearnerFromHome(page, { name: 'Leo', avatar: '🦊' });
    const viewport = page.viewportSize()!;
    for (const button of await switcher(page).getByRole('button').all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(64);
      expect(box.height).toBeGreaterThanOrEqual(64);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
  });

  test('settings belong to each learner', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    await addLearnerFromHome(page, { name: 'Leo', avatar: '🦊' });

    await openSettings(page); // Mia's
    await page.getByRole('switch', { name: 'Shuffle the first round' }).click();
    await page.getByRole('radio', { name: '5', exact: true }).click();
    await expect(page.getByRole('radio', { name: '5', exact: true })).toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();

    await switcher(page).getByRole('button', { name: 'Leo' }).click();
    await openSettings(page);
    await expect(page.getByText('Settings for 🦊 Leo')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Shuffle the first round' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '10', exact: true })).toBeChecked();
  });
});

test.describe('profiles: edit', () => {
  test('a grown-up can change a learner\'s name and avatar', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    await openProfiles(page);
    await page.getByRole('button', { name: 'Edit Mia' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Mimi');
    await page.getByRole('button', { name: '🦄', exact: true }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Edit Mimi' })).toBeVisible();

    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Hi 🦄 Mimi!' })).toBeVisible();
  });

  test('a name is required', async ({ page }) => {
    await setUpLearner(page);
    await openProfiles(page);
    await page.getByRole('button', { name: 'Edit Mia' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('   ');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

test.describe('profiles: delete', () => {
  test('needs the learner\'s name typed, then removes only that learner and their sessions', async ({
    page,
    audio,
    loadList,
  }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼', lists: ['fixture-three'] });
    const three = await screenFor({ page, audio, loadList }, 'fixture-three');
    const five = await screenFor({ page, audio, loadList }, 'fixture-five');
    await three.listCard().click();
    await three.markNext(true);
    await three.home.click();

    await addLearnerFromHome(page, { name: 'Leo', avatar: '🦊', lists: ['fixture-five'] });
    await switcher(page).getByRole('button', { name: 'Leo' }).click();
    await five.listCard().click();
    await five.markNext(true);
    await five.home.click();
    expect(await savedSessionProfileIds(page)).toHaveLength(2);

    await openProfiles(page);
    await page.getByRole('button', { name: 'Delete Leo' }).click();
    const confirm = page.getByRole('button', { name: 'Yes, delete Leo' });
    await expect(confirm).toBeDisabled();
    const typed = page.getByRole('textbox', { name: 'Type Leo to confirm' });
    await typed.fill('Le');
    await expect(confirm).toBeDisabled();
    await typed.fill('Leo');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByRole('button', { name: 'Edit Leo' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit Mia' })).toBeVisible();

    // Leo was the active learner: Mia is back, with her own place kept; Leo's sessions are gone.
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await expect(three.keepGoing).toContainText('Fixture Three');
    await expect(switcher(page)).toHaveCount(0);
    const remaining = await savedSessionProfileIds(page);
    expect(remaining).toHaveLength(1);
  });

  test('cancelling keeps the learner', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    await openProfiles(page);
    await addLearner(page, { name: 'Leo', avatar: '🦊' });
    await page.getByRole('button', { name: 'Delete Leo' }).click();
    await page.getByRole('textbox', { name: 'Type Leo to confirm' }).fill('Leo');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Edit Leo' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Type Leo to confirm' })).toHaveCount(0);
  });

  test('the only learner cannot be deleted', async ({ page }) => {
    await setUpLearner(page);
    await openProfiles(page);
    await expect(page.getByRole('button', { name: 'Edit Mia' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
  });
});
