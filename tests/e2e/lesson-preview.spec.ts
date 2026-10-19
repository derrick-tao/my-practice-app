// Seam 1: the parent's Lesson preview (ticket 12). Public surface only: the parent gate, the parent
// area's screens, and the audio requests the app makes (the stubbed play() in harness.ts).
import { expect, test } from './harness.ts';
import { openParentArea, openParentSection, passGate, setUpLearner } from './parent-driver.ts';

test.describe('lesson preview', () => {
  test('lessons every item of a lesson with target, pinyin and clue, in list order, under a header with the lesson facts', async ({
    page,
    loadLesson,
  }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await openParentSection(page, 'Lesson preview');
    await page.getByRole('link', { name: /Fixture Three/ }).click();

    await expect(page.getByRole('heading', { name: 'Fixture Three', level: 2 })).toBeVisible();
    const header = page.getByTestId('preview-header');
    await expect(header).toContainText('Simplified');
    await expect(header).toContainText('Test: 2026-11-02 to 2026-11-06');
    await expect(header).toContainText('3 characters');

    const lesson = await loadLesson('fixture-three');
    const rows = page.getByTestId('preview-item');
    await expect(rows).toHaveCount(lesson.lists.dictation!.length);
    for (const [index, item] of lesson.lists.dictation!.entries()) {
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

  test('shows generated pinyin, and an item without a clue just has none', async ({ page, loadLesson }) => {
    await setUpLearner(page);
    await page.goto('./#/parent/lesson-preview/fixture-twelve');
    await passGate(page);

    const header = page.getByTestId('preview-header');
    await expect(header).toContainText('12 characters');
    await expect(header).not.toContainText('Test:');

    const lesson = await loadLesson('fixture-twelve');
    const rows = page.getByTestId('preview-item');
    await expect(rows).toHaveCount(12);
    await expect(rows.nth(0)).toContainText('一');
    await expect(rows.nth(0)).toContainText(lesson.lists.dictation![0]!.pinyin);
    await expect(rows.nth(0)).toContainText('yī');
    await expect(rows.nth(11)).toContainText('小');
  });

  test('the normal and slow buttons request that item\'s own rendition of the audio, and nothing plays on its own', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await openParentSection(page, 'Lesson preview');
    await page.getByRole('link', { name: /Fixture Three/ }).click();
    const lesson = await loadLesson('fixture-three');
    const rows = page.getByTestId('preview-item');
    await expect(rows).toHaveCount(3);
    expect(await audio.played(lesson)).toEqual([]);

    await rows.nth(1).getByRole('button', { name: /^Normal/ }).click();
    await rows.nth(1).getByRole('button', { name: /^Slow/ }).click();
    await rows.nth(2).getByRole('button', { name: /^Slow/ }).click();
    await rows.nth(0).getByRole('button', { name: /^Normal/ }).click();
    await rows.nth(1).getByRole('button', { name: /^Normal/ }).click();

    const played = await audio.played(lesson);
    expect(played.map(({ target, rendition }) => [target, rendition])).toEqual([
      ['点', 'normal'],
      ['点', 'slow'],
      ['分', 'slow'],
      ['找', 'normal'],
      ['点', 'normal'],
    ]);
  });

  test('every published lesson can be opened from the section, and an unknown lesson says so', async ({ page }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await openParentSection(page, 'Lesson preview');
    for (const title of ['Fixture Three', 'Fixture Five', 'Fixture Twelve']) {
      await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
    }
    await page.getByRole('link', { name: /Fixture Five/ }).click();
    await expect(page.getByTestId('preview-item')).toHaveCount(5);

    await page.goto('./#/parent/lesson-preview/no-such-list'); // same page, still unlocked
    await expect(page.getByText("We couldn't find this lesson.")).toBeVisible();
    await expect(page.getByTestId('preview-item')).toHaveCount(0);
  });

  test('is reachable only through the parent gate', async ({ page, audio }) => {
    await setUpLearner(page);
    await page.goto('./#/parent/lesson-preview/fixture-three');
    await expect(page.getByTestId('gate-question')).toBeVisible();
    await expect(page.getByTestId('preview-item')).toHaveCount(0);
    await expect(page.getByText('找东西')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Normal/ })).toHaveCount(0);
    expect(await audio.played()).toEqual([]);

    await passGate(page);
    await expect(page.getByTestId('preview-item')).toHaveCount(3);
  });
});
