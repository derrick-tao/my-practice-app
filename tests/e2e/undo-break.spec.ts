// Seam 1: Undo the last mark, and break prompts (ticket 06).
import type { Locator, Page } from '@playwright/test';
import type { ListData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { PracticeScreen } from './practice-driver.ts';
import { setUpLearner } from './parent-driver.ts';
import { seedSavedData } from './saved-data.ts';

const PROFILE_ID = '5b0f1f3e-9d0a-4c52-8f5e-2a6d1b7c9e41';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadList: (id: string) => Promise<ListData>;
}

/**
 * The one place these specs get from a fresh browser to a list's first practice screen: the real first run
 * (`setUpLearner`). Only a spec that needs a non-default break cadence seeds a profile instead, because
 * the settings screen that sets it arrives with ticket 08.
 */
async function start(
  { page, audio, loadList }: Fixtures,
  listId: string,
  breakEvery?: 0 | 5 | 10 | 15,
): Promise<{ practice: PracticeScreen; list: ListData }> {
  if (breakEvery === undefined) {
    await setUpLearner(page);
  } else {
    await page.goto('./');
    await seedProfileWithBreakEvery(page, breakEvery, listId);
    await page.goto('./'); // a fresh load of the seeded device: no first run, home shows the assigned list
  }
  const list = await loadList(listId);
  const practice = new PracticeScreen(page, audio, list);
  await practice.open();
  return { practice, list };
}

/**
 * What a device looks like after first run plus a settings change (the settings screen arrives with ticket 08):
 * one profile (a UUID id, as first run creates) with `breakEvery` in its settings and `listId` assigned.
 * Replace with real screens once 08 lands.
 */
async function seedProfileWithBreakEvery(page: Page, breakEvery: 0 | 5 | 10 | 15, listId: string): Promise<void> {
  await seedSavedData(page, {
    app: {
      schemaVersion: 1,
      profiles: [
        {
          id: PROFILE_ID,
          name: 'Mia',
          avatar: '🐼',
          createdAt: '2026-10-01T09:00:00.000Z',
          settings: { shuffle: true, breakEvery, sounds: true },
          assignedListIds: [listId],
        },
      ],
      activeProfileId: PROFILE_ID,
      parent: {},
    },
    sessions: [],
  });
}

test.describe('undo', () => {
  test('after a mark, Undo shows the same item revealed again with no mark; marking it wrong then counts it wrong', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    const first = await practice.markNext(true);
    await expect(practice.progressText()).toHaveText('1 / 3');
    await expect(practice.undo).toBeVisible();

    await practice.undo.click();

    await expect(practice.target).toHaveText(first);
    await expect(practice.gotIt).toBeVisible();
    await expect(practice.notYet).toBeVisible();
    await expect(practice.progressText()).toHaveText('0 / 3');
    await expect(practice.undo).toHaveCount(0);

    await practice.notYet.click();
    await practice.playRound(() => true);
    await expect(page.getByTestId('correct-count')).toHaveText('2');
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
    expect(await practice.playRetryRound(() => true)).toEqual([first]);
  });

  test('from a round summary the last mark created, Undo returns to that item and the summary is recomputed', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    const order = await practice.playRound((_, i) => i !== 0 && i !== 2); // first and last wrong
    await expect(page.getByTestId('wrong-count')).toHaveText('2');
    await expect(practice.undo).toBeVisible();

    await practice.undo.click();

    await expect(practice.summary).toBeHidden();
    await expect(practice.target).toHaveText(order[2]!);
    await expect(practice.progressText()).toHaveText('2 / 3');
    await practice.gotIt.click();
    await expect(page.getByTestId('correct-count')).toHaveText('2');
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
    await expect(practice.summary).toContainText("Let's practice 1 more!");
    expect(await practice.playRetryRound(() => true)).toEqual([order[0]]);
  });

  test('Undo is one level: the next mark replaces it, and after undoing it is gone', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-five');
    const [, second] = await practice.markMany(2);

    await practice.undo.click(); // undoes the second mark only
    await expect(practice.target).toHaveText(second!);
    await expect(practice.progressText()).toHaveText('1 / 5');
    await expect(practice.undo).toHaveCount(0);
    await practice.gotIt.click();
    await expect(practice.progressText()).toHaveText('2 / 5');
    await expect(practice.undo).toBeVisible(); // the re-mark is the new last mark
  });

  test('Undo is gone after starting a retry round', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    await practice.playRound((_, i) => i !== 0);
    await expect(practice.undo).toBeVisible();

    await practice.retry.click();

    await expect(practice.progressText()).toHaveText('0 / 1');
    await expect(practice.undo).toHaveCount(0);
  });

  test('Undo is not offered on the completion screen, even for the mark that completed the session', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    await practice.playRound(() => true);

    await expect(practice.completion).toBeVisible();
    await expect(practice.undo).toHaveCount(0);
  });

  test('Undo survives a reload on the screen right after a mark', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    const first = await practice.markNext(false);
    await expect(practice.undo).toBeVisible();

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('1 / 3');
    await expect(practice.undo).toBeVisible();
    await practice.undo.click();
    await expect(practice.target).toHaveText(first);
    await expect(practice.progressText()).toHaveText('0 / 3');
  });

  test('Undo survives a reload on a round summary and still returns to the last item', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    const order = await practice.playRound((_, i) => i !== 1);
    await expect(practice.summary).toBeVisible();

    await practice.reopenViaKeepGoing();

    await expect(practice.summary).toBeVisible();
    await practice.undo.click();
    await expect(practice.target).toHaveText(order[2]!);
    await expect(practice.progressText()).toHaveText('2 / 3');
  });
});

