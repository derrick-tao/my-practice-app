import type { Locator, Page } from '@playwright/test';
import type { ListData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { allowAudioPlayback, PracticeScreen, rejectAudioPlayback, seedRandom } from './practice-driver.ts';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadList: (id: string) => Promise<ListData>;
}

async function start(
  { page, audio, loadList }: Fixtures,
  listId: string,
): Promise<{ practice: PracticeScreen; list: ListData }> {
  await page.goto('./');
  const list = await loadList(listId);
  const practice = new PracticeScreen(page, audio, list);
  await practice.open();
  return { practice, list };
}

test.describe('practice: listening', () => {
  test('tapping a card opens practice and requests the first item normal audio automatically', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-three');

    await expect(page).toHaveURL(/#\/chinese\/dictation\/fixture-three$/);
    await expect(practice.listen).toBeVisible();
    await expect.poll(async () => (await audio.played(list)).length).toBe(1);
    const [first] = await audio.played(list);
    expect(first!.rendition).toBe('normal');
    expect(list.items.map((i) => i.target)).toContain(first!.target);
    // The answer is not on screen while listening.
    await expect(practice.target).toHaveCount(0);
    await expect(page.getByText(first!.target!)).toHaveCount(0);
  });

  test('Check is hidden until audio has been requested, and the Listen button pulses when auto-play is blocked', async ({
    page,
    audio,
    loadList,
  }) => {
    // Reduced motion keeps the pulse class but stops the animation, so Playwright sees a stable button.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await rejectAudioPlayback(page);
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-three');

    await expect(practice.listen).toBeVisible();
    await expect(practice.listen).toHaveClass(/pulse/);
    await expect(practice.check).toHaveCount(0);
    expect(await audio.played(list)).toEqual([]);

    await allowAudioPlayback(page);
    await practice.listen.click();

    await expect(practice.check).toBeVisible();
    await expect(practice.listen).not.toHaveClass(/pulse/);
    expect((await audio.played(list)).map((p) => p.rendition)).toEqual(['normal']);
  });

  test('Slow also unlocks Check, and requests the slow rendition of the same item', async ({
    page,
    audio,
    loadList,
  }) => {
    // Wait for the blocked auto-play to have happened before allowing playback, otherwise a slow start
    // lets the first item's auto-play succeed (an extra `normal` request). Reduced motion keeps the
    // pulse class but stops the animation so the buttons stay clickable.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await rejectAudioPlayback(page);
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-three');
    await expect(practice.listen).toHaveClass(/pulse/);
    await expect(practice.check).toHaveCount(0);

    await allowAudioPlayback(page);
    await practice.slow.click();

    await expect(practice.check).toBeVisible();
    const played = await audio.played(list);
    expect(played.map((p) => p.rendition)).toEqual(['slow']);
  });

  test('Listen and Slow can be tapped any number of times, before and after Check', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-three');
    await expect(practice.check).toBeVisible();
    await audio.clear();

    await practice.listen.click();
    await practice.listen.click();
    await practice.slow.click();
    await practice.slow.click();
    await practice.slow.click();
    await practice.reveal();
    await practice.listen.click();
    await practice.slow.click();
    await practice.listen.click();

    const played = await audio.played(list);
    expect(played.map((p) => p.rendition)).toEqual([
      'normal',
      'normal',
      'slow',
      'slow',
      'slow',
      'normal',
      'slow',
      'normal',
    ]);
    // Always the item being practiced.
    expect(new Set(played.map((p) => p.target)).size).toBe(1);
  });
});

