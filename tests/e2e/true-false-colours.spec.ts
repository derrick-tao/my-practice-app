// Seam 1: the True and False answer buttons have their own colours. They differ from each other, from the purple
// primary style, and from the green and red of the self-judging marks; white text on each is easy to read; and the
// words stay on the buttons, so colour is never the only cue.
import type { Page } from '@playwright/test';
import { expect, test } from './harness.ts';
import { setUpLearner } from './parent-driver.ts';
import { TrueOrFalseScreen } from './true-or-false-driver.ts';

type Rgb = [number, number, number];

function parseRgb(css: string): Rgb {
  const match = css.match(/rgba?\((\d+), (\d+), (\d+)/);
  if (!match) throw new Error(`not an rgb colour: ${css}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** What the browser computes for a button's colour, found by the words on it. */
async function buttonColour(page: Page, label: string, property: 'backgroundColor' | 'color'): Promise<Rgb> {
  const css = await page.evaluate(
    ({ text, prop }) => {
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
      return getComputedStyle(button!)[prop];
    },
    { text: label, prop: property },
  );
  return parseRgb(css);
}

/** Resolve var(--accent) and friends to [r, g, b] the way the browser paints them. */
async function resolved(page: Page, colour: string): Promise<Rgb> {
  const css = await page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = value;
    document.body.append(probe);
    const computed = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return computed;
  }, colour);
  return parseRgb(css);
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const same = (a: Rgb, b: Rgb): boolean => a.every((v, i) => v === b[i]);

test.describe('the True and False buttons', () => {
  test('are two different colours, neither purple, green nor red, with readable white words', async ({ page, audio }) => {
    await setUpLearner(page, { lessons: ['fixture-math-tf'] });
    const screen = new TrueOrFalseScreen(page, audio);
    await screen.open('Fixture True or False');
    await expect(screen.trueButton).toBeVisible();
    await expect(screen.falseButton).toBeVisible();

    const trueColour = await buttonColour(page, 'True', 'backgroundColor');
    const falseColour = await buttonColour(page, 'False', 'backgroundColor');
    expect(same(trueColour, falseColour)).toBe(false);

    for (const taken of ['var(--accent)', 'var(--good)', 'var(--bad)']) {
      const other = await resolved(page, taken);
      expect(same(trueColour, other), `True matches ${taken}`).toBe(false);
      expect(same(falseColour, other), `False matches ${taken}`).toBe(false);
    }

    const white: Rgb = [255, 255, 255];
    expect(await buttonColour(page, 'True', 'color')).toEqual(white);
    expect(await buttonColour(page, 'False', 'color')).toEqual(white);
    expect(contrast(white, trueColour)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(white, falseColour)).toBeGreaterThanOrEqual(4.5);
  });
});
