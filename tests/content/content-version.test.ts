import { describe, expect, it } from 'vitest';
import { createWorkspace, listYaml } from './harness.ts';

const ITEMS = `
  - target: 找
    clue: 找东西
    pinyin: zhǎo
  - target: 点
    clue: 几点
    pinyin: diǎn
`;

describe('content build: content version', () => {
  it('is identical for identical content, across separate builds', async () => {
    const files = { 'chinese/a.yaml': listYaml('a', ITEMS) };
    const first = await (await createWorkspace(files)).build();
    const second = await (await createWorkspace(files)).build();
    expect(second.contentVersion).toBe(first.contentVersion);
  });

  it('does not change when only YAML formatting changes', async () => {
    const ws = await createWorkspace({ 'chinese/a.yaml': listYaml('a', ITEMS) });
    const before = await ws.build();

    await ws.writeLists({
      'chinese/a.yaml': `# a comment the build must ignore
items:
  - { clue: 找东西, target: 找, pinyin: zhǎo }
  - pinyin: diǎn
    clue: "几点"
    target: "点"
script: simplified
practiceTypes:
  - dictation
subject: chinese
title: Test List
id: a
`,
    });
    const after = await ws.build();
    expect(after.contentVersion).toBe(before.contentVersion);
  });

  it.each([
    ['a clue changes', ITEMS.replace('几点', '几点钟')],
    ['an item is added', `${ITEMS}  - target: 分\n    clue: 一分钟\n    pinyin: fēn\n`],
    ['pinyin changes', ITEMS.replace('diǎn', 'dian')],
  ])('changes when %s', async (_name, changedItems) => {
    const ws = await createWorkspace({ 'chinese/a.yaml': listYaml('a', ITEMS) });
    const before = await ws.build();
    await ws.writeLists({ 'chinese/a.yaml': listYaml('a', changedItems) });
    const after = await ws.build();
    expect(after.contentVersion).not.toBe(before.contentVersion);
  });

  it('changes when a list title or test dates change', async () => {
    const ws = await createWorkspace({ 'chinese/a.yaml': listYaml('a', ITEMS, { title: 'One' }) });
    const before = await ws.build();
    await ws.writeLists({
      'chinese/a.yaml': listYaml('a', ITEMS, { title: 'One', testDates: '2026-11-02' }),
    });
    const withDates = await ws.build();
    await ws.writeLists({ 'chinese/a.yaml': listYaml('a', ITEMS, { title: 'Two' }) });
    const retitled = await ws.build();
    expect(new Set([before.contentVersion, withDates.contentVersion, retitled.contentVersion]).size).toBe(3);
  });
});
