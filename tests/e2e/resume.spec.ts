// Seam 1: never lose progress (ticket 05). A reload (or closing and reopening the browser) stands in for
// an app restart; the child gets back to exactly where they were through the Keep going card.
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { allowAudioPlayback, PracticeScreen, rejectAudioPlayback, seedRandom } from './practice-driver.ts';
import { setUpLearner } from './parent-driver.ts';
import { exportBackup, openBackupSection, restoreSessions, type SessionJson } from './backup-driver.ts';
import { savedDataFixture, seedSavedData, stubPersistentStorage } from './saved-data.ts';

/** The saved-data fixture's sessions (written by the first schema, before profiles existed). */
const savedFixture = (): { sessions: SessionJson[] } => savedDataFixture('schema-v2') as { sessions: SessionJson[] };

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

async function start(
  { page, audio, loadLesson }: Fixtures,
  lessonId: string,
): Promise<{ practice: PracticeScreen; lesson: LessonData }> {
  await setUpLearner(page);
  const lesson = await loadLesson(lessonId);
  const practice = new PracticeScreen(page, audio, lesson);
  await practice.open();
  return { practice, lesson };
}

/** What the app has recorded as its app record (version stamp, profiles), read straight from the device. */
const savedAppRecord = (page: Page): Promise<{ schemaVersion?: number } | undefined> =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('my-practice-app', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('meta', 'readonly').objectStore('meta').get('app');
          get.onsuccess = () => (db.close(), resolve(get.result));
          get.onerror = () => reject(get.error);
        };
      }),
  );

/** Simulates a device that saved sessions before the app stamped a schema version on the device. */
const forgetAppRecord = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('my-practice-app', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('meta', 'readwrite');
          tx.objectStore('meta').delete('app');
          tx.oncomplete = () => (db.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
      }),
  );

const failWrites = (page: Page, fail: boolean): Promise<void> =>
  page.evaluate((value) => void (window.__failStorageWrites = value), fail);