test.describe('practice: reveal and marking', () => {
  test('the reveal shows the heard item target, pinyin and clue from the list data', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-three');

    const seen: string[] = [];
    for (let i = 0; i < list.items.length; i++) {
      await expect(practice.check).toBeVisible();
      const heard = await practice.lastHeardTarget();
      expect(await practice.reveal()).toBe(heard);

      const item = list.items.find((x) => x.target === heard)!;
      await expect(page.getByText(item.pinyin, { exact: true })).toBeVisible();
      await expect(page.getByText(item.clue!, { exact: true })).toBeVisible();
      // Listen and Slow are still there, and the answer buttons appear.
      await expect(practice.listen).toBeVisible();
      await expect(practice.slow).toBeVisible();
      await expect(practice.check).toHaveCount(0);
      seen.push(heard!);
      await practice.gotIt.click();
    }
    expect([...seen].sort()).toEqual(list.items.map((x) => x.target).sort());
  });

  test('marking advances to the next item, requests its normal audio and updates the star bar', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-five');
    await expect(practice.check).toBeVisible();
    await expect(practice.progressText()).toHaveText('0 / 5');
    await expect(practice.progress).toHaveAttribute('aria-valuenow', '0');
    await expect(practice.progress).toHaveAttribute('aria-valuemax', '5');

    const first = await practice.reveal();
    await practice.gotIt.click();

    await expect(practice.progressText()).toHaveText('1 / 5');
    await expect(practice.progress).toHaveAttribute('aria-valuenow', '1');
    // Back on the listening screen of a different item, whose normal audio was requested.
    await expect(practice.check).toBeVisible();
    const played = await audio.played(list);
    expect(played.map((p) => p.rendition)).toEqual(['normal', 'normal']);
    expect(played[0]!.target).toBe(first);
    expect(played[1]!.target).not.toBe(first);
    await expect(practice.target).toHaveCount(0);

    await practice.reveal();
    await practice.notYet.click();
    await expect(practice.progressText()).toHaveText('2 / 5');
  });

  test('after the last item the round summary shows the right counts for a scripted sequence of marks', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-five');
    const missed = new Set(['狗', '年']);

    const order = await practice.playRound((target) => !missed.has(target));

    expect([...order].sort()).toEqual(list.items.map((x) => x.target).sort());
    await expect(practice.summary).toBeVisible();
    await expect(page.getByTestId('correct-count')).toHaveText('3');
    await expect(page.getByTestId('wrong-count')).toHaveText('2');
    await expect(practice.progressText()).toHaveText('5 / 5');
    // No further audio is requested at the end of the round.
    const played = await audio.played(list);
    expect(played).toHaveLength(5);
  });

  test('all marked wrong and all marked right give the matching summary counts', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    await practice.playRound(() => false);
    await expect(page.getByTestId('correct-count')).toHaveText('0');
    await expect(page.getByTestId('wrong-count')).toHaveText('3');
  });

  test('Home returns to the home screen from listening, the reveal and the summary', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-three');
    const homeCard = practice.listCard();

    await expect(practice.check).toBeVisible();
    await practice.home.click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(homeCard).toBeVisible();

    // Nothing is lost by going home: Keep going comes back to the same place (see resume.spec.ts).
    await practice.keepGoing.click();
    await practice.reveal();
    await practice.home.click();
    await expect(homeCard).toBeVisible();

    await practice.keepGoing.click();
    await practice.gotIt.click();
    await practice.playRound((_, i) => i !== 0);
    await expect(practice.summary).toBeVisible();
    await practice.home.click();
    await expect(homeCard).toBeVisible();
    expect(list.items).toHaveLength(3);
  });

  test('the answer buttons differ in shape and icon, not just color', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    await practice.reveal();
    await expect(practice.gotIt).toContainText('✅');
    await expect(practice.notYet).toContainText('❌');
    const radius = (button: typeof practice.gotIt): Promise<string> =>
      button.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(await radius(practice.gotIt)).not.toBe(await radius(practice.notYet));
  });
});

