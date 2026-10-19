// Seam 1: the Backup section of the parent area (ticket 13): export, import, status.
import { readFile } from 'node:fs/promises';
import type { Manifest } from '../../src/content/types.ts';
import { expect, test } from './harness.ts';
import {
  BACKUP_FILE_NAME,
  backupFile,
  chooseBackupFile,
  confirmImport,
  exportBackup,
  openBackupSection,
  type BackupJson,
  type ProfileJson,
  type SavedData,
  type SessionJson,
} from './backup-driver.ts';
import { openParentArea, openParentSection, setUpLearner } from './parent-driver.ts';
import { PracticeScreen } from './practice-driver.ts';
import { stubPersistentStorage } from './saved-data.ts';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __shared?: Array<{ name: string; type: string; text: string }>;
  }
}

const NOW = new Date('2026-10-18T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

/** The date part of the file name is the export date, in the grown-up's own time zone. */
const localDate = (when: Date): string =>
  `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;

/** What is saved on the device, read through Export. Leaves out the last-backup time, which Export itself moves. */
async function savedNow(page: Page): Promise<SavedData> {
  await goToBackupSection(page);
  const { backup } = await exportBackup(page);
  return { ...backup.data, app: { ...backup.data.app, parent: {} } };
}

async function goToBackupSection(page: Page): Promise<void> {
  await page.goto('./');
  await openBackupSection(page);
}

function profile(id: string, name: string, avatar: string): ProfileJson {
  return {
    id,
    name,
    avatar,
    createdAt: '2026-09-01T09:00:00.000Z',
    settings: { shuffle: true, breakEvery: 10, sounds: true },
    assignedListIds: ['fixture-three', 'fixture-five'],
  };
}

function session(id: string, profileId: string, listId: string, status: string, startedAt: string): SessionJson {
  return {
    id,
    profileId,
    subject: 'chinese',
    practiceType: 'dictation',
    listId,
    contentVersion: 'v',
    status,
    startedAt,
    completedAt: status === 'active' ? undefined : startedAt,
    rounds: [
      {
        index: 1,
        itemIds: ['点', '分'],
        position: 2,
        phase: 'listening',
        heardCurrent: false,
        marks: { 点: 'correct', 分: 'wrong' },
        startedAt,
      },
    ],
    undo: null,
    marksSinceBreak: 0,
  };
}

/** `backup` as text, with the first session replaced by itself plus `change` (undefined removes a field). */
function withAttempt(backup: BackupJson, change: Record<string, unknown>): string {
  const [first, ...rest] = backup.data.sessions;
  return JSON.stringify({ ...backup, data: { ...backup.data, sessions: [{ ...first, ...change }, ...rest] } });
}

function withRound(backup: BackupJson, change: Record<string, unknown>): string {
  const [first] = backup.data.sessions;
  const rounds = first!.rounds as Array<Record<string, unknown>>;
  return withAttempt(backup, { rounds: [{ ...rounds[0], ...change }] });
}

function withLearner(backup: BackupJson, change: Record<string, unknown>): string {
  const [first, ...rest] = backup.data.app.profiles;
  return JSON.stringify({ ...backup, data: { ...backup.data, app: { ...backup.data.app, profiles: [{ ...first, ...change }, ...rest] } } });
}

/** Two learners, three attempts; the latest practice was on 2026-10-10. */
const TWO_LEARNERS: SavedData = {
  app: {
    schemaVersion: 1,
    profiles: [profile('p-leo', 'Leo', '🦊'), profile('p-zoe', 'Zoe', '🦁')],
    activeProfileId: 'p-zoe',
    parent: {},
  },
  sessions: [
    session('s-1', 'p-leo', 'fixture-three', 'completed', '2026-09-20T12:00:00.000Z'),
    session('s-2', 'p-leo', 'fixture-five', 'stopped', '2026-10-01T12:00:00.000Z'),
    session('s-3', 'p-zoe', 'fixture-three', 'completed', '2026-10-10T12:00:00.000Z'),
  ],
};

test.describe('export', () => {
  test('saves a JSON backup named with the export date, holding the app record and every session', async ({
    page,
    audio,
    loadList,
  }) => {
    await page.clock.install({ time: NOW });
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    const practice = new PracticeScreen(page, audio, await loadList('fixture-three'));
    await practice.open();
    await practice.reveal();
    await practice.gotIt.click();
    await expect(practice.progressText()).toHaveText('1 / 3');

    await goToBackupSection(page);
    const { fileName, backup } = await exportBackup(page);

    expect(fileName).toBe(`my-practice-app-backup-${localDate(NOW)}.json`);
    expect(fileName).toMatch(BACKUP_FILE_NAME);
    expect(backup).toEqual(
      expect.objectContaining({
        appId: 'my-practice-app',
        kind: 'backup',
        schemaVersion: 1,
        exportedAt: expect.stringMatching(/^2026-10-18T12:00:/),
      }),
    );
    expect(backup.data.app.profiles).toEqual([expect.objectContaining({ name: 'Mia', avatar: '🐼' })]);
    expect(backup.data.sessions).toEqual([
      expect.objectContaining({ listId: 'fixture-three', status: 'active', profileId: backup.data.app.profiles[0]!.id }),
    ]);
    // Nothing about this device's storage travels with the learner's data.
    expect(Object.keys(backup.data).sort()).toEqual(['app', 'sessions']);
  });

  test('goes through the share sheet when the browser can share a file', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await setUpLearner(page);
    await openBackupSection(page);
    await page.evaluate(() => {
      window.__shared = [];
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: ShareData) => {
          const file = data.files![0]!;
          window.__shared!.push({ name: file.name, type: file.type, text: await file.text() });
        },
      });
    });
    let downloads = 0;
    page.on('download', () => downloads++);

    await page.getByRole('button', { name: /Export a backup/ }).click();

    await expect(page.getByTestId('last-backup')).toContainText('Last backup: today');
    const [shared] = await page.evaluate(() => window.__shared!);
    expect(shared!.name).toBe(`my-practice-app-backup-${localDate(NOW)}.json`);
    expect(shared!.type).toBe('application/json');
    expect((JSON.parse(shared!.text) as BackupJson).data.app.profiles).toHaveLength(1);
    expect(downloads).toBe(0);
  });

  test('closing the share sheet without choosing is not a backup: Last backup does not move', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await setUpLearner(page);
    await openBackupSection(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('Share canceled', 'AbortError')),
      });
    });

    await page.getByRole('button', { name: /Export a backup/ }).click();

    await expect(page.getByRole('button', { name: /Export a backup/ })).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByTestId('last-backup')).toContainText('Last backup: never');
  });

  test('a share sheet that fails for another reason falls back to a download', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await setUpLearner(page);
    await openBackupSection(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError')),
      });
    });

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export a backup/ }).click();

    expect((await download).suggestedFilename()).toMatch(BACKUP_FILE_NAME);
    await expect(page.getByTestId('last-backup')).toContainText('Last backup: today');
  });
});

test.describe('status', () => {
  test('Last backup updates after export, and a week later the nudge badge appears', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await setUpLearner(page);
    await openBackupSection(page);
    // Never backed up: say so, and nudge.
    await expect(page.getByTestId('last-backup')).toContainText('Last backup: never');
    await expect(page.getByTestId('backup-nudge')).toBeVisible();

    await exportBackup(page);
    await expect(page.getByTestId('last-backup')).toContainText('Last backup: today');
    await expect(page.getByTestId('backup-nudge')).toHaveCount(0);

    // Re-open the section (a fresh render) as time passes.
    const revisit = async (daysLater: number): Promise<void> => {
      await page.clock.setSystemTime(new Date(NOW.getTime() + daysLater * DAY + 60 * 60 * 1000));
      await page.getByRole('link', { name: 'Back' }).click();
      await openParentSection(page, /Backup/);
    };
    await revisit(3);
    await expect(page.getByTestId('last-backup')).toContainText('Last backup: 3 days ago');
    await expect(page.getByTestId('backup-nudge')).toHaveCount(0);
    await revisit(6);
    await expect(page.getByTestId('backup-nudge')).toHaveCount(0);
    await revisit(8);
    await expect(page.getByTestId('last-backup')).toContainText('Last backup: 8 days ago');
    await expect(page.getByTestId('backup-nudge')).toBeVisible();
  });

  test('shows whether the browser granted persistent storage', async ({ page }) => {
    await stubPersistentStorage(page, true);
    await page.goto('./');
    await expect.poll(() => page.evaluate(() => window.__persistRequests)).toBe(1);
    await setUpLearner(page);
    await openBackupSection(page);
    await expect(page.getByTestId('persistence')).toContainText('Persistent storage: on');
  });

  test('says so when persistent storage was refused', async ({ page }) => {
    await stubPersistentStorage(page, false);
    await page.goto('./');
    await expect.poll(() => page.evaluate(() => window.__persistRequests)).toBe(1);
    await setUpLearner(page);
    await openBackupSection(page);
    await expect(page.getByTestId('persistence')).toContainText('Persistent storage: off');
  });

  test('shows the app version and the content version', async ({ page }) => {
    await setUpLearner(page);
    await openBackupSection(page);

    const { version } = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
    const manifest = (await (await page.request.get('content/manifest.json')).json()) as Manifest;
    await expect(page.getByTestId('app-version')).toHaveText(`App version: ${version}`);
    await expect(page.getByTestId('content-version')).toHaveText(`Content version: ${manifest.contentVersion}`);
  });
});

test.describe('import', () => {
  test('shows the right counts before confirming, and cancelling leaves local data unchanged', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    const before = await savedNow(page);

    await chooseBackupFile(page, backupFile(TWO_LEARNERS, '2026-10-12T08:00:00.000Z'));

    await expect(page.getByTestId('import-learners')).toHaveText('2');
    await expect(page.getByTestId('import-attempts')).toHaveText('3');
    await expect(page.getByTestId('import-last-used')).toHaveText('Oct 10, 2026');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('import-summary')).toHaveCount(0);

    expect(await savedNow(page)).toEqual(before);
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
  });

  test('after confirming it replaces everything, and Last backup comes from the file', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    await openBackupSection(page);

    await chooseBackupFile(page, backupFile(TWO_LEARNERS, '2026-10-05T12:00:00.000Z'));
    await confirmImport(page);

    await expect(page.getByTestId('last-backup')).toContainText('Last backup: 13 days ago');
    await expect(page.getByTestId('backup-nudge')).toBeVisible();
    expect(await savedNow(page)).toEqual({
      ...TWO_LEARNERS,
      app: { ...TWO_LEARNERS.app, parent: {} },
    });
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Hi 🦁 Zoe!' })).toBeVisible();
  });

  test('a file that is not a backup is rejected with a message, and nothing changes', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    const before = await savedNow(page);
    const good = backupFile(TWO_LEARNERS, '2026-10-12T08:00:00.000Z');

    const malformed: Array<[string, string]> = [
      ['not JSON at all', 'this is not json {'],
      ['JSON, but not a backup', '{"hello": "world"}'],
      ['another app', JSON.stringify({ ...good, appId: 'some-other-app' })],
      ['another kind of file', JSON.stringify({ ...good, kind: 'settings' })],
      ['no sessions', JSON.stringify({ ...good, data: { app: good.data.app } })],
      ['a learner without an id', JSON.stringify({ ...good, data: { ...good.data, app: { ...good.data.app, profiles: [{ name: 'x' }] } } })],
      ['a bad export time', JSON.stringify({ ...good, exportedAt: 'yesterday' })],
      ['a learner without settings', withLearner(good, { settings: undefined })],
      ['a learner whose break setting is not one of the choices', withLearner(good, { settings: { shuffle: true, breakEvery: 7, sounds: true } })],
      ['a learner without assigned lists', withLearner(good, { assignedListIds: undefined })],
      ['an attempt with no rounds', withAttempt(good, { rounds: [] })],
      ['an attempt with an unknown status', withAttempt(good, { status: 'paused' })],
      ['an attempt for an unknown practice type', withAttempt(good, { practiceType: 'karaoke' })],
      ['an attempt without a subject', withAttempt(good, { subject: undefined })],
      ['an attempt without a break count', withAttempt(good, { marksSinceBreak: undefined })],
      ['an attempt whose undo is not an undo entry', withAttempt(good, { undo: 'later' })],
      ['a round positioned past its items', withRound(good, { position: 3 })],
      ['a round with a bad phase', withRound(good, { phase: 'sleeping' })],
      ['a round with a mark that is neither right nor wrong', withRound(good, { marks: { 点: 'maybe' } })],
      ['a round whose items are not text', withRound(good, { itemIds: [1, 2] })],
    ];
    for (const [what, content] of malformed) {
      await chooseBackupFile(page, content);
      await expect(page.getByRole('alert'), what).toContainText("isn't a backup made by this app");
      await expect(page.getByTestId('import-summary'), what).toHaveCount(0);
    }

    expect(await savedNow(page)).toEqual(before);
  });

  test('a backup from a newer version of the app is rejected with a message, and nothing changes', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    const before = await savedNow(page);
    const newer = {
      ...backupFile(TWO_LEARNERS, '2026-10-12T08:00:00.000Z'),
      schemaVersion: 2,
      data: { ...TWO_LEARNERS, app: { ...TWO_LEARNERS.app, schemaVersion: 2, somethingNew: true } },
    };

    await chooseBackupFile(page, JSON.stringify(newer));

    await expect(page.getByRole('alert')).toContainText('newer version of this app');
    await expect(page.getByTestId('import-summary')).toHaveCount(0);
    expect(await savedNow(page)).toEqual(before);
  });

  test('a restore that cannot be saved says so, leaves local data unchanged, and can be retried', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    const before = await savedNow(page);
    await chooseBackupFile(page, backupFile(TWO_LEARNERS, '2026-10-12T08:00:00.000Z'));

    await page.evaluate(() => void (window.__failStorageWrites = true));
    await page.getByRole('button', { name: 'Replace everything on this device' }).click();
    await expect(page.getByRole('alert')).toContainText("Couldn't restore the backup");
    await page.evaluate(() => void (window.__failStorageWrites = false));
    expect(await savedNow(page)).toEqual(before);

    await chooseBackupFile(page, backupFile(TWO_LEARNERS, '2026-10-12T08:00:00.000Z'));
    await confirmImport(page);
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Hi 🦁 Zoe!' })).toBeVisible();
  });
});

test.describe('restoring on a device that was erased', () => {
  test('export, erase everything, set up as someone else, then import: the same home screen and progress come back', async ({
    page,
    audio,
    loadList,
  }) => {
    // Before: a learner part way through a retry round.
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    const practice = new PracticeScreen(page, audio, await loadList('fixture-three'));
    await practice.open();
    await practice.playRound((_, i) => i === 0); // two misses
    await practice.retry.click();
    await practice.reveal();
    await practice.gotIt.click(); // one of the two retried words done
    await page.goto('./');
    await expect(practice.keepGoing).toBeVisible();
    const homeBefore = await page.locator('main').innerText();
    await openBackupSection(page);
    const { text } = await exportBackup(page);
    const savedBefore = await savedNow(page);

    // Erase everything through the Danger zone: back to first run, nothing of Mia left.
    await page.goto('./');
    await openParentArea(page);
    await openParentSection(page, 'Danger zone');
    await page.getByRole('button', { name: 'Erase everything on this device' }).click();
    await page.getByRole('button', { name: 'Yes, continue' }).click();
    await page.getByRole('textbox', { name: /ERASE/ }).fill('ERASE');
    await page.getByRole('button', { name: 'Erase it all' }).click();
    await expect(page.getByRole('button', { name: /grown-up/i })).toBeVisible(); // first run

    // The device now belongs to someone else.
    await setUpLearner(page, { name: 'Leo', avatar: '🦊', lists: ['fixture-five'] });
    expect(await page.locator('main').innerText()).not.toBe(homeBefore);

    await openBackupSection(page);
    await chooseBackupFile(page, text);
    await expect(page.getByTestId('import-learners')).toHaveText('1');
    await expect(page.getByTestId('import-attempts')).toHaveText('1');
    await confirmImport(page);
    await page.goto('./');

    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Keep going/ })).toBeVisible();
    expect(await page.locator('main').innerText()).toBe(homeBefore);
    expect(await savedNow(page)).toEqual(savedBefore);
  });
});
