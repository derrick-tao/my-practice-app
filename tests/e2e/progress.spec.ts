// Seam 1: the parent's Progress page (ticket 11). Public surface only: the gate, the parent area's screens
// and the audio requests the app makes. Scripted attempts are put on the device through backup import
// (backup-driver.ts); nothing here reads or writes storage directly.
import type { Page } from '@playwright/test';
import { restoreSessions, type SessionJson } from './backup-driver.ts';
import { expect, test } from './harness.ts';
import { addOtherLearner } from './saved-sessions.ts';
import { openParentArea, openParentSection, setUpLearner } from './parent-driver.ts';

type Mark = 'correct' | 'wrong';
type Marked = Array<[string, Mark]>;

const ok = (id: string): [string, Mark] => [id, 'correct'];
const bad = (id: string): [string, Mark] => [id, 'wrong'];

function round(index: number, itemIds: string[], marked: Marked, startedAt: string, over = marked.length === itemIds.length) {
  return {
    index,
    itemIds,
    position: marked.length,
    phase: 'listening',
    heardCurrent: false,
    marks: Object.fromEntries(marked),
    startedAt,
    ...(over ? { completedAt: startedAt } : {}),
  };
}

function attempt(
  id: string,
  listId: string,
  status: 'completed' | 'stopped' | 'active',
  startedAt: string,
  rounds: ReturnType<typeof round>[],
): SessionJson {
  return {
    id,
    profileId: 'replaced-on-restore',
    subject: 'chinese',
    practiceType: 'dictation',
    listId,
    contentVersion: 'saved-before',
    status,
    startedAt,
    ...(status === 'completed' ? { completedAt: startedAt } : {}),
    rounds,
    undo: null,
    marksSinceBreak: 0,
  };
}

// fixture-five is 猫 狗 鸟 年 只 (in that order in the list). Three attempts, oldest first:
//  Oct 1 completed in 3 rounds: first try 2 of 5 (猫 and 只 right).
//  Oct 3 stopped: round 1 done with 4 of 5 (a better score than either completed attempt), round 2 not started.
//  Oct 8 completed in 2 rounds: first try 3 of 5.
const FIVE = 'fixture-five';
const SCRIPTED: SessionJson[] = [
  attempt(FIVE + '-1', FIVE, 'completed', '2026-10-01T12:00:00.000Z', [
    round(1, ['猫', '狗', '鸟', '年', '只'], [ok('猫'), bad('狗'), bad('鸟'), bad('年'), ok('只')], '2026-10-01T12:00:00.000Z'),
    round(2, ['鸟', '狗', '年'], [ok('鸟'), bad('狗'), ok('年')], '2026-10-01T12:05:00.000Z'),
    round(3, ['狗'], [ok('狗')], '2026-10-01T12:08:00.000Z'),
  ]),
  attempt(FIVE + '-2', FIVE, 'stopped', '2026-10-03T12:00:00.000Z', [
    round(1, ['年', '只', '猫', '狗', '鸟'], [bad('年'), ok('只'), ok('猫'), ok('狗'), ok('鸟')], '2026-10-03T12:00:00.000Z'),
    round(2, ['年'], [], '2026-10-03T12:05:00.000Z'),
  ]),
  attempt(FIVE + '-3', FIVE, 'completed', '2026-10-08T12:00:00.000Z', [
    round(1, ['狗', '猫', '年', '鸟', '只'], [bad('狗'), ok('猫'), bad('年'), ok('鸟'), ok('只')], '2026-10-08T12:00:00.000Z'),
    round(2, ['狗', '年'], [ok('狗'), ok('年')], '2026-10-08T12:05:00.000Z'),
  ]),
];

/** Home -> gear -> gate -> Progress -> the list's page. */
async function openProgress(page: Page, listTitle: RegExp): Promise<void> {
  await openParentArea(page);
  await openParentSection(page, 'Progress');
  await expect(page.getByRole('heading', { name: 'Progress', exact: true, level: 1 })).toBeVisible();
  await page.getByRole('link', { name: listTitle }).click();
}

