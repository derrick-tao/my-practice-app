// Seam 1: the "Problems per practice" setting (10, 15 or 20; 20 until changed) decides how many problems a NEW math
// session has, for every math practice type. A session in progress keeps the size it started with, a retry round covers
// just the missed problems, and every place that said "20 problems" says the real count. Chinese is not affected.
import type { Page } from '@playwright/test';
import { expect, test } from './harness.ts';
import { FactsScreen, identityOf, kindOf } from './math-driver.ts';
import { addLearner, openParentArea, openParentSection, openProfiles, openSettings, setUpLearner } from './parent-driver.ts';

type Count = 10 | 15 | 20;

const choices = (page: Page) => page.getByRole('radiogroup', { name: 'Problems per practice' });
const choice = (page: Page, count: Count) => choices(page).getByRole('radio', { name: String(count), exact: true });

/** Home -> Settings -> choose the active learner's problems per practice -> back to home. */
async function setProblemCount(page: Page, count: Count): Promise<void> {
  await page.goto('./');
  await openSettings(page);
  await choice(page, count).click();
  await expect(choice(page, count)).toBeChecked(); // shows the saved value
  await page.getByRole('link', { name: 'Home' }).click();
}

const countBy = <T>(items: T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {});

test.describe('the setting', () => {
  test('offers 10, 15 and 20 next to Break, is 20 until changed, and says it only affects math', async ({ page }) => {
    await setUpLearner(page);
    await openSettings(page);

    await expect(choices(page).getByRole('radio')).toHaveText(['10', '15', '20']);
    await expect(choice(page, 20)).toBeChecked();
    const field = page.locator('.field').filter({ has: choices(page) });
    await expect(field).toContainText('Math only');
    await expect(field).toContainText('Chinese is not affected');
    await expect(page.getByRole('radiogroup', { name: 'Break every' })).toBeVisible();
  });

  test('is saved for the learner, and each learner has their own', async ({ page }) => {
    await setUpLearner(page, { name: 'Mia', avatar: '🐼' });
    await setProblemCount(page, 10);
    await openProfiles(page);
    await addLearner(page, { name: 'Zoe', avatar: '🦁', lessons: ['fixture-math'] });

    await page.goto('./');
    await page.getByRole('button', { name: 'Zoe' }).click();
    await openSettings(page);
    await expect(choice(page, 20)).toBeChecked(); // a new learner starts at 20

    await page.goto('./');
    await page.getByRole('button', { name: 'Mia' }).click();
    await page.reload();
    await openSettings(page);
    await expect(choice(page, 10)).toBeChecked(); // still Mia's, after a reload
  });
});

test.describe('a new math session', () => {
  const TYPES = [
    { lesson: 'Fixture Math', label: 'Facts' },
    { lesson: 'Fixture Missing Number', label: 'Missing' },
    { lesson: 'Fixture True or False', label: 'True?' },
    { lesson: 'Fixture Stories', label: 'Stories' },
    { lesson: 'Fixture Strategies', label: 'Tricks' },
  ] as const;

  for (const count of [10, 15] as const) {
    for (const { lesson, label } of TYPES) {
      test(`of ${label} has ${count} problems, and its Home button says so`, async ({ page }) => {
        await setUpLearner(page);
        await setProblemCount(page, count);

        const card = page.getByRole('group', { name: lesson, exact: true });
        await expect(card.getByRole('link', { name: `${label} · ${count} problems` })).toBeVisible();
        await card.getByRole('link', { name: `${label} ·` }).click();

        await expect(page.getByTestId('progress-text')).toHaveText(`0 / ${count}`);
      });
    }
  }

  test('of Facts at 10 is an even spread over the four kinds, half within 10, with no repeats', async ({ page, audio }) => {
    await setUpLearner(page);
    await setProblemCount(page, 10);
    const facts = new FactsScreen(page, audio);
    await facts.open('Fixture Math');

    const shown = await facts.playRound();

    expect(shown).toHaveLength(10);
    const kinds = countBy(shown, kindOf);
    expect(Object.keys(kinds).sort()).toEqual(['add-across-ten', 'add-within-10', 'subtract-across-ten', 'subtract-within-10']);
    expect(Object.values(kinds).sort()).toEqual([2, 2, 3, 3]);
    expect((kinds['add-within-10'] ?? 0) + (kinds['subtract-within-10'] ?? 0)).toBe(5);
    expect(new Set(shown.map(identityOf)).size).toBe(10);
    await expect(page.getByText('10 of 10 on the first try!')).toBeVisible();
  });

  test('of Facts at 15 is 4, 4, 4 and 3 over the four kinds, half within 10 as close as 15 allows', async ({ page, audio }) => {
    await setUpLearner(page);
    await setProblemCount(page, 15);
    const facts = new FactsScreen(page, audio);
    await facts.open('Fixture Math');

    const shown = await facts.playRound();

    expect(shown).toHaveLength(15);
    const kinds = countBy(shown, kindOf);
    expect(Object.values(kinds).sort()).toEqual([3, 4, 4, 4]);
    expect([7, 8]).toContain((kinds['add-within-10'] ?? 0) + (kinds['subtract-within-10'] ?? 0));
    expect(new Set(shown.map(identityOf)).size).toBe(15);
    await expect(page.getByText('15 of 15 on the first try!')).toBeVisible();
  });

  test('of an adding-only lesson at 15 is 8 and 7 over its two kinds', async ({ page, audio }) => {
    await setUpLearner(page);
    await setProblemCount(page, 15);
    const facts = new FactsScreen(page, audio);
    await facts.open('Fixture Adding Only');

    const shown = await facts.playRound();

    expect(shown).toHaveLength(15);
    expect(Object.values(countBy(shown, kindOf)).sort()).toEqual([7, 8]);
    expect(new Set(shown.map(identityOf)).size).toBe(15);
  });

  test('of Chinese practice is not affected', async ({ page }) => {
    await setUpLearner(page);
    await setProblemCount(page, 10);

    const card = page.getByRole('group', { name: 'Fixture Three', exact: true });
    await expect(card).toContainText('3 characters');
    await expect(card).not.toContainText('10');
  });
});