test.describe('practice: round 1 order', () => {
  test('is shuffled by default and the same every time for the same seed', async ({ page, audio, loadList }) => {
    await seedRandom(page, 7);
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-five');
    const listOrder = list.items.map((x) => x.target);

    const order = await practice.playRound(() => true);
    expect([...order].sort()).toEqual([...listOrder].sort());
    expect(order).not.toEqual(listOrder);

    await page.reload();
    await expect(practice.check).toBeVisible();
    expect(await practice.playRound(() => true)).toEqual(order);
  });

  test('a different seed gives a different order', async ({ page, audio, loadList }) => {
    await seedRandom(page, 7);
    const { practice } = await start({ page, audio, loadList }, 'fixture-five');
    const order = await practice.playRound(() => true);

    await seedRandom(page, 8);
    await page.reload();
    await expect(practice.check).toBeVisible();
    expect(await practice.playRound(() => true)).not.toEqual(order);
  });
});

test.describe('practice: layout', () => {
  async function expectOnScreen(page: Page, ...controls: Locator[]): Promise<void> {
    const viewport = page.viewportSize()!;
    for (const control of controls) {
      const box = (await control.boundingBox())!;
      expect(box, 'control is rendered').not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      // Everything a child needs is reachable without scrolling.
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
  }

  async function expectSize(control: Locator, minHeight: number): Promise<void> {
    const box = (await control.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(minHeight);
    expect(box.width).toBeGreaterThanOrEqual(64);
  }

  test('listening screen: controls fit and are finger-sized', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-five');
    await expect(practice.check).toBeVisible();
    await expectOnScreen(page, practice.home, practice.progress, practice.listen, practice.slow, practice.check);
    await expectSize(practice.home, 64);
    await expectSize(practice.listen, 64);
    await expectSize(practice.slow, 64);
    await expectSize(practice.check, 96);
  });

  test('revealed screen: very large target and all controls fit and are finger-sized', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-five');
    await practice.reveal();
    await expectOnScreen(
      page,
      practice.home,
      practice.target,
      practice.listen,
      practice.slow,
      practice.gotIt,
      practice.notYet,
    );
    await expectSize(practice.listen, 64);
    await expectSize(practice.slow, 64);
    await expectSize(practice.gotIt, 96);
    await expectSize(practice.notYet, 96);

    // About 40% of the short side of the screen.
    const viewport = page.viewportSize()!;
    const short = Math.min(viewport.width, viewport.height);
    const fontSize = await practice.target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(short * 0.35);
    expect(fontSize).toBeLessThanOrEqual(short * 0.45);
  });

  test('round summary fits on screen', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    await practice.playRound((_, i) => i !== 0);
    await expectOnScreen(page, practice.home, practice.summary);
  });
});

