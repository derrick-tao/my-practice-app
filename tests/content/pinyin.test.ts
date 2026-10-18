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
