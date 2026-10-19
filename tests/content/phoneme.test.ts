import { describe, expect, it } from 'vitest';
import { createWorkspace, lessonYaml } from './harness.ts';

async function requestsFor(items: string) {
  const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', items) });
  await ws.build();
  return ws.provider.requests;
}

const PH = (ph: string, text: string) => `<phoneme alphabet="sapi" ph="${ph}">${text}</phoneme>`;

// Seam 2 scenario 4: polyphone phoneme markup for standalone targets.
describe('content build: polyphone phoneme markup', () => {
  it('wraps only the standalone targets, not the target inside the clue', async () => {
    const requests = await requestsFor(`
  - target: 什
    clue: 什么
    pinyin: shén
`);
    for (const request of requests) {
      expect(request.ssml).toContain(`${PH('shen 2', '什')}，什么的${PH('shen 2', '什')}`);
      expect(request.ssml.match(/<phoneme/g)).toHaveLength(2);
      expect(request.text).toBe('什，什么的什');
    }
  });

  it('wraps the lone target when there is no clue', async () => {
    const requests = await requestsFor(`
  - target: 只
    pinyin: zhī
`);
    expect(requests[0]!.ssml).toContain(`<prosody rate="0%">${PH('zhi 1', '只')}</prosody>`);
  });

  it('writes the neutral tone as 5 and ü as v', async () => {
    const requests = await requestsFor(`
  - target: 么
    pinyin: me
  - target: 女
    pinyin: nǚ
`);
    const phs = requests.map((r) => /ph="([^"]*)"/.exec(r.ssml)![1]);
    expect(phs).toEqual(['me 5', 'me 5', 'nv 3', 'nv 3']);
  });

  it('uses generated pinyin when the item has none', async () => {
    const requests = await requestsFor(`
  - target: 分
`);
    expect(requests[0]!.ssml).toContain(PH('fen 1', '分'));
  });

  it('adds no phoneme markup to a say override, which is spoken exactly as written', async () => {
    const requests = await requestsFor(`
  - target: 分
    pinyin: fēn
    say: 分数的分
`);
    expect(requests[0]!.ssml).not.toContain('<phoneme');
    expect(requests[0]!.ssml).toContain('分数的分');
  });

  it('adds no phoneme markup to a multi-character target, in a clue prompt or alone', async () => {
    const requests = await requestsFor(`
  - target: 鞋子
    pinyin: xié zi
  - target: 作业
    clue: 作业本
    pinyin: zuò yè
`);
    expect(requests).toHaveLength(4);
    for (const request of requests) expect(request.ssml).not.toContain('<phoneme');
    expect(requests.map((r) => r.text)).toEqual(['鞋子', '鞋子', '作业，作业本的作业', '作业，作业本的作业']);
    expect(requests[0]!.ssml).toContain('<prosody rate="0%">鞋子</prosody>');
    expect(requests[2]!.ssml).toContain('<prosody rate="0%">作业，作业本的作业</prosody>');
  });

  it('keeps the phoneme tag on a single-character target in the same build', async () => {
    const requests = await requestsFor(`
  - target: 鞋子
  - target: 猫
`);
    const [multi, single] = [requests[0]!, requests[2]!];
    expect(multi.ssml).not.toContain('<phoneme');
    expect(single.ssml).toContain(PH('mao 1', '猫'));
  });
});
