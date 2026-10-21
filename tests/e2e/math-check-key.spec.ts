// Seam 1: the number pad's submit key on the math practice screens (ticket 65). It shows a bold check-mark glyph
// (a plain heavy glyph, not the self-grading ✅ emoji) so it fits a digit-sized key, and is still named "Check" for
// screen readers and switches. The parent gate's number pad keeps saying "OK".
import { expect, test } from './harness.ts';
import { FactsScreen } from './math-driver.ts';
import { setUpLearner } from './parent-driver.ts';

// ✓ or ✔, optionally followed by the text-presentation selector.
const GLYPH = /^[✓✔]︎?$/u;

test.describe('the Check key on the math number pad', () => {
  test('shows a check-mark glyph that fits inside its key, not the word and not the ✅ emoji', async ({ page, audio }) => {
    await setUpLearner(page);
    await new FactsScreen(page, audio).open('Fixture Math');

    const key = page.getByRole('button', { name: 'Check', exact: true });
    await expect(key).toBeVisible();

    // The visible text is the glyph alone: the word "Check" is the accessible name, not drawn on the key.
    const glyph = key.locator('[aria-hidden="true"]');
    await expect(glyph).toHaveText(GLYPH);
    await expect(key).not.toContainText('✅');

    // The glyph sits wholly inside the key, and the key does not overflow.
    const keyBox = (await key.boundingBox())!;
    const glyphBox = (await glyph.boundingBox())!;
    expect(glyphBox.x).toBeGreaterThanOrEqual(keyBox.x);
    expect(glyphBox.y).toBeGreaterThanOrEqual(keyBox.y);
    expect(glyphBox.x + glyphBox.width).toBeLessThanOrEqual(keyBox.x + keyBox.width);
    expect(glyphBox.y + glyphBox.height).toBeLessThanOrEqual(keyBox.y + keyBox.height);
    expect(await key.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    // The key is as wide as a digit key, and white on a purple (non-white) background.
    const digitBox = (await page.getByRole('button', { name: '5', exact: true }).boundingBox())!;
    expect(keyBox.width).toBeCloseTo(digitBox.width, 0);
    const colours = await key.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, background: style.backgroundColor };
    });
    expect(colours.color).toBe('rgb(255, 255, 255)');
    expect(colours.background).not.toBe('rgb(255, 255, 255)');
  });

  test('tapping the key by its accessible name submits the answer', async ({ page, audio }) => {
    await setUpLearner(page);
    const facts = new FactsScreen(page, audio);
    await facts.open('Fixture Math');

    // A wrong first try shows "Try again" feedback, so the tap reached the app.
    await facts.answerWrong();

    await expect(facts.feedback).toContainText('Try again');
  });

  test('the parent gate keeps its OK key and has no Check key', async ({ page }) => {
    await setUpLearner(page);
    await page.getByRole('link', { name: 'Parent area' }).click();

    const ok = page.getByRole('button', { name: 'OK', exact: true });
    await expect(ok).toBeVisible();
    await expect(ok).toHaveText('OK');
    await expect(page.getByRole('button', { name: 'Check', exact: true })).toHaveCount(0);
  });
});
