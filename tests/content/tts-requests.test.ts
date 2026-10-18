import { describe, expect, it } from 'vitest';
import { createWorkspace, listYaml } from './harness.ts';

async function requestsFor(items: string) {
  const ws = await createWorkspace({ 'chinese/t.yaml': listYaml('t', items) });
  await ws.build();
  return ws.provider.requests;
}

describe('content build: TTS provider seam (fake provider)', () => {
  it('speaks "target，clue的target" when the item has a clue', async () => {
    const requests = await requestsFor(`
  - target: 找
    clue: 找东西
    pinyin: zhǎo
`);
    expect(requests.map((r) => r.text)).toEqual(['找，找东西的找', '找，找东西的找']);
  });

  it('speaks only the target when there is no clue', async () => {
    const requests = await requestsFor(`
  - target: 找
    pinyin: zhǎo
`);
    expect(requests.map((r) => r.text)).toEqual(['找', '找']);
  });

  it('speaks the say override verbatim when present', async () => {
    const requests = await requestsFor(`
  - target: 分
    clue: 一分钟
    pinyin: fēn
    say: 分数的分
`);
    expect(requests.map((r) => r.text)).toEqual(['分数的分', '分数的分']);
  });

  it('requests a normal and a slow rendition at the configured rates', async () => {
    const requests = await requestsFor(`
  - target: 点
    clue: 几点
    pinyin: diǎn
`);
    expect(requests.map((r) => r.rate)).toEqual(['0%', '-30%']);
    expect(requests.map((r) => r.voice)).toEqual(['zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoxiaoNeural']);
    expect(requests[0]!.ssml).toContain('rate="0%"');
    expect(requests[1]!.ssml).toContain('rate="-30%"');
    expect(requests[1]!.text).toBe('点，几点的点');
  });

  it('escapes XML-significant characters in the SSML', async () => {
    const requests = await requestsFor(`
  - target: 点
    say: "a < b & c"
    pinyin: diǎn
`);
    expect(requests[0]!.ssml).toContain('a &lt; b &amp; c');
  });

  it('does not ask the provider again for audio that is already in the audio store', async () => {
    const ws = await createWorkspace({
      'chinese/t.yaml': listYaml('t', '\n  - target: 找\n    clue: 找东西\n    pinyin: zhǎo\n'),
    });
    await ws.build();
    expect(ws.provider.requests).toHaveLength(2);
    await ws.build();
    expect(ws.provider.requests).toHaveLength(2);
  });
});
