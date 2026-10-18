// Seam 1: per-learner Settings (ticket 08): shuffle, break cadence, sounds.
import type { Page } from '@playwright/test';
import type { ListData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { openSettings, passGate, setUpLearner } from './parent-driver.ts';
import { PracticeScreen, seedRandom } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadList: (id: string) => Promise<ListData>;
}

/** Set up a learner, change settings in the parent area, then open the list from home. */
async function startWith(
  { page, audio, loadList }: Fixtures,
  listId: string,
  change: (page: Page) => Promise<void>,
): Promise<{ practice: PracticeScreen; list: ListData }> {
  await setUpLearner(page);
  await openSettings(page);
  await change(page);
  await page.getByRole('link', { name: 'Home' }).click();
  const list = await loadList(listId);
  const practice = new PracticeScreen(page, audio, list);
  await practice.open();
  return { practice, list };
}

test.describe('settings: shuffle', () => {
  test('with shuffle off, round 1 follows list order and retry rounds are still reordered', async ({
    page,
    audio,
    loadList,
  }) => {
    await seedRandom(page, 7);
    const { practice, list } = await startWith({ page, audio, loadList }, 'fixture-five', async (p) => {
      await expect(p.getByRole('switch', { name: 'Shuffle the first round' })).toBeChecked();
      await p.getByRole('switch', { name: 'Shuffle the first round' }).click();
      await expect(p.getByRole('switch', { name: 'Shuffle the first round' })).not.toBeChecked();
    });
    const listOrder = list.items.map((x) => x.target);

    const first = await practice.playRound((_, i) => i < 2); // miss the last three
    expect(first).toEqual(listOrder);

    const missed = listOrder.slice(2);
    const retry = await practice.playRetryRound(() => true);
    expect([...retry].sort()).toEqual([...missed].sort());
    expect(retry).not.toEqual(missed);
  });
});

test.describe('settings: saved per learner', () => {
  test('start with the defaults and survive a reload: shuffle on, break every 10, sounds on', async ({ page }) => {
    await setUpLearner(page);
    await openSettings(page);
    const sounds = page.getByRole('switch', { name: 'Sound effects' });
    await expect(page.getByRole('switch', { name: 'Shuffle the first round' })).toBeChecked();
    await expect(sounds).toBeChecked();
    await expect(page.getByRole('radio', { name: '10', exact: true })).toBeChecked();

    await sounds.click();
    await expect(sounds).not.toBeChecked();
    await page.getByRole('radio', { name: '15', exact: true }).click();
    await expect(page.getByRole('radio', { name: '15', exact: true })).toBeChecked();

    await page.reload(); // the gate locks again on reload
    await passGate(page);
    await expect(page.getByRole('switch', { name: 'Sound effects' })).not.toBeChecked();
    await expect(page.getByRole('switch', { name: 'Shuffle the first round' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '15', exact: true })).toBeChecked();
  });

  test('sounds off mutes effects only: the character audio still plays', async ({ page, audio, loadList }) => {
    const { practice, list } = await startWith({ page, audio, loadList }, 'fixture-three', async (p) => {
      await p.getByRole('switch', { name: 'Sound effects' }).click();
      await expect(p.getByRole('switch', { name: 'Sound effects' })).not.toBeChecked();
    });
    await expect(practice.check).toBeVisible();
    const played = await audio.played(list);
    expect(played.length).toBeGreaterThan(0);
    expect(played.every((p) => p.target !== undefined)).toBe(true);
  });
});
