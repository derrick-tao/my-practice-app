// Seam 1: the "?" help on a Tricks problem (ticket 69). The trick badge has a "?" button that opens a modal sheet over
// the practice screen with the trick's help: what it is, why it helps, and a worked example. Problems are random, so
// the spec reads each one from the screen (strategies-driver.ts) and checks the sheet against what it shows.
import type { Locator, Page } from '@playwright/test';
import { expect, test, type AudioProbe } from './harness.ts';
import { openSettings, setUpLearner } from './parent-driver.ts';
import { FactsScreen } from './math-driver.ts';
import { MissingNumberScreen } from './missing-number-driver.ts';
import { TrueOrFalseScreen } from './true-or-false-driver.ts';
import { StoriesScreen } from './words-driver.ts';
import { STRATEGY_KINDS, STRATEGY_TITLES, StrategiesScreen, type Shown, type StrategyKind } from './strategies-driver.ts';

const LESSON = 'Fixture Strategies';

interface Fixtures {
  page: Page;
  audio: AudioProbe;
}

async function start({ page, audio }: Fixtures, breakEvery?: 5 | 10 | 15): Promise<StrategiesScreen> {
  await setUpLearner(page);
  if (breakEvery !== undefined) {
    await openSettings(page);
    const choice = page.getByRole('radiogroup', { name: 'Break every' }).getByRole('radio', { name: String(breakEvery), exact: true });
    await choice.click();
    await expect(choice).toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();
  }
  const tricks = new StrategiesScreen(page, audio);
  await tricks.open(LESSON);
  await audio.clear();
  return tricks;
}

/** The help button on the trick badge, and the sheet it opens. */
const helpButton = (page: Page): Locator => page.getByRole('button', { name: /^Help: / });
const sheetOf = (page: Page): Locator => page.getByRole('dialog');
const gotIt = (sheet: Locator): Locator => sheet.getByRole('button', { name: 'Got it', exact: true });

const numbersIn = (text: string): number[] => (text.match(/\d+/g) ?? []).map(Number);

/** The numbers a problem starts from, sorted: those of its given line, or of its first step when it has none. */
function startingNumbers(shown: Shown): string {
  return numbersIn(shown.given ?? shown.lines[0]!).sort((x, y) => x - y).join(',');
}

/** Which trick a problem is, from its badge ("💡 Make a ten"): the first step alone does not always tell. */
function kindOfBadge(shown: Shown): StrategyKind {
  const kind = STRATEGY_KINDS.find((candidate) => shown.title === `💡 ${STRATEGY_TITLES[candidate]}`);
  if (kind === undefined) throw new Error(`no trick badge: ${shown.title}`);
  return kind;
}