async function scriptedFive(page: Page): Promise<void> {
  await setUpLearner(page);
  await restoreSessions(page, SCRIPTED);
  await openProgress(page, /Fixture Five/);
}

test.describe('parent progress page', () => {
  test('lists every attempt newest first with its status, first-try score and rounds to complete', async ({ page }) => {
    await scriptedFive(page);

    const attempts = page.getByTestId('attempt');
    await expect(attempts).toHaveCount(3);
    await expect(attempts.nth(0)).toContainText('Oct 8, 2026');
    await expect(attempts.nth(0)).toContainText('Completed');
    await expect(attempts.nth(0)).toContainText('First try: 3 of 5');
    await expect(attempts.nth(0)).toContainText('Rounds: 2');
    await expect(attempts.nth(1)).toContainText('Oct 3, 2026');
    await expect(attempts.nth(1)).toContainText('Stopped');
    await expect(attempts.nth(2)).toContainText('Oct 1, 2026');
    await expect(attempts.nth(2)).toContainText('Completed');
    await expect(attempts.nth(2)).toContainText('First try: 2 of 5');
    await expect(attempts.nth(2)).toContainText('Rounds: 3');
  });

  test('the header has the title, test dates, character count, number of attempts and best first try', async ({
    page,
  }) => {
    await setUpLearner(page);
    await restoreSessions(page, [
      attempt('t-1', 'fixture-three', 'completed', '2026-10-01T12:00:00.000Z', [
        round(1, ['找', '点', '分'], [ok('找'), bad('点'), ok('分')], '2026-10-01T12:00:00.000Z'),
        round(2, ['点'], [ok('点')], '2026-10-01T12:05:00.000Z'),
      ]),
    ]);
    await openProgress(page, /Fixture Three/);

    const header = page.getByTestId('progress-header');
    await expect(header.getByRole('heading', { name: 'Fixture Three' })).toBeVisible();
    await expect(header).toContainText('Test: 2026-11-02 to 2026-11-06');
    await expect(header).toContainText('3 characters');
    await expect(header).toContainText('Attempts: 1');
    await expect(header).toContainText('Best first try: 2 of 3');
  });

  test('the trend and the best score leave out the stopped attempt', async ({ page }) => {
    await scriptedFive(page);

    // The stopped attempt scored 4 of 5 on round 1; neither number may show it.
    await expect(page.getByTestId('trend')).toHaveText(/^\s*2\s*→\s*3\s*$/);
    await expect(page.getByTestId('progress-header')).toContainText('Best first try: 3 of 5');
    await expect(page.getByTestId('progress-header')).toContainText('Attempts: 3');
  });

  test('an attempt opens to each round\'s counts and missed characters; tapping one requests its audio', async ({
    page,
    audio,
    loadList,
  }) => {
    await scriptedFive(page);
    const list = await loadList(FIVE);

    await page.getByTestId('attempt').nth(2).click();

    const rounds = page.getByTestId('round');
    await expect(rounds).toHaveCount(3);
    await expect(rounds.nth(0)).toContainText('Round 1');
    await expect(rounds.nth(0)).toContainText('5 characters');
    await expect(rounds.nth(0)).toContainText('✅ 2');
    await expect(rounds.nth(0)).toContainText('❌ 3');
    await expect(rounds.nth(0).getByRole('button')).toHaveText(['狗', '鸟', '年']);
    await expect(rounds.nth(1)).toContainText('3 characters');
    await expect(rounds.nth(1)).toContainText('✅ 2');
    await expect(rounds.nth(1)).toContainText('❌ 1');
    await expect(rounds.nth(1).getByRole('button')).toHaveText(['狗']);
    await expect(rounds.nth(2)).toContainText('1 character');
    await expect(rounds.nth(2)).toContainText('✅ 1');
    await expect(rounds.nth(2)).toContainText('❌ 0');
    await expect(rounds.nth(2).getByRole('button')).toHaveCount(0);

    expect(await audio.played(list)).toEqual([]);
    await rounds.nth(0).getByRole('button', { name: 'Hear 鸟' }).click();
    await rounds.nth(1).getByRole('button', { name: 'Hear 狗' }).click();
    const played = await audio.played(list);
    expect(played.map(({ target, rendition }) => [target, rendition])).toEqual([
      ['鸟', 'normal'],
      ['狗', 'normal'],
    ]);
  });

  test('trickiest characters ranks by total wrong marks across all attempts, and tapping one requests its audio', async ({
    page,
    audio,
    loadList,
  }) => {
    await scriptedFive(page);
    const list = await loadList(FIVE);

    // 狗 3 (Oct 1 rounds 1 and 2, Oct 8 round 1); 年 3 (Oct 1, Oct 3 stopped, Oct 8); 鸟 1.
    // 猫 and 只 were never missed. Equal counts keep the list's order (狗 before 年).
    const rows = page.getByTestId('tricky');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('狗');
    await expect(rows.nth(0)).toContainText('❌ 3');
    await expect(rows.nth(1)).toContainText('年');
    await expect(rows.nth(1)).toContainText('❌ 3');
    await expect(rows.nth(2)).toContainText('鸟');
    await expect(rows.nth(2)).toContainText('❌ 1');

    await rows.nth(2).getByRole('button', { name: 'Hear 鸟' }).click();
    expect((await audio.played(list)).map(({ target, rendition }) => [target, rendition])).toEqual([['鸟', 'normal']]);
  });

  test('an in-progress attempt shows as in progress, with its rounds so far', async ({ page }) => {
    await setUpLearner(page);
    await restoreSessions(page, [
      attempt('ip-1', 'fixture-three', 'active', '2026-10-12T12:00:00.000Z', [
        round(1, ['点', '找', '分'], [bad('点'), ok('找'), bad('分')], '2026-10-12T12:00:00.000Z'),
        round(2, ['分', '点'], [ok('分')], '2026-10-12T12:05:00.000Z'),
      ]),
    ]);
    await openProgress(page, /Fixture Three/);

    const row = page.getByTestId('attempt');
    await expect(row).toContainText('In progress');
    await expect(row).toContainText('First try: 1 of 3');
    await expect(row).toContainText('Rounds so far: 2');
    await expect(page.getByTestId('progress-header')).toContainText('Best first try: none yet');
    await expect(page.getByTestId('trend')).toContainText('No completed attempts yet');

    await row.click();
    const rounds = page.getByTestId('round');
    await expect(rounds).toHaveCount(2);
    await expect(rounds.nth(1)).toContainText('Round 2');
    await expect(rounds.nth(1)).toContainText('2 characters');
    await expect(rounds.nth(1)).toContainText('✅ 1');
    await expect(rounds.nth(1)).toContainText('❌ 0');
    await expect(rounds.nth(1)).toContainText('so far');
  });

  test('trickiest characters stops at ten and breaks ties in list order, whatever order they were presented in', async ({
    page,
    loadList,
  }) => {
    await setUpLearner(page);
    const targets = (await loadList('fixture-twelve')).items.map((item) => item.target);
    expect(targets).toHaveLength(12);
    const presented = [...targets].reverse();
    await restoreSessions(page, [
      attempt('ten-1', 'fixture-twelve', 'completed', '2026-10-01T12:00:00.000Z', [
        round(1, presented, presented.map(bad), '2026-10-01T12:00:00.000Z'),
      ]),
    ]);
    await openProgress(page, /Fixture Twelve/);

    // All twelve were missed once: the first ten in list order are shown.
    const rows = page.getByTestId('tricky');
    await expect(rows).toHaveCount(10);
    for (const [i, target] of targets.slice(0, 10).entries()) {
      await expect(rows.nth(i).getByRole('button', { name: `Hear ${target}` })).toBeVisible();
    }
  });

  test('stopped and in-progress attempts are listed but leave out the trend and the best first try', async ({ page }) => {
    await setUpLearner(page);
    await restoreSessions(page, [
      // Completed: first try 1 of 3 (the only attempt that counts).
      attempt('c-1', 'fixture-three', 'completed', '2026-10-01T12:00:00.000Z', [
        round(1, ['找', '点', '分'], [ok('找'), bad('点'), bad('分')], '2026-10-01T12:00:00.000Z'),
        round(2, ['点', '分'], [ok('点'), ok('分')], '2026-10-01T12:05:00.000Z'),
      ]),
      // Stopped: a perfect round 1, with round 2 not started.
      attempt('s-1', 'fixture-three', 'stopped', '2026-10-03T12:00:00.000Z', [
        round(1, ['找', '点', '分'], [ok('找'), ok('点'), ok('分')], '2026-10-03T12:00:00.000Z'),
      ]),
      // In progress: round 1 not over yet (no first-try score), with one miss so far.
      attempt('a-1', 'fixture-three', 'active', '2026-10-05T12:00:00.000Z', [
        round(1, ['分', '找', '点'], [bad('分')], '2026-10-05T12:00:00.000Z'),
      ]),
    ]);
    await openProgress(page, /Fixture Three/);

    const header = page.getByTestId('progress-header');
    await expect(header).toContainText('Attempts: 3');
    await expect(header).toContainText('Best first try: 1 of 3');
    await expect(page.getByTestId('trend')).toHaveText(/^\s*1\s*$/);

    const attempts = page.getByTestId('attempt');
    await expect(attempts.nth(0)).toContainText('In progress');
    await expect(attempts.nth(0)).toContainText('First try: —');
    await expect(attempts.nth(1)).toContainText('Stopped');
    await expect(attempts.nth(1)).toContainText('First try: 3 of 3');

    // Misses still count toward the trickiest, whatever the attempt's status: 分 twice (completed, in progress), 点 once.
    const rows = page.getByTestId('tricky');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('分');
    await expect(rows.nth(0)).toContainText('❌ 2');
    await expect(rows.nth(1)).toContainText('点');
    await expect(rows.nth(1)).toContainText('❌ 1');
  });

  test('a character the list no longer has is labeled (removed) and has no audio to play', async ({ page }) => {
    await setUpLearner(page);
    await restoreSessions(page, [
      attempt('rm-1', 'fixture-three', 'completed', '2026-10-01T12:00:00.000Z', [
        round(1, ['找', '旧', '分'], [ok('找'), bad('旧'), bad('分')], '2026-10-01T12:00:00.000Z'),
        round(2, ['旧', '分'], [ok('旧'), ok('分')], '2026-10-01T12:05:00.000Z'),
      ]),
    ]);
    await openProgress(page, /Fixture Three/);

    // 旧 and 分 were each missed once; the removed one comes last although it was presented first.
    const tricky = page.getByTestId('tricky');
    await expect(tricky).toHaveCount(2);
    await expect(tricky.nth(0)).toContainText('分');
    await expect(tricky.nth(1)).toContainText('旧');
    await expect(page.getByTestId('tricky').filter({ hasText: '旧' })).toContainText('(removed)');
    await expect(page.getByTestId('tricky').filter({ hasText: '分' })).not.toContainText('(removed)');

    await page.getByTestId('attempt').click();
    const missed = page.getByTestId('round').nth(0);
    await expect(missed).toContainText('旧 (removed)');
    await expect(missed.getByRole('button', { name: 'Hear 旧' })).toHaveCount(0);
    await expect(missed.getByRole('button', { name: 'Hear 分' })).toBeVisible();
    await expect(missed).not.toContainText('分 (removed)');
  });

  test('a list with no attempts says so, and another learner\'s attempts are not shown', async ({ page }) => {
    await setUpLearner(page);
    await addOtherLearner(page); // Leo has a completed fixture-three attempt; Mia stays the active learner.
    await openProgress(page, /Fixture Three/);

    await expect(page.getByTestId('progress-header')).toContainText('Attempts: 0');
    await expect(page.getByTestId('attempt')).toHaveCount(0);
    await expect(page.getByText('No attempts yet')).toBeVisible();
    await expect(page.getByText(/Progress for.*Mia/)).toBeVisible();
  });

  test('an unknown list or attempt says it could not be found', async ({ page }) => {
    await scriptedFive(page);
    await page.goto('./#/parent/progress/no-such-list');
    await expect(page.getByText("We couldn't find this list.")).toBeVisible();
    await page.goto('./#/parent/progress/fixture-five/no-such-attempt');
    await expect(page.getByText("We couldn't find this attempt.")).toBeVisible();
  });
});
