// Seam 1 helpers for the parent area's Backup section, driven the way a grown-up does it: tap Export and
// get a file, choose a file and confirm Import. Nothing here reads or writes storage directly.
//
// Besides testing backup itself, import is the way specs put a device into a chosen saved state (a
// session half way through a round, a profile with a setting changed) without touching IndexedDB:
//
//     await setUpLearner(page);                       // any learner: the Backup section needs one
//     await editSavedData(page, (saved) => ({ ...saved, sessions: [mySession(saved)] }));
//
// `editSavedData` exports what is on the device, lets the spec change it, imports the result and leaves
// the page on the home screen. For states a backup cannot express (data written by an older app, or
// newer than this one) use `seedSavedData` in saved-data.ts.
import { readFile } from 'node:fs/promises';
import { expect, type Download, type Page } from '@playwright/test';
import { openParentArea, openParentSection } from './parent-driver.ts';

/** The backup file as a spec sees it. Loosely typed on purpose: the file format is the contract. */
export interface BackupJson {
  appId: string;
  kind: string;
  schemaVersion: number;
  exportedAt: string;
  data: SavedData;
}

/** What a backup carries: the whole app record and every session. */
export interface SavedData {
  app: { schemaVersion: number; profiles: ProfileJson[]; activeProfileId: string | null; parent: { lastBackupAt?: string } };
  sessions: SessionJson[];
}

export interface ProfileJson {
  id: string;
  name: string;
  avatar: string;
  createdAt: string;
  settings: { shuffle: boolean; breakEvery: 0 | 5 | 10 | 15; sounds: boolean };
  assignedListIds: string[];
}

export interface SessionJson {
  id: string;
  profileId: string;
  listId: string;
  status: string;
  startedAt: string;
  [field: string]: unknown;
}

export const BACKUP_FILE_NAME = /^my-practice-app-backup-\d{4}-\d{2}-\d{2}\.json$/;

/** Home -> the gear -> gate -> Backup. */
export async function openBackupSection(page: Page): Promise<void> {
  await openParentArea(page);
  await openParentSection(page, /Backup/);
  await expect(page.getByRole('heading', { name: 'Backup', exact: true })).toBeVisible();
}

/** Make the browser look like one with no share sheet, so Export saves a download. Lasts until the page reloads. */
export async function withoutShareSheet(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
}

export interface ExportedBackup {
  fileName: string;
  text: string;
  backup: BackupJson;
}

async function read(download: Download): Promise<ExportedBackup> {
  const text = await readFile((await download.path())!, 'utf8');
  return { fileName: download.suggestedFilename(), text, backup: JSON.parse(text) as BackupJson };
}

/** Tap Export on the Backup section (already open) and return the downloaded file. */
export async function exportBackup(page: Page): Promise<ExportedBackup> {
  await withoutShareSheet(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export a backup/ }).click();
  return read(await download);
}

/** The file chooser behind "Import a backup". */
export function backupFileInput(page: Page) {
  return page.getByLabel('Import a backup');
}

/** Choose a backup file to import (a JSON value or raw text). Stops at the summary or the rejection message. */
export async function chooseBackupFile(
  page: Page,
  content: BackupJson | string,
  name = 'my-practice-app-backup-2026-10-18.json',
): Promise<void> {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  await backupFileInput(page).setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
}

/** Confirm the import summary on screen and wait until the data has been replaced. */
export async function confirmImport(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Replace everything on this device' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Backup restored' })).toBeVisible();
}

/** A backup file for `data`, as the app would write it at `exportedAt`. */
export function backupFile(data: SavedData, exportedAt: string): BackupJson {
  return { appId: 'my-practice-app', kind: 'backup', schemaVersion: data.app.schemaVersion, exportedAt, data };
}

/**
 * Change what is saved on a set-up device through backup: export it, apply `edit` to the data, import the
 * result. Ends on the home screen. The Backup section needs a learner, so call `setUpLearner` first.
 */
export async function editSavedData(page: Page, edit: (saved: SavedData) => SavedData): Promise<void> {
  await openBackupSection(page);
  const { backup } = await exportBackup(page);
  await chooseBackupFile(page, backupFile(edit(backup.data), backup.exportedAt));
  await confirmImport(page);
  await page.goto('./');
}

/**
 * Put these sessions on a set-up device (replacing whatever it had), as the active learner's. Sessions from
 * the saved-data fixtures carry the old implicit profile id; it is swapped for the learner's real one.
 */
export async function restoreSessions(page: Page, sessions: SessionJson[]): Promise<void> {
  await editSavedData(page, (saved) => ({
    ...saved,
    sessions: sessions.map((s) => ({ ...s, profileId: saved.app.activeProfileId ?? s.profileId })),
  }));
}