test.describe('practice: retry rounds and completion', () => {
  const missed = new Set(['狗', '年']);

  test('a round with misses offers to practice exactly the missed words, and the retry round holds exactly those', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-five');

    await practice.playRound((target) => !missed.has(target));
    await expect(page.getByTestId('correct-count')).toHaveText('3');
    await expect(page.getByTestId('wrong-count')).toHaveText('2');
    await expect(practice.summary).toContainText("Let's practice 2 more!");
    await expect(practice.retry).toBeVisible();
    await expect(practice.completion).toBeHidden();
    await audio.clear();

    await practice.retry.click();
    await expect(practice.summary).toBeHidden();
    await expect(practice.progressText()).toHaveText('0 / 2');
    // The first item of the new round is requested straight away (from the tap).
    const first = (await audio.played(list))[0];
    expect(first?.rendition).toBe('normal');
    expect(missed.has(first!.target!)).toBe(true);

    const order = await practice.playRound(() => true);
    expect([...order].sort()).toEqual([...missed].sort());
  });

  test('one miss in round 2 leads to round 3 with that item, then completion with first-try score and rounds', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-five');
    await practice.playRound((target) => !missed.has(target));

    const round2 = await practice.playRetryRound((_, i) => i !== 0);
    expect([...round2].sort()).toEqual([...missed].sort());
    await expect(practice.summary).toContainText("Let's practice 1 more!");
    await expect(page.getByTestId('wrong-count')).toHaveText('1');

    const round3 = await practice.playRetryRound(() => true);
    expect(round3).toEqual([round2[0]]);

    await expect(practice.completion).toBeVisible();
    await expect(practice.completion).toContainText('You did it!');
    await expect(practice.completion).toContainText('3 of 5 on the first try!');
    await expect(practice.completion).toContainText('Rounds: 3');
    await expect(practice.retry).toBeHidden();
    await expect(practice.summary).toBeHidden();

    await practice.home.click();
    await expect(page.getByRole('link', { name: /Fixture Five/ })).toBeVisible();
  });

  test('a round with no misses goes straight to completion with no retry button', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');

    await practice.playRound(() => true);

    await expect(practice.completion).toContainText('You did it!');
    await expect(practice.completion).toContainText('3 of 3 on the first try!');
    await expect(practice.completion).toContainText('Rounds: 1');
    await expect(practice.summary).toBeHidden();
    await expect(practice.retry).toBeHidden();
    await expect(practice.roundBadge).toBeHidden();
  });

  test('the round badge appears from round 2 onward and not in round 1', async ({ page, audio, loadList }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-five');
    await expect(practice.check).toBeVisible();
    await expect(practice.roundBadge).toBeHidden();
    await practice.playRound((target) => !missed.has(target));
    await expect(practice.roundBadge).toBeHidden();

    await practice.retry.click();
    await expect(practice.roundBadge).toBeVisible();
    await expect(practice.roundBadge).toContainText('2');
    await practice.reveal();
    await expect(practice.roundBadge).toContainText('2');
    await practice.notYet.click();
    await practice.playRound(() => true);

    await practice.retry.click();
    await expect(practice.roundBadge).toContainText('3');
  });

  test('a first-round miss on every item retries all of them', async ({ page, audio, loadList }) => {
    const { practice, list } = await start({ page, audio, loadList }, 'fixture-three');
    await practice.playRound(() => false);
    await expect(practice.summary).toContainText("Let's practice 3 more!");
    const order = await practice.playRetryRound(() => true);
    expect([...order].sort()).toEqual(list.items.map((x) => x.target).sort());
    await expect(practice.completion).toContainText('0 of 3 on the first try!');
    await expect(practice.completion).toContainText('Rounds: 2');
  });

  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    test(`retry rounds are reordered relative to the previous round (seed ${seed})`, async ({
      page,
      audio,
      loadList,
    }) => {
      await seedRandom(page, seed);
      const { practice } = await start({ page, audio, loadList }, 'fixture-five');

      // Miss two items: the hardest case for "reordered" (a plain shuffle repeats the order half the time).
      const round1 = await practice.playRound((target) => !missed.has(target));
      const missedInRound1 = round1.filter((t) => missed.has(t));
      const round2 = await practice.playRetryRound(() => false);
      expect(round2).toHaveLength(2);
      expect(round2).not.toEqual(missedInRound1);

      // And again for the next retry round.
      const round3 = await practice.playRetryRound(() => true);
      expect(round3).not.toEqual(round2);
    });
  }

  test('the retry button and the completion screen fit on screen and are finger-sized', async ({
    page,
    audio,
    loadList,
  }) => {
    const { practice } = await start({ page, audio, loadList }, 'fixture-three');
    await practice.playRound((_, i) => i !== 0);
    const viewport = page.viewportSize()!;
    const retryBox = (await practice.retry.boundingBox())!;
    expect(retryBox.height).toBeGreaterThanOrEqual(96 - 1);
    expect(retryBox.y + retryBox.height).toBeLessThanOrEqual(viewport.height);
    expect(retryBox.x + retryBox.width).toBeLessThanOrEqual(viewport.width);

    await practice.playRetryRound(() => true);
    await expect(practice.completion).toBeVisible();
    for (const control of [practice.home, practice.completion]) {
      const box = (await control.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    const homeBox = (await practice.home.boundingBox())!;
    expect(homeBox.height).toBeGreaterThanOrEqual(64 - 1);
  });
});