test.describe('the ? help on a Tricks problem', () => {
  test('opens a sheet with what the trick is, why it helps and a worked example with other numbers, on every kind of trick', async ({ page, audio }) => {
    test.slow(); // it plays a whole round, checking the sheet on every problem: ~27s of the 30s default on CI
    const tricks = await start({ page, audio });
    const kinds = new Set<string>();

    await tricks.playRound(undefined, async () => {
      const shown = await tricks.read();
      const kind = kindOfBadge(shown);
      kinds.add(kind);

      await helpButton(page).click();
      const sheet = sheetOf(page);
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('heading', { name: new RegExp(STRATEGY_TITLES[kind]) })).toBeVisible();
      for (const part of ['What it is', 'Why it helps', 'Example']) {
        const section = sheet.getByTestId(`help-${part.toLowerCase().replace(/ /g, '-')}`);
        await expect(sheet.getByRole('heading', { name: part, exact: true })).toBeVisible();
        expect(((await section.textContent()) ?? '').trim().length, part).toBeGreaterThan(10);
      }
      // The example reads like the practice screen, answers filled in, and never shows a blank.
      const example = (await sheet.getByTestId('help-example-line').allTextContents()).map((line) => line.trim());
      expect(example.length).toBeGreaterThanOrEqual(2);
      for (const line of example) expect(line).not.toContain('☐');
      // ...and starts from other numbers than the problem on screen, so it never gives the answer away.
      const exampleStart = { given: null, lines: [example[0]!], title: null, hints: [] };
      expect(startingNumbers(exampleStart)).not.toBe(startingNumbers(shown));

      await gotIt(sheet).click();
      await expect(sheet).toBeHidden();
    });

    expect(kinds.size).toBe(7);
  });

  test('closes when the child taps outside the sheet, not when they tap inside it', async ({ page, audio }) => {
    await start({ page, audio });
    await helpButton(page).click();
    const sheet = sheetOf(page);
    await expect(sheet).toBeVisible();

    await sheet.getByRole('heading', { name: 'What it is', exact: true }).click(); // inside: it stays open
    await expect(sheet).toBeVisible();
    await page.mouse.click(2, 2); // the dimmed area outside the sheet
    await expect(sheet).toBeHidden();
  });

  test('works before and after answering: after a right step, after a wrong try and once the problem is missed', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    const sheet = sheetOf(page);
    const openAndClose = async (): Promise<void> => {
      await helpButton(page).click();
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('heading', { name: 'Example', exact: true })).toBeVisible();
      await gotIt(sheet).click();
      await expect(sheet).toBeHidden();
    };

    await openAndClose(); // before answering
    await tricks.answerRight();
    await expect(tricks.steps).toHaveCount(2);
    await openAndClose(); // after a right step, on the next one
    await tricks.answerWrong();
    await expect(tricks.feedback).toContainText('Try again');
    await openAndClose(); // after a wrong try
    await tricks.answerWrong();
    await expect(tricks.strategy).toBeVisible();
    await openAndClose(); // once the problem is missed: the answer is showing and Next is waiting
    await expect(tricks.next).toBeVisible();
  });

  test('leaves the score, the tries and the saved session alone', async ({ page, audio }) => {
    const tricks = await start({ page, audio });
    const sheet = sheetOf(page);
    const openAndClose = async (): Promise<void> => {
      await helpButton(page).click();
      await expect(sheet).toBeVisible();
      await gotIt(sheet).click();
      await expect(sheet).toBeHidden();
    };

    await tricks.solveProblem();
    await expect(tricks.progress).toHaveText('1 / 20');
    await openAndClose();
    await expect(tricks.progress).toHaveText('1 / 20');

    // One wrong try is still just one try: opening the help does not use up or give back the second one.
    await tricks.answerWrong();
    await expect(tricks.feedback).toContainText('Try again');
    await openAndClose();
    await expect(tricks.feedback).toContainText('Try again');
    await expect(tricks.strategy).toHaveCount(0);
    expect(await audio.effects()).toEqual(['chime']); // from the first problem; the help made no sound
    await tricks.reopenViaKeepGoing(); // and what is saved is the same
    await expect(tricks.progress).toHaveText('1 / 20');
    await expect(tricks.feedback).toContainText('Try again');
    await tricks.answerWrong(); // the second wrong try is the last one
    await expect(tricks.strategy).toBeVisible();
    await expect(tricks.progress).toHaveText('1 / 20');
  });

  test('does not count toward the break: the prompt still comes after exactly the set number of problems', async ({ page, audio }) => {
    const tricks = await start({ page, audio }, 5);
    const sheet = sheetOf(page);

    for (let problem = 0; problem < 5; problem++) {
      await expect(tricks.breakPrompt).toHaveCount(0);
      for (let times = 0; times < 2; times++) {
        await helpButton(page).click();
        await gotIt(sheet).click();
        await expect(sheet).toBeHidden();
      }
      await tricks.solveProblem();
    }

    await expect(tricks.breakPrompt).toBeVisible(); // after the fifth, not earlier
    await tricks.keepOn.click();
    await expect(tricks.breakPrompt).toHaveCount(0);
    await expect(helpButton(page)).toBeVisible();
  });

  test('is an overlay: the number pad stays where it is while the sheet is open', async ({ page, audio }) => {
    await start({ page, audio });
    const check = page.getByRole('button', { name: 'Check', exact: true });
    const before = await check.boundingBox();

    await helpButton(page).click();
    await expect(sheetOf(page)).toBeVisible();
    const during = await check.boundingBox();
    await gotIt(sheetOf(page)).click();
    const after = await check.boundingBox();

    expect(during).toEqual(before);
    expect(after).toEqual(before);
  });

  test('is readable on a tablet: the sheet fits the screen with big text and a big Got it button @layout', async ({ page, audio }) => {
    await start({ page, audio });
    await helpButton(page).click();
    const sheet = sheetOf(page);
    await expect(sheet).toBeVisible();

    const view = page.viewportSize()!;
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height);
    const close = (await gotIt(sheet).boundingBox())!;
    expect(close.height).toBeGreaterThanOrEqual(64);
    // Even in a short landscape window the Got it button can be reached (the sheet scrolls).
    await gotIt(sheet).scrollIntoViewIfNeeded();
    await expect(gotIt(sheet)).toBeInViewport();
    const sizes = await sheet.locator('p').evaluateAll((lines) => lines.map((line) => parseFloat(getComputedStyle(line).fontSize)));
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(18);
  });

  test('is a Tricks thing: Facts, Missing number, True or false and Stories show no ?', async ({ page, audio }) => {
    await setUpLearner(page);

    const facts = new FactsScreen(page, audio);
    await facts.open('Fixture Math');
    await expect(facts.problem).toBeVisible();
    await expect(helpButton(page)).toHaveCount(0);

    const missing = new MissingNumberScreen(page, audio);
    await missing.open('Fixture Missing Number');
    await expect(missing.problem).toBeVisible();
    await expect(helpButton(page)).toHaveCount(0);

    const trueOrFalse = new TrueOrFalseScreen(page, audio);
    await trueOrFalse.open('Fixture True or False');
    await expect(trueOrFalse.problem).toBeVisible();
    await expect(helpButton(page)).toHaveCount(0);

    const stories = new StoriesScreen(page, audio);
    await stories.open('Fixture Stories');
    await expect(stories.problem).toBeVisible();
    await expect(helpButton(page)).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
