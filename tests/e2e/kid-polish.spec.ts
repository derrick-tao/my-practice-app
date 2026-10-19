// Seam 1 for ticket 15 (kid polish): the Kai font, sound effects, confetti, the volume hint, touch targets.
import type { Page } from '@playwright/test';
import type { ListData } from '../../src/content/types.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { setSoundEffects, setUpLearner } from './parent-driver.ts';
import { allowAudioPlayback, PracticeScreen, rejectAudioPlayback } from './practice-driver.ts';

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

/** Play the list through to the completion screen, all right the first time. */
async function finish(practice: PracticeScreen): Promise<void> {
  await practice.playRound(() => true);
  await expect(practice.completion).toBeVisible();
}

test.describe('confetti', () => {
  test('confetti falls on the completion screen', async ({ page, audio, loadList }) => {
    const practice = await start({ page, audio, loadList }, 'fixture-three');
    await finish(practice);

    const confetti = page.getByTestId('confetti');
    await expect(confetti).toBeAttached();
    expect(await confetti.locator('.confetti__piece').count()).toBeGreaterThanOrEqual(20);
    const animation = await confetti.locator('.confetti__piece').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('confetti-fall');
    await expect(page.getByTestId('completion-fade')).toHaveCount(0);
    // It is decoration: it never blocks the Home button and a screen reader skips it.
    await expect(confetti).toHaveAttribute('aria-hidden', 'true');
    await expect(practice.completion.getByRole('link', { name: 'Home' })).toBeVisible();
  });

  test('with reduced motion the confetti is replaced by a simple fade', async ({ page, audio, loadList }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const practice = await start({ page, audio, loadList }, 'fixture-three');
    await finish(practice);

    await expect(page.getByTestId('confetti')).toHaveCount(0);
    const fade = page.getByTestId('completion-fade');
    await expect(fade).toBeAttached();
    expect(await fade.evaluate((el) => getComputedStyle(el).animationName)).toBe('completion-fade');
    // Nothing moves: the only animation allowed is the opacity fade.
    expect(await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName))).toEqual([
      'completion-fade',
    ]);
  });
});

/** Every tappable control on the screen that is too small for a child's finger, or cut off at the sides. */
async function undersizedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const problems: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('main a[href], main button, main [role="button"]')) {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      if (style.visibility === 'hidden' || style.display === 'none' || box.width === 0 || box.height === 0) continue;
      if (el.closest('.sr-only')) continue;
      const name = (el.textContent ?? '').trim() || el.getAttribute('aria-label') || el.className;
      const primary = el.classList.contains('btn--primary');
      const minHeight = primary ? 96 : 64;
      if (box.width < 64 || box.height < minHeight) {
        problems.push(`${name}: ${Math.round(box.width)}x${Math.round(box.height)} (needs 64 wide, ${minHeight} tall)`);
      }
      if (box.left < 0 || box.right > viewportWidth) problems.push(`${name}: cut off at the sides`);
    }
    return problems;
  });
}

/**
 * Walk every kid-facing screen in turn (the listening screen, the revealed ✅/❌, the Undo chip, the break
 * prompt, a round summary, completion, home with Keep going, the stop-current-practice question) and
 * collect what `inspect` reports for each. An empty list per screen means nothing is wrong there.
 */
async function inspectKidScreens(
  { page, audio, loadList }: Fixtures,
  inspect: (page: Page) => Promise<string[]>,
): Promise<Record<string, string[]>> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const practice = await start({ page, audio, loadList }, 'fixture-twelve');
  const screens: Record<string, string[]> = {};
  const record = async (name: string): Promise<void> => void (screens[name] = await inspect(page));

  await record('listening');
  await practice.reveal();
  await record('revealed: ✅ and ❌');
  await practice.gotIt.click();
  await expect(practice.undo).toBeVisible();
  await record('after a mark: Undo chip');

  // Ten marks in a row bring up the break prompt.
  await practice.markMany(9);
  await expect(practice.breakPrompt).toBeVisible();
  await record('break prompt');
  await practice.keepOn.click();

  // Finish the round with a miss: the round summary.
  await practice.playRound((_, index) => index !== 0);
  await expect(practice.summary).toBeVisible();
  await record('round summary');

  // The retry round ends the list: the completion screen.
  await practice.retry.click();
  await practice.playRound(() => true);
  await expect(practice.completion).toBeVisible();
  await record('completion');
  await practice.completion.getByRole('link', { name: 'Home' }).click();

  // A list in progress shows on home as Keep going.
  const three = new PracticeScreen(page, audio, await loadList('fixture-three'));
  await three.listCard().click();
  await three.markNext(true);
  await three.home.click();
  await expect(three.keepGoing).toBeVisible();
  await record('home with Keep going');

  // Another list while one is active: the "Stop your current practice?" question.
  await page.getByRole('link', { name: /Fixture Five/ }).click();
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();
  await record('stop-current-practice question');
  return screens;
}

const allClear = (screens: Record<string, string[]>): Record<string, string[]> =>
  Object.fromEntries(Object.keys(screens).map((name) => [name, []]));

test.describe('touch targets', () => {
  test('every control on the kid screens is at least 64 pt, primary actions 96 pt, on this device and orientation', { tag: '@layout' }, async ({
    page,
    audio,
    loadList,
  }) => {
    const screens = await inspectKidScreens({ page, audio, loadList }, undersizedControls);
    expect(screens).toEqual(allClear(screens));
  });
});

/** Every control on the screen that a child who cannot read yet could not recognise by a picture. */
async function iconlessControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('main a[href], main button, main [role="button"]')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (!el.querySelector('[aria-hidden="true"]')) {
        problems.push(`${(el.textContent ?? '').trim() || el.className}: no icon`);
      }
    }
    return problems;
  });
}

test.describe('icon-led labels', () => {
  test('every control on the kid screens carries an icon beside its words', async ({ page, audio, loadList }) => {
    const screens = await inspectKidScreens({ page, audio, loadList }, iconlessControls);
    expect(screens).toEqual(allClear(screens));
  });
});

test.describe('volume hint', () => {
  test('two audio failures in a row show "Turn up the volume"; one does not, and a success clears it', async ({
    page,
    audio,
    loadList,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // a pulsing Listen button cannot be clicked
    await rejectAudioPlayback(page);
    const practice = await start({ page, audio, loadList }, 'fixture-three');
    const hint = page.getByText('No sound? Turn up the volume');

    // The auto-play on arrival failed: that is one failure.
    await expect(practice.listen).toHaveClass(/pulse/);
    await expect(hint).toHaveCount(0);

    // The child taps Listen and it fails again.
    await practice.listen.click();
    await expect(hint).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Turn up the volume' })).toBeVisible();

    // Sound works again: the hint goes away, and a single new failure does not bring it back.
    await allowAudioPlayback(page);
    await practice.listen.click();
    await expect(hint).toHaveCount(0);
    await page.evaluate(() => void (window.__rejectAudio = true));
    await practice.listen.click();
    await expect(hint).toHaveCount(0);
    await practice.slow.click();
    await expect(hint).toBeVisible();
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
