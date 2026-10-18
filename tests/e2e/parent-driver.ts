// Seam 1 helpers for the parent side: the gate, the parent area, and first-run setup.
//
// START HERE when a spec needs the child's home screen. The app has no usable home until a grown-up has
// set it up (first run: gate -> create a profile -> assign lists), so every spec that used to begin with
// `page.goto('./')` now begins with:
//
//     await setUpLearner(page);                                   // all fixture lists assigned, 🐼 Mia
//     await setUpLearner(page, { lists: ['fixture-three'] });     // only some lists
//     await setUpLearner(page, { name: 'Leo', avatar: '🦊' });
//
// `setUpLearner` drives the real screens (public surface only) and leaves the page on the home screen.
// It navigates to the app itself, so call it AFTER anything that must happen before the app loads on a
// fresh device (`seedSavedData`, `seedRandom`, `page.clock.install()`, init scripts), not before.
import { expect, type Page } from '@playwright/test';
import type { Manifest } from '../../src/content/types.ts';

export const DEFAULT_LEARNER = { name: 'Mia', avatar: '🐼' } as const;

export interface LearnerOptions {
  /** Ids of the lists to assign (e.g. 'fixture-three'). Default: every published list. */
  lists?: string[];
  /** Default 'Mia'. */
  name?: string;
  /** One of the avatars offered on the profile form. Default '🐼'. */
  avatar?: string;
}

/** Tap digits on the on-screen number pad. */
export async function tapNumber(page: Page, value: number | string): Promise<void> {
  for (const digit of String(value)) await page.getByRole('button', { name: digit, exact: true }).click();
}

/** The two factors of the gate question currently on screen ("7 × 8"). */
export async function gateFactors(page: Page): Promise<[number, number]> {
  const question = page.getByTestId('gate-question');
  await expect(question).toBeVisible();
  const [a, b] = ((await question.textContent()) ?? '').match(/\d+/g)!.map(Number);
  return [a!, b!];
}

/** Answer the gate on screen correctly, the way a grown-up would: read the question, tap the answer, OK. */
export async function passGate(page: Page): Promise<void> {
  const [a, b] = await gateFactors(page);
  await tapNumber(page, a * b);
  await page.getByRole('button', { name: 'OK', exact: true }).click();
}

/** Submit an answer that is wrong for the question on screen. */
export async function failGate(page: Page): Promise<void> {
  const [a, b] = await gateFactors(page);
  await tapNumber(page, a * b + 1);
  await page.getByRole('button', { name: 'OK', exact: true }).click();
}

/** Home -> the gear -> gate -> the parent area (its section list). */
export async function openParentArea(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Parent area' }).click();
  await passGate(page);
  await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toBeVisible();
}

/** Parent area -> one of its sections, by title (e.g. 'Assign lists'). */
export async function openParentSection(page: Page, title: string | RegExp): Promise<void> {
  await page.getByRole('link', { name: title }).click();
}

/** Titles of the published lists, as the app shows them, keyed by list id (read from the served manifest). */
async function listTitles(page: Page): Promise<Map<string, string>> {
  const response = await page.request.get('content/manifest.json');
  expect(response.ok(), 'manifest should be served').toBe(true);
  const manifest = (await response.json()) as Manifest;
  return new Map(
    manifest.subjects.flatMap((s) => s.practiceTypes.flatMap((t) => t.lists.map((l) => [l.id, l.title] as const))),
  );
}

/**
 * First run through the real screens: "Ask a grown-up" -> gate -> profile (name + avatar) -> assign
 * lists -> Done. Leaves the page on the child's home screen, greeting visible.
 */
export async function setUpLearner(page: Page, options: LearnerOptions = {}): Promise<void> {
  const { name = DEFAULT_LEARNER.name, avatar = DEFAULT_LEARNER.avatar } = options;
  const titles = await listTitles(page);
  const wanted = options.lists ?? [...titles.keys()];

  await page.goto('./');
  await page.getByRole('button', { name: /grown-up/i }).click();
  await passGate(page);

  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('button', { name: avatar, exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  for (const id of wanted) {
    const title = titles.get(id);
    if (title === undefined) throw new Error(`setUpLearner: no published list with id "${id}"`);
    await page.getByRole('switch', { name: new RegExp(title) }).click();
  }
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('heading', { name: `Hi ${avatar} ${name}!` })).toBeVisible();
}