test.describe('resume: Keep going', () => {
  test('after reloading while listening, Keep going restores the same item with Check still available and no auto-play', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-five');
    await practice.reveal();
    await practice.gotIt.click(); // item 2 of 5, listening
    await expect(practice.check).toBeVisible();
    const heard = await practice.lastHeardTarget();
    await expect(practice.progressText()).toHaveText('1 / 5');

    await practice.reopenViaKeepGoing();

    await expect(practice.progressText()).toHaveText('1 / 5');
    await expect(practice.check).toBeVisible(); // the audio had already been heard
    await expect(practice.target).toHaveCount(0);
    // Audio does not auto-play on resume (iOS gesture rules); Listen plays the same item.
    expect(await audio.played(lesson)).toEqual([]);
    await practice.listen.click();
    expect(await practice.lastHeardTarget()).toBe(heard);
    expect(await practice.reveal()).toBe(heard);
  });

  test('a listening screen whose audio was never heard comes back without Check', async ({ page, audio, loadLesson }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await rejectAudioPlayback(page);
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-three');
    await expect(practice.listen).toHaveClass(/pulse/); // the blocked auto-play has happened
    await expect(practice.check).toHaveCount(0);

    await practice.reopenViaKeepGoing();

    await expect(practice.listen).toBeVisible();
    await expect(practice.progressText()).toHaveText('0 / 3');
    await expect(practice.check).toHaveCount(0);
    await allowAudioPlayback(page);
    await practice.listen.click();
    await expect(practice.check).toBeVisible();
  });

  test('after reloading on the revealed screen, Keep going restores the revealed item and its answer buttons', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-three');
    const revealed = await practice.reveal();
    const item = lesson.lists.dictation!.find((x) => x.target === revealed)!;

    await practice.reopenViaKeepGoing();

    await expect(practice.target).toHaveText(revealed);
    await expect(page.getByText(item.pinyin, { exact: true })).toBeVisible();
    await expect(practice.gotIt).toBeVisible();
    await expect(practice.notYet).toBeVisible();
    await expect(practice.check).toHaveCount(0);
    await expect(practice.progressText()).toHaveText('0 / 3');
    expect(await audio.played(lesson)).toEqual([]);
    await practice.listen.click(); // audio is still playable once revealed
    expect(await practice.lastHeardTarget()).toBe(revealed);
  });

  test('after reloading on a round summary, Keep going restores the summary and the retry round still works', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-five');
    const missed = new Set(['狗', '年']);
    await practice.playRound((target) => !missed.has(target));
    await expect(practice.summary).toBeVisible();

    await practice.reopenViaKeepGoing();

    await expect(practice.summary).toBeVisible();
    await expect(page.getByTestId('correct-count')).toHaveText('3');
    await expect(page.getByTestId('wrong-count')).toHaveText('2');
    await expect(practice.progressText()).toHaveText('5 / 5');
    const order = await practice.playRetryRound(() => true);
    expect([...order].sort()).toEqual([...missed].sort());
    await expect(practice.completion).toBeVisible();
  });

  test('after reloading in the middle of a retry round, Keep going shows the round badge and only the remaining items', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-five');
    const round1 = await practice.playRound((_, index) => index >= 3); // the first 3 presented are wrong
    const missed = round1.slice(0, 3);
    await practice.retry.click();
    await expect(practice.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    const first = await practice.reveal();
    await practice.gotIt.click();
    await expect(practice.progressText()).toHaveText('1 / 3');
    await expect(practice.check).toBeVisible();

    await practice.reopenViaKeepGoing();

    await expect(practice.keepGoing).toHaveCount(0); // we are on the practice screen now
    await expect(practice.roundBadge).toHaveAttribute('aria-label', 'Round 2');
    await expect(practice.progressText()).toHaveText('1 / 3');
    const remaining = await practice.playRound(() => true);
    expect(remaining).toHaveLength(2);
    expect([first, ...remaining].sort()).toEqual([...missed].sort());
    await expect(practice.completion).toBeVisible();
    await expect(page.getByText('Rounds: 2')).toBeVisible();
    await expect(page.getByText('2 of 5 on the first try!')).toBeVisible();
  });

  test('the Keep going card names the lesson and shows the star progress and round badge', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-five');
    await practice.playRound((_, index) => index >= 2);
    await practice.retry.click();
    await practice.reveal();
    await practice.notYet.click();

    await page.goto('./');
    await page.reload();

    await expect(practice.keepGoing).toBeVisible();
    await expect(practice.keepGoing).toContainText('Fixture Five');
    await expect(practice.keepGoing.getByTestId('progress-text')).toHaveText('1 / 2');
    await expect(practice.keepGoing.getByTestId('round-badge')).toHaveAttribute('aria-label', 'Round 2');
    await expect(practice.lessonCard()).toBeVisible();
  });

  test.describe('a URL that does not match the lesson', () => {
    for (const hash of ['#/chinese/flashcards/fixture-three', '#/maths/dictation/fixture-three']) {
      test(`${hash} says it cannot find the lesson and leaves the saved practice alone`, async ({
        page,
        audio,
        loadLesson,
      }) => {
        const { practice } = await start({ page, audio, loadLesson }, 'fixture-five');
        await practice.reveal();
        await practice.gotIt.click();
        await expect(practice.progressText()).toHaveText('1 / 5');
        await expect(practice.check).toBeVisible(); // the next item's audio has played (it follows the ✅ sound)

        await page.goto(`./${hash}`);
        await expect(page.getByText("We couldn't find this lesson.")).toBeVisible();
        await expect(practice.listen).toHaveCount(0);

        await practice.home.click();
        await expect(practice.keepGoing).toContainText('Fixture Five');
        await expect(practice.keepGoing.getByTestId('progress-text')).toHaveText('1 / 5');
        await practice.keepGoing.click();
        await expect(practice.progressText()).toHaveText('1 / 5');
        await expect(practice.check).toBeVisible();
      });
    }
  });

  test('a completed session no longer shows Keep going', async ({ page, audio, loadLesson }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-three');
    await practice.playRound(() => true);
    await expect(practice.completion).toBeVisible();

    await page.goto('./');
    await page.reload();

    await expect(practice.lessonCard()).toBeVisible();
    await expect(practice.keepGoing).toHaveCount(0);
  });

  test('reloading while on a practice screen carries on from the saved step without auto-play', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await seedRandom(page, 3);
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-three');
    const first = await practice.reveal();
    await practice.gotIt.click();
    await expect(practice.progressText()).toHaveText('1 / 3');
    await expect(practice.check).toBeVisible();

    await page.reload();

    await expect(practice.progressText()).toHaveText('1 / 3');
    expect(await audio.played(lesson)).toEqual([]);
    const order = await practice.playRound(() => true);
    expect(order).toHaveLength(2);
    expect(order).not.toContain(first);
  });
});

