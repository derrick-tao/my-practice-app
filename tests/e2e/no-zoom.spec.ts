// Seam 1: zoom is disabled app-wide (learner screens and the parent area), so a child on a tablet cannot zoom by
// accident with a double tap or a pinch.
import type { Page } from '@playwright/test';
import { expect, test } from './harness.ts';
import { openParentArea, setUpLearner } from './parent-driver.ts';

async function expectZoomDisabled(page: Page): Promise<void> {
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toMatch(/maximum-scale=1(\.0)?\b/);
  expect(viewport).toMatch(/user-scalable=no/);
  // Double-tap zoom is off when the page's touch action is "manipulation" (pan and pinch only, no double tap).
  expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).toBe('manipulation');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('manipulation');
}

/** Dispatch a cancelable iOS Safari pinch start; true when the app cancelled it. */
async function pinchIsCancelled(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const event = new Event('gesturestart', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

test.describe('no zoom', () => {
  test('the learner screens forbid scaling, double-tap zoom and pinch', async ({ page }) => {
    await setUpLearner(page);
    await expectZoomDisabled(page);
    expect(await pinchIsCancelled(page)).toBe(true);
  });

  test('the parent area forbids scaling, double-tap zoom and pinch too', async ({ page }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await expectZoomDisabled(page);
    expect(await pinchIsCancelled(page)).toBe(true);
  });
});
