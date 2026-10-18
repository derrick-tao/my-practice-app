// Seam 1: the parent's List preview (ticket 12). Public surface only: the parent gate, the parent
// area's screens, and the audio requests the app makes (the stubbed play() in harness.ts).
import { expect, test } from './harness.ts';
import { openParentArea, openParentSection, passGate, setUpLearner } from './parent-driver.ts';

test.describe('list preview', () => {
  test('lists every item of a list with target, pinyin and clue, in list order, under a header with the list facts', async ({
    page,
    loadList,
  }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await openParentSection(page, 'List preview');
    await page.getByRole('link', { name: /Fixture Three/ }).click();

    await expect(page.getByRole('heading', { name: 'Fixture Three', level: 2 })).toBeVisible();
    const header = page.getByTestId('preview-header');
    await expect(header).toContainText('Simplified');
    await expect(header).toContainText('Test: 2026-11-02 to 2026-11-06');
    await expect(header).toContainText('3 characters');

    const list = await loadList('fixture-three');
    const rows = page.getByTestId('preview-item');
    await expect(rows).toHaveCount(list.items.length);
    for (const [index, item] of list.items.entries()) {
      const row = rows.nth(index);
      await expect(row).toContainText(item.target);
      await expect(row).toContainText(item.pinyin);
      await expect(row).toContainText(item.clue!);
    }
    // The literal values from the fixture file, independent of the build output.
    await expect(rows.nth(0)).toContainText('找');
    await expect(rows.nth(0)).toContainText('zhǎo');
    await expect(rows.nth(0)).toContainText('找东西');
    await expect(rows.nth(2)).toContainText('fēn');
  });

  test('shows generated pinyin, and an item without a clue just has none', async ({ page, loadList }) => {
    await setUpLearner(page);
    await page.goto('./#/parent/list-preview/fixture-twelve');
    await passGate(page);

    const header = page.getByTestId('preview-header');
    await expect(header).toContainText('12 characters');
    await expect(header).not.toContainText('Test:');

    const list = await loadList('fixture-twelve');
    const rows = page.getByTestId('preview-item');
    await expect(rows).toHaveCount(12);
    await expect(rows.nth(0)).toContainText('一');
    await expect(rows.nth(0)).toContainText(list.items[0]!.pinyin);
    await expect(rows.nth(0)).toContainText('yī');
    await expect(rows.nth(11)).toContainText('小');
  });

  test('the normal and slow buttons request that item\'s own rendition of the audio, and nothing plays on its own', async ({
    page,
    audio,
    loadList,
  }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await openParentSection(page, 'List preview');
    await page.getByRole('link', { name: /Fixture Three/ }).click();
    const list = await loadList('fixture-three');
    const rows = page.getByTestId('preview-item');
    await expect(rows).toHaveCount(3);
    expect(await audio.played(list)).toEqual([]);

    await rows.nth(1).getByRole('button', { name: /^Normal/ }).click();
    await rows.nth(1).getByRole('button', { name: /^Slow/ }).click();
    await rows.nth(2).getByRole('button', { name: /^Slow/ }).click();
    await rows.nth(0).getByRole('button', { name: /^Normal/ }).click();
    await rows.nth(1).getByRole('button', { name: /^Normal/ }).click();

    const played = await audio.played(list);
    expect(played.map(({ target, rendition }) => [target, rendition])).toEqual([
      ['点', 'normal'],
      ['点', 'slow'],
      ['分', 'slow'],
      ['找', 'normal'],
      ['点', 'normal'],
    ]);
  });

  test('every published list can be opened from the section, and an unknown list says so', async ({ page }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await openParentSection(page, 'List preview');
    for (const title of ['Fixture Three', 'Fixture Five', 'Fixture Twelve']) {
      await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
    }
    await page.getByRole('link', { name: /Fixture Five/ }).click();
    await expect(page.getByTestId('preview-item')).toHaveCount(5);

    await page.goto('./#/parent/list-preview/no-such-list'); // same page, still unlocked
    await expect(page.getByText("We couldn't find this list.")).toBeVisible();
    await expect(page.getByTestId('preview-item')).toHaveCount(0);
  });

  test('is reachable only through the parent gate', async ({ page, audio }) => {
    await setUpLearner(page);
    await page.goto('./#/parent/list-preview/fixture-three');
    await expect(page.getByTestId('gate-question')).toBeVisible();
    await expect(page.getByTestId('preview-item')).toHaveCount(0);
    await expect(page.getByText('找东西')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Normal/ })).toHaveCount(0);
    expect(await audio.played()).toEqual([]);

    await passGate(page);
    await expect(page.getByTestId('preview-item')).toHaveCount(3);
  });
});