test.describe('a session in progress', () => {
  test('keeps its size when the setting changes, and a retry round covers just the missed problems', async ({ page, audio }) => {
    await setUpLearner(page);
    await setProblemCount(page, 10);
    const facts = new FactsScreen(page, audio);
    await facts.open('Fixture Math');
    await facts.solveFirstTry();
    await expect(facts.progress).toHaveText('1 / 10');

    await setProblemCount(page, 20);

    // Home: the card still says 10 for the one in progress, and the lesson's button now says 20.
    await expect(facts.keepGoing.getByTestId('progress-text')).toHaveText('1 / 10');
    await expect(page.getByRole('group', { name: 'Fixture Math', exact: true }).getByRole('link', { name: /Facts · 20 problems/ })).toBeVisible();
    await facts.keepGoing.click();
    await expect(facts.progress).toHaveText('1 / 10');

    // Miss one of the rest: the round still has 10 problems, and the retry round has that one.
    const shown = await facts.playRound((_equation, index) => (index === 3 ? 'missed' : 'first'));
    expect(shown).toHaveLength(9);
    await expect(facts.summary).toBeVisible();
    await facts.retry.click();
    await expect(facts.progress).toHaveText('0 / 1');
    await facts.playRound();
    await expect(facts.completion).toBeVisible();
  });

  test('is replaced by one of the new size once it is stopped with Start over', async ({ page, audio }) => {
    await setUpLearner(page);
    await setProblemCount(page, 10);
    const facts = new FactsScreen(page, audio);
    await facts.open('Fixture Math');
    await facts.solveFirstTry();
    await setProblemCount(page, 15);

    await page.getByRole('button', { name: 'Start over' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(facts.progress).toHaveText('0 / 15');
  });
});

test.describe('the real count is shown', () => {
  test('in the parent area: Assign lessons, Progress and Lesson preview', async ({ page }) => {
    await setUpLearner(page);
    await setProblemCount(page, 15);

    await openParentArea(page);
    await openParentSection(page, /Assign lessons/);
    await expect(page.getByRole('switch', { name: /Fixture Math/ })).toContainText('15 problems');
    await expect(page.getByRole('switch', { name: /Fixture Three/ })).toContainText('3 characters');

    await page.goto('./');
    await openParentArea(page);
    await openParentSection(page, 'Progress');
    await expect(page.getByRole('link', { name: /Fixture Math/ })).toContainText('15 problems');
    await page.getByRole('link', { name: /Fixture Math/ }).click();
    await expect(page.getByTestId('progress-part-facts').getByTestId('progress-facts')).toContainText('15 problems');

    await page.goto('./');
    await openParentArea(page);
    await openParentSection(page, 'Lesson preview');
    await expect(page.getByRole('link', { name: /Fixture Math/ })).toContainText('15 problems');
    await page.getByRole('link', { name: /Fixture Math/ }).click();
    await expect(page.getByTestId('preview-header')).toContainText('15 problems');
  });

  test('in Progress, whose totals come from the finished session', async ({ page, audio }) => {
    await setUpLearner(page);
    await setProblemCount(page, 10);
    const facts = new FactsScreen(page, audio);
    await facts.open('Fixture Math');
    await facts.playRound();
    await expect(page.getByText('10 of 10 on the first try!')).toBeVisible();

    await page.goto('./');
    await openParentArea(page);
    await openParentSection(page, 'Progress');
    await page.getByRole('link', { name: /Fixture Math/ }).click();
    const part = page.getByTestId('progress-part-facts');
    await expect(part.getByTestId('progress-facts')).toContainText('10 problems');
    await expect(part.getByTestId('progress-facts')).toContainText('Best first try: 10 of 10');
  });
});