test.describe('saving: persist before the screen moves on', () => {
  test('a failed save shows "Couldn\'t save — tap to retry" and does not advance; retrying saves and advances', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice, lesson } = await start({ page, audio, loadLesson }, 'fixture-five');
    const revealed = await practice.reveal();
    await audio.clear();
    const retry = page.getByRole('button', { name: "Couldn't save — tap to retry" });

    await failWrites(page, true);
    await practice.gotIt.click();

    await expect(retry).toBeVisible();
    await expect(practice.target).toHaveText(revealed); // still on the same item
    await expect(practice.gotIt).toBeVisible();
    await expect(practice.progressText()).toHaveText('0 / 5');

    // Nothing was lost or half-saved: the saved step is still the revealed item.
    await failWrites(page, false);
    await page.goto('./');
    await page.reload();
    await practice.keepGoing.click();
    await expect(practice.target).toHaveText(revealed);
    await expect(practice.progressText()).toHaveText('0 / 5');

    // Fail again, then retry after the storage recovers.
    await failWrites(page, true);
    await practice.gotIt.click();
    await expect(retry).toBeVisible();
    await retry.click(); // still failing: stays put
    await expect(retry).toBeVisible();
    await expect(practice.progressText()).toHaveText('0 / 5');
    await failWrites(page, false);
    await retry.click();

    await expect(retry).toHaveCount(0);
    await expect(practice.progressText()).toHaveText('1 / 5');
    await expect(practice.check).toBeVisible();
    await expect(practice.target).toHaveCount(0);

    // And it really was saved.
    await practice.reopenViaKeepGoing();
    await expect(practice.progressText()).toHaveText('1 / 5');
    expect(lesson.lists.dictation!.length).toBe(5);
  });

  test('a failed save of a mark does not lose the audio that started meanwhile: after retry the next item can be checked', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-three');
    await practice.reveal();
    await failWrites(page, true);
    await practice.notYet.click();
    const retry = page.getByRole('button', { name: "Couldn't save — tap to retry" });
    await expect(retry).toBeVisible();
    await failWrites(page, false);
    await retry.click();

    await expect(practice.progressText()).toHaveText('1 / 3');
    await expect(practice.check).toBeVisible(); // the next item's auto-play was counted as heard
  });

  test('if starting a new practice cannot be saved, the child is asked to retry instead of seeing practice', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    const lesson = await loadLesson('fixture-three');
    const practice = new PracticeScreen(page, audio, lesson);
    await expect(practice.lessonCard()).toBeVisible();
    await failWrites(page, true);
    await practice.lessonCard().click();

    const retry = page.getByRole('button', { name: "Couldn't save — tap to retry" });
    await expect(retry).toBeVisible();
    await expect(practice.listen).toHaveCount(0);

    await failWrites(page, false);
    await retry.click();
    await expect(practice.listen).toBeVisible();
    await expect(practice.check).toBeVisible();
    await expect(practice.progressText()).toHaveText('0 / 3');
  });
});

