import { expect, test } from './harness.ts';

test.describe('published content as the app sees it', () => {
  test('serves the manifest and per-list data with normal and slow audio that resolve', async ({
    page,
    loadLesson,
  }) => {
    const manifest = await (await page.request.get('content/manifest.json')).json();
    expect(manifest.contentVersion).toMatch(/^[0-9a-f]{12}$/);
    const ids = manifest.subjects[0].lessons.map((l: { id: string }) => l.id);
    expect(ids).toEqual(['fixture-five', 'fixture-strokes', 'fixture-three', 'fixture-twelve']);

    const lesson = await loadLesson('fixture-three');
    expect(lesson.lists.dictation!.map((i) => i.pinyin)).toEqual(['zhǎo', 'diǎn', 'fēn']);
    for (const item of lesson.lists.dictation!) {
      for (const ref of [item.audio.normal, item.audio.slow]) {
        const response = await page.request.get(`content/${ref}`);
        expect(response.status(), ref).toBe(200);
        expect((await response.body()).length, ref).toBeGreaterThan(0);
      }
    }
  });

  test('serves each stroke-order item its stroke data, and only those items', async ({ page, loadLesson }) => {
    const lesson = await loadLesson('fixture-strokes');
    for (const item of lesson.lists['stroke-order']!) {
      const response = await page.request.get(`content/${item.strokes}`);
      expect(response.status(), item.strokes).toBe(200);
      expect(((await response.json()) as { strokes: string[] }).strokes.length, item.target).toBeGreaterThan(0);
    }
    expect(lesson.lists.dictation!.every((item) => item.strokes === undefined)).toBe(true);
  });

  test('auto-fills pinyin that the author omitted', async ({ loadLesson }) => {
    const lesson = await loadLesson('fixture-five');
    expect(lesson.lists.dictation!.map((i) => i.pinyin)).toEqual(['māo', 'gǒu', 'niǎo', 'nián', 'zhī']);
  });
});

test.describe('audio stub (harness contract for later tickets)', () => {
  test('records play() requests and resolves them to item and rendition', async ({ page, audio, loadLesson }) => {
    await page.goto('./');
    const lesson = await loadLesson('fixture-three');
    expect(await audio.played(lesson)).toEqual([]);

    await page.evaluate(async ([normal, slow]) => {
      const base = new URL('content/', document.baseURI).href;
      await new Audio(base + normal).play();
      await new Audio(base + slow).play();
    }, [lesson.lists.dictation![1]!.audio.normal, lesson.lists.dictation![1]!.audio.slow] as const);

    const played = await audio.played(lesson);
    expect(played.map((p) => [p.target, p.rendition])).toEqual([
      ['点', 'normal'],
      ['点', 'slow'],
    ]);

    await audio.clear();
    expect(await audio.played(lesson)).toEqual([]);
  });
});
