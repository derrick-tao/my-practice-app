// Seam 1: the parent's Lesson preview for a math lesson (ticket 54). Each math practice type shows its rules, its
// problem kinds and 5 sample problems, with a 🔀 button for new samples. Samples are random, so a spec checks that
// each one is a valid problem (the arithmetic on screen is right and stays within the rules) rather than which.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './harness.ts';
import { passGate, setUpLearner } from './parent-driver.ts';

/** One practice type's section of a lesson preview, by its heading ("Facts"). */
const previewSection = (page: Page, heading: string) =>
  page.getByTestId('preview-section').filter({ has: page.getByRole('heading', { name: heading }) });

async function openPreview(page: Page, lessonId: string): Promise<Locator> {
  await setUpLearner(page);
  await page.goto(`./#/parent/lesson-preview/${lessonId}`);
  await passGate(page);
  const facts = previewSection(page, 'Facts');
  await expect(facts).toBeVisible();
  return facts;
}

interface Sample {
  a: number;
  op: '+' | '−';
  b: number;
  answer: number;
}

/** The samples on screen, as the numbers they show. Their text is "8 + 6 = ☐" with "Answer: 14" beside it. */
async function readSamples(section: Locator): Promise<Sample[]> {
  const rows = section.getByTestId('preview-sample');
  await expect(rows).toHaveCount(5);
  const texts = await rows.allTextContents();
  return texts.map((text) => {
    const match = /(\d+) ([+−]) (\d+) = ☐.*Answer: (\d+)/.exec(text);
    if (!match) throw new Error(`not a sample problem: ${text}`);
    return { a: Number(match[1]), op: match[2] as Sample['op'], b: Number(match[3]), answer: Number(match[4]) };
  });
}

const textOfSamples = async (section: Locator): Promise<string[]> => section.getByTestId('preview-sample').allTextContents();

test.describe('math lesson preview', () => {
  test('a math practice type shows its rules, its problem kinds and 5 sample problems', async ({ page }) => {
    const facts = await openPreview(page, 'fixture-math');

    await expect(page.getByRole('heading', { name: 'Fixture Math', level: 2 })).toBeVisible();
    await expect(page.getByTestId('preview-header')).toContainText('20 problems');
    await expect(page.getByTestId('preview-header')).toContainText('Test: 2026-10-26 to 2026-10-30');
    await expect(facts.getByTestId('preview-rules')).toContainText('within 20 · adding and subtracting');
    // Literal kind names, independent of the app's own labelling.
    await expect(facts.getByTestId('preview-kind')).toHaveText([
      'add within 10',
      'add across ten',
      'subtract within 10',
      'subtract across ten',
    ]);
    await readSamples(facts);
  });

  test('every sample is a valid problem: its answer is right, and it stays within 20', async ({
    page,
  }) => {
    const facts = await openPreview(page, 'fixture-math');

    const samples = await readSamples(facts);

    for (const { a, op, b, answer } of samples) {
      expect(answer).toBe(op === '+' ? a + b : a - b);
      expect(Math.max(a, b, answer)).toBeLessThanOrEqual(20);
      expect(Math.min(a, b, answer)).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(samples.map(({ a, op, b }) => `${a}${op}${b}`)).size).toBe(5);
  });

  test('🔀 gives 5 new samples, each still a valid problem, again and again', async ({ page }) => {
    const facts = await openPreview(page, 'fixture-math');
    const seen: string[][] = [await textOfSamples(facts)];

    for (let press = 0; press < 3; press++) {
      await facts.getByRole('button', { name: 'New samples' }).click();
      await expect.poll(() => textOfSamples(facts)).not.toEqual(seen.at(-1));
      for (const { a, op, b, answer } of await readSamples(facts)) expect(answer).toBe(op === '+' ? a + b : a - b);
      seen.push(await textOfSamples(facts));
    }
    expect(new Set(seen.map((texts) => texts.join('|'))).size).toBe(4);
  });

  test('the samples follow the lesson rules: an adding-only lesson lists two kinds and only adding samples', async ({ page }) => {
    const facts = await openPreview(page, 'fixture-math-add');

    await expect(facts.getByTestId('preview-rules')).toContainText('within 20 · adding');
    await expect(facts.getByTestId('preview-rules')).not.toContainText('subtracting');
    await expect(facts.getByTestId('preview-kind')).toHaveText(['add within 10', 'add across ten']);
    for (const sample of await readSamples(facts)) expect(sample.op).toBe('+');
    await facts.getByRole('button', { name: 'New samples' }).click();
    for (const sample of await readSamples(facts)) expect(sample.op).toBe('+');
  });

  test('a Chinese lesson has no rules, kinds, samples or 🔀', async ({ page }) => {
    await setUpLearner(page);
    await page.goto('./#/parent/lesson-preview/fixture-three');
    await passGate(page);

    await expect(page.getByTestId('preview-item')).toHaveCount(3);
    await expect(page.getByTestId('preview-sample')).toHaveCount(0);
    await expect(page.getByTestId('preview-kind')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New samples' })).toHaveCount(0);
  });
});