test.describe('saved data', () => {
  test('a saved-data fixture at the current schema version restores through backup: Keep going resumes the saved retry round', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    await restoreSessions(page, savedFixture().sessions);
    const lesson = await loadLesson('fixture-three');
    const practice = new PracticeScreen(page, audio, lesson);

    // The completed session in the fixture does not count; the active one on Fixture Three does.
    await expect(practice.keepGoing).toBeVisible();
    await expect(practice.keepGoing).toContainText('Fixture Three');
    await expect(practice.keepGoing.getByTestId('round-badge')).toHaveAttribute('aria-label', 'Round 2');
    await expect(practice.keepGoing.getByTestId('progress-text')).toHaveText('1 / 2');
    await practice.keepGoing.click();

    await expect(practice.check).toBeVisible(); // saved as already heard
    expect(await audio.played(lesson)).toEqual([]);
    expect(await practice.reveal()).toBe('分');
    await practice.gotIt.click();
    await expect(practice.completion).toBeVisible();
    await expect(page.getByText('Rounds: 2')).toBeVisible();
    await expect(page.getByText('1 of 3 on the first try!')).toBeVisible();
  });

  test('a brand-new device stamps its schema version as soon as it saves practice, and reloading carries on', async ({
    page,
    audio,
    loadLesson,
  }) => {
    const { practice } = await start({ page, audio, loadLesson }, 'fixture-three');
    await practice.reveal();
    await practice.gotIt.click();
    await expect(practice.progressText()).toHaveText('1 / 3');

    // A backup taken now says which schema the saved data is.
    await page.goto('./');
    await openBackupSection(page);
    const { backup } = await exportBackup(page);
    expect(backup.schemaVersion).toBe(2);
    expect(backup.data.app.schemaVersion).toBe(2);
    await practice.reopenViaKeepGoing();
    await expect(practice.progressText()).toHaveText('1 / 3');
  });

  test('sessions saved by a device that never stamped a version still resume, and get stamped', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await page.goto('./');
    await seedSavedData(page, savedDataFixture('schema-v1') as Parameters<typeof seedSavedData>[1]);
    await forgetAppRecord(page);
    expect(await savedAppRecord(page)).toBeUndefined();
    await setUpLearner(page);
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));

    await expect(practice.keepGoing).toContainText('Fixture Three');
    await practice.keepGoing.click();
    await expect(practice.progressText()).toHaveText('1 / 2');
    expect(await savedAppRecord(page)).toEqual(expect.objectContaining({ schemaVersion: 2 }));
  });

  /** The fixture's active Fixture Three session with its first round replaced (ids may be ones the lesson no longer has). */
  function savedRound1(round: object): SessionJson[] {
    const active = savedFixture().sessions.find((x) => x.lessonId === 'fixture-three' && x.status === 'active')!;
    return [{ ...active, rounds: [round] }];
  }
  const round1 = { index: 1, phase: 'prompt', heardCurrent: true, startedAt: '2026-10-01T09:00:00.000Z' };

  test('a saved item the lesson no longer has drops out of the round, so the child is never stuck on it', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    await restoreSessions(
      page,
      savedRound1({ ...round1, itemIds: ['点', '没有了', '分', '找'], position: 1, marks: { 点: 'correct' } }),
    );
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));

    await practice.keepGoing.click();

    await expect(practice.progressText()).toHaveText('1 / 3');
    await practice.listen.click(); // resuming never auto-plays
    expect(await practice.playRound(() => true)).toEqual(['分', '找']);
    await expect(practice.completion).toBeVisible();
  });

  test('when the item the child was on is gone and it was the last, the round summary shows', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    await restoreSessions(
      page,
      savedRound1({ ...round1, itemIds: ['点', '分', '没有了'], position: 2, marks: { 点: 'correct', 分: 'wrong' } }),
    );
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));

    await practice.keepGoing.click();

    await expect(practice.summary).toBeVisible();
    await expect(page.getByTestId('correct-count')).toHaveText('1');
    await expect(page.getByTestId('wrong-count')).toHaveText('1');
    expect(await practice.playRetryRound(() => true)).toEqual(['分']);
    await expect(practice.completion).toBeVisible();
  });

  test('saved progress from a newer version of the app is not touched, and home says so', async ({ page }) => {
    await page.goto('./');
    const fixture = savedDataFixture('schema-v1') as Parameters<typeof seedSavedData>[1];
    await seedSavedData(page, { ...fixture, app: { ...(fixture.app as object), schemaVersion: 99 } });
    await page.reload();

    await expect(page.getByRole('alert')).toContainText('newer version');
    await expect(page.getByRole('link', { name: /Keep going/ })).toHaveCount(0);
    // Not mistaken for a new device: no set-up that would overwrite what is saved.
    await expect(page.getByRole('button', { name: /grown-up/i })).toHaveCount(0);
    expect(await savedAppRecord(page)).toEqual(expect.objectContaining({ schemaVersion: 99 }));
  });
});

test.describe('persistent storage', () => {
  test('is requested on the first run only, and the answer is kept', async ({ page }) => {
    await stubPersistentStorage(page, true);
    await page.goto('./');
    await expect.poll(() => page.evaluate(() => window.__persistRequests)).toBe(1);

    await setUpLearner(page);
    await page.reload();
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__persistRequests)).toBe(0);
    // The kept answer is what the Backup section shows.
    await openBackupSection(page);
    await expect(page.getByTestId('persistence')).toContainText('Persistent storage: on');
  });

  test('a refusal is kept too, and not asked again', async ({ page }) => {
    await stubPersistentStorage(page, false);
    await page.goto('./');
    await expect.poll(() => page.evaluate(() => window.__persistRequests)).toBe(1);

    await setUpLearner(page);
    await page.reload();
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__persistRequests)).toBe(0);
    await openBackupSection(page);
    await expect(page.getByTestId('persistence')).toContainText('Persistent storage: off');
  });
});
