import { expect, test } from './harness.ts';

test.describe('published content as the app sees it', () => {
  test('serves the manifest and per-list data with normal and slow audio that resolve', async ({
    page,
    loadList,
  }) => {
    const manifest = await (await page.request.get('content/manifest.json')).json();
    expect(manifest.contentVersion).toMatch(/^[0-9a-f]{12}$/);
    const ids = manifest.subjects[0].practiceTypes[0].lists.map((l: { id: string }) => l.id);
    expect(ids).toEqual(['fixture-five', 'fixture-three']);

    const list = await loadList('fixture-three');
    expect(list.items.map((i) => i.pinyin)).toEqual(['zhǎo', 'diǎn', 'fēn']);
    for (const item of list.items) {
      for (const ref of [item.audio.normal, item.audio.slow]) {
        const response = await page.request.get(`content/${ref}`);
        expect(response.status(), ref).toBe(200);
        expect((await response.body()).length, ref).toBeGreaterThan(0);
      }
    }
  });

  test('auto-fills pinyin that the author omitted', async ({ loadList }) => {
    const list = await loadList('fixture-five');
    expect(list.items.map((i) => i.pinyin)).toEqual(['māo', 'gǒu', 'niǎo', 'nián', 'zhī']);
  });
});

test.describe('audio stub (harness contract for later tickets)', () => {
  test('records play() requests and resolves them to item and rendition', async ({ page, audio, loadList }) => {
    await page.goto('./');
    const list = await loadList('fixture-three');
    expect(await audio.played(list)).toEqual([]);

    await page.evaluate(async ([normal, slow]) => {
      const base = new URL('content/', document.baseURI).href;
      await new Audio(base + normal).play();
      await new Audio(base + slow).play();
    }, [list.items[1]!.audio.normal, list.items[1]!.audio.slow] as const);

    const played = await audio.played(list);
    expect(played.map((p) => [p.target, p.rendition])).toEqual([
      ['点', 'normal'],
      ['点', 'slow'],
    ]);

    await audio.clear();
    expect(await audio.played(list)).toEqual([]);
  });
});
