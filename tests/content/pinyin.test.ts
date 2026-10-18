import { describe, expect, it } from 'vitest';
import { createWorkspace, listYaml } from './harness.ts';

describe('content build: pinyin', () => {
  it('fills in omitted pinyin and stores it explicitly in the build output', async () => {
    const ws = await createWorkspace({
      'chinese/auto.yaml': listYaml(
        'auto',
        `
  - target: 找
    clue: 找东西
  - target: 作业
    clue: 作业本
  - target: 么
    clue: 什么
`,
      ),
    });
    await ws.build();
    const list = await ws.list('auto');
    expect(list.items.map((item) => item.pinyin)).toEqual(['zhǎo', 'zuò yè', 'me']);
  });

  it('reads an omitted pinyin in the context of the clue, so a polyphone gets the reading the clue uses', async () => {
    const ws = await createWorkspace({
      'chinese/poly.yaml': listYaml(
        'poly',
        `
  - target: 长
    clue: 校长
  - target: 行
    clue: 银行
  - target: 只
    clue: 一只鸟
  - target: 点
    clue: 几点
`,
      ),
    });
    await ws.build();
    const list = await ws.list('poly');
    // Read alone, 长 is "cháng" and 行 is "xíng": only their clues make them "zhǎng" and "háng".
    expect(list.items.map((item) => item.pinyin)).toEqual(['zhǎng', 'háng', 'zhī', 'diǎn']);
  });

  it('reads the target alone when there is no clue, and uses the same reading in the audio markup', async () => {
    const ws = await createWorkspace({
      'chinese/with-clue.yaml': listYaml('with-clue', '\n  - target: 长\n    clue: 校长\n'),
      'chinese/no-clue.yaml': listYaml('no-clue', '\n  - target: 长\n'),
    });
    await ws.build();
    expect((await ws.list('with-clue')).items[0]!.pinyin).toBe('zhǎng');
    expect((await ws.list('no-clue')).items[0]!.pinyin).toBe('cháng');
    expect(ws.provider.requests.map((r) => r.ssml.match(/ph="([^"]+)"/)?.[1])).toEqual([
      'chang 2', 'chang 2', 'zhang 3', 'zhang 3',
    ]);
  });

  it('keeps provided pinyin even when the library would choose differently', async () => {
    const ws = await createWorkspace({
      'chinese/kept.yaml': listYaml(
        'kept',
        `
  - target: 分
    clue: 一分钟
    pinyin: fèn
`,
      ),
    });
    await ws.build();
    const list = await ws.list('kept');
    expect(list.items[0]!.pinyin).toBe('fèn');
  });
});