test.describe('break prompt', () => {
  test('appears after the 10th mark, never at the round end; Keep going continues at the next item', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-twelve');
    await practice.markMany(9);
    await expect(practice.breakPrompt).toHaveCount(0);
    await practice.markNext(true); // the 10th

    await expect(practice.breakPrompt).toBeVisible();
    await expect(practice.breakPrompt).toContainText('Great job! Take a break?');
    await expect(practice.keepOn).toBeVisible();
    await expect(practice.takeBreak).toBeVisible();
    await expect(practice.check).toHaveCount(0);

    await practice.keepOn.click();
    await expect(practice.breakPrompt).toHaveCount(0);
    await expect(practice.progressText()).toHaveText('10 / 12');
    await expect(practice.check).toBeVisible();

    await practice.markMany(2); // 11th and 12th: the round ends, with no prompt
    await expect(practice.summary).toHaveCount(0); // all correct: the session completes instead
    await expect(practice.completion).toBeVisible();
    await expect(practice.breakPrompt).toHaveCount(0);
  });

  test('Break saves and returns home; Keep going on the home screen resumes at the right item', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-twelve');
    await practice.markMany(10);
    await expect(practice.breakPrompt).toBeVisible();

    await practice.takeBreak.click();

    await expect(page).toHaveURL(/#\/$/);
    await expect(practice.keepGoing).toBeVisible();
    await practice.keepGoing.click();
    await expect(practice.breakPrompt).toHaveCount(0);
    await expect(practice.progressText()).toHaveText('10 / 12');
    await expect(practice.check).toBeVisible();
  });

  test('a reload on the break prompt restores it, and Keep going continues from there', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-twelve');
    await practice.markMany(10);
    await expect(practice.breakPrompt).toBeVisible();

    await practice.reopenViaKeepGoing();

    await expect(practice.breakPrompt).toBeVisible();
    await practice.keepOn.click();
    await expect(practice.progressText()).toHaveText('10 / 12');
    await expect(practice.check).toBeVisible();
  });

  test('breaks do not change round results or the first-try score', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-twelve');
    const order = await practice.markMany(10, (i) => i !== 3); // one wrong before the break
    await practice.keepOn.click();
    await practice.markMany(2);

    await expect(page.getByTestId('correct-count')).toHaveText('11');
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
    expect(await practice.playRetryRound(() => true)).toEqual([order[3]]);
    await expect(practice.completion).toContainText('11 of 12 on the first try!');
    await expect(practice.completion).toContainText('Rounds: 2');
  });

  test('a round that ends exactly on a break mark shows its summary, and the retry round starts without a prompt', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-five', 5);
    await practice.markMany(5, (i) => i !== 0);
    await expect(practice.summary).toBeVisible();
    await expect(practice.breakPrompt).toHaveCount(0);

    await practice.retry.click();
    await expect(practice.breakPrompt).toHaveCount(0);
    await expect(practice.check).toBeVisible();
  });

  test('the cadence comes from the profile setting: every 5 when set to 5', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-twelve', 5);
    await practice.markMany(4);
    await expect(practice.breakPrompt).toHaveCount(0);
    await practice.markNext(true);
    await expect(practice.breakPrompt).toBeVisible();
    await practice.keepOn.click();
    await practice.markMany(4);
    await expect(practice.breakPrompt).toHaveCount(0);
    await practice.markNext(true); // 10th overall, 5th since the last prompt
    await expect(practice.breakPrompt).toBeVisible();
  });

  test('the prompt and the Undo chip fit on screen with finger-sized controls', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-twelve');
    await practice.markMany(9);
    const inside = async (control: Locator, minHeight: number): Promise<void> => {
      const box = (await control.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(box.height).toBeGreaterThanOrEqual(minHeight);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    };
    await expect(practice.undo).toBeVisible();
    await inside(practice.undo, 64);
    await inside(practice.check, 96);

    await practice.markNext(true);
    await expect(practice.breakPrompt).toBeVisible();
    await inside(practice.keepOn, 96);
    await inside(practice.takeBreak, 64);
  });

  test('breaks can be turned off', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-twelve', 0);
    await practice.markMany(11);
    await expect(practice.breakPrompt).toHaveCount(0);
    await expect(practice.check).toBeVisible();
  });
});
