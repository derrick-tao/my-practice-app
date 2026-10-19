// Seam 1 for ticket 15 (kid polish): the Kai font, sound effects, confetti, the volume hint, touch targets.
import type { Page } from '@playwright/test';
import type { ListData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { setSoundEffects, setUpLearner } from './parent-driver.ts';
import { PracticeScreen } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadList: (id: string) => Promise<ListData>;
}

/** A learner is set up and the list is open on its first item. */
async function start({ page, audio, loadList }: Fixtures, listId: string): Promise<PracticeScreen> {
  await setUpLearner(page);
  const practice = new PracticeScreen(page, audio, await loadList(listId));
  await practice.open();
  await expect(practice.listen).toBeVisible();
  return practice;
}

test.describe('Kai font', () => {
  test('the revealed character is drawn with the self-hosted subset font', async ({ page, audio, loadList }) => {
    const fontResponses: Array<{ url: string; status: number }> = [];
    page.on('response', (response) => {
      if (response.url().includes('.woff2')) fontResponses.push({ url: response.url(), status: response.status() });
    });
    const practice = await start({ page, audio, loadList }, 'fixture-three');
    const target = await practice.reveal();

    await expect
      .poll(() =>
        page.evaluate((text) => {
          const faces = [...document.fonts].filter((face) => face.family.replace(/["']/g, '') === 'Practice Kai');
          return { statuses: faces.map((face) => face.status), covers: document.fonts.check('1em "Practice Kai"', text) };
        }, target),
      )
      .toEqual({ statuses: ['loaded'], covers: true });

    const family = await practice.target.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family.split(',')[0]!.replace(/["']/g, '').trim()).toBe('Practice Kai');
    // It falls back to a system font when the file cannot be used.
    expect(family.split(',').length).toBeGreaterThan(1);

    // Served by the app itself, from its own origin and base path.
    expect(fontResponses).toEqual([
      { url: new URL('content/fonts/practice-kai.woff2', page.url()).href, status: 200 },
    ]);
  });
});

test.describe('sound effects', () => {
  test('a chime on a ✅, a gentle tone on a ❌, and a fanfare when the last word is right', async ({
    page,
    audio,
    loadList,
  }) => {
    const practice = await start({ page, audio, loadList }, 'fixture-three');
    expect(await audio.effects()).toEqual([]);

    await practice.markNext(true);
    await expect.poll(() => audio.effects()).toEqual(['chime']);
    await practice.markNext(false);
    await expect.poll(() => audio.effects()).toEqual(['chime', 'gentle']);
    await practice.markNext(true);
    await expect.poll(() => audio.effects()).toEqual(['chime', 'gentle', 'chime']);
    await expect(practice.summary).toBeVisible();

    await practice.retry.click();
    await practice.markNext(true);
    await expect(practice.completion).toBeVisible();
    await expect.poll(() => audio.effects()).toEqual(['chime', 'gentle', 'chime', 'fanfare']);
  });

  test('with the sounds setting off, no effect is requested but the characters are still read out', async ({
    page,
    audio,
    loadList,
  }) => {
    await setUpLearner(page);
    await setSoundEffects(page, false);
    const practice = new PracticeScreen(page, audio, await loadList('fixture-three'));
    await practice.open();
    await expect(practice.listen).toBeVisible();

    await practice.markNext(true);
    await practice.markNext(false);
    await practice.markNext(true);
    await practice.retry.click();
    await practice.markNext(true);
    await expect(practice.completion).toBeVisible();

    expect(await audio.effects()).toEqual([]);
    expect((await audio.played(practice.list)).length).toBeGreaterThan(0);
  });
});
