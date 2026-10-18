import { describe, expect, it } from 'vitest';
import { ttsConfig } from '../../tts.config.ts';
import { silentMp3 } from '../../content-build/tts/fake-provider.ts';
import { createProvider, type ProviderDeps } from '../../content-build/tts/provider-factory.ts';
import { createWorkspace, listYaml } from './harness.ts';

const edgeConfig = { ...ttsConfig, provider: 'edge' as const };

interface EdgeCall {
  text: string;
  voice: string;
  rate?: string;
  format: string;
}

function edge(transport?: NonNullable<ProviderDeps['edgeTransport']>) {
  const calls: EdgeCall[] = [];
  const sleeps: number[] = [];
  const provider = createProvider(edgeConfig, {
    env: {}, // no Azure key anywhere
    edgeTransport:
      transport ??
      (async (call) => {
        calls.push(call);
        return silentMp3();
      }),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { provider, calls, sleeps };
}

describe('edge provider (fallback behind the config flag)', () => {
  it('needs no Azure key and cannot carry phoneme markup', () => {
    const { provider } = edge();
    expect(provider.id).toBe('edge');
    expect(provider.extension).toBe('mp3');
    expect(provider.supportsPhonemes).toBe(false);
    expect(provider.unavailableReason?.()).toBeUndefined();
  });

  it('builds a whole list without any credentials, sending plain text with no phoneme tags', async () => {
    const { provider, calls } = edge();
    const ws = await createWorkspace({
      'chinese/t.yaml': listYaml(
        't',
        `
  - target: 什
    clue: 什么
    pinyin: shén
  - target: 分
    clue: 一分钟
    pinyin: fēn
    say: 分数的分
`,
      ),
    });
    await ws.build({ provider, tts: edgeConfig });

    expect(calls.map((c) => [c.text, c.rate])).toEqual([
      ['什，什么的什', undefined],
      ['什，什么的什', '-30%'],
      ['分数的分', undefined],
      ['分数的分', '-30%'],
    ]);
    expect(calls.every((c) => c.voice === 'zh-CN-XiaoxiaoNeural')).toBe(true);
    expect(calls.every((c) => c.format === 'audio-24khz-48kbitrate-mono-mp3')).toBe(true);
    expect(calls.every((c) => !c.text.includes('<'))).toBe(true);
    expect(await ws.outputAudio()).toHaveLength(4);
  });

  it('escapes XML-significant characters, because the service wraps the text in its own SSML', async () => {
    const { provider, calls } = edge();
    const ws = await createWorkspace({
      'chinese/t.yaml': listYaml('t', '\n  - target: 点\n    pinyin: diǎn\n    say: "a < b & c"\n'),
    });
    await ws.build({ provider, tts: edgeConfig });
    expect(calls[0]!.text).toBe('a &lt; b &amp; c');
  });

  it('names its audio differently from Azure audio for the same content', async () => {
    const items = '\n  - target: 点\n    clue: 几点\n    pinyin: diǎn\n';
    const a = await createWorkspace({ 'chinese/t.yaml': listYaml('t', items) });
    const b = await createWorkspace({ 'chinese/t.yaml': listYaml('t', items) });
    await a.build({ provider: edge().provider, tts: edgeConfig });
    await b.build();
    const [aNames, bNames] = [await a.storedAudio(), await b.storedAudio()];
    expect(aNames.filter((name) => bNames.includes(name))).toEqual([]);
  });

  it('retries a failed synthesis a few times, then fails with a clear message', async () => {
    let attempts = 0;
    const { provider, sleeps } = edge(async () => {
      attempts++;
      throw new Error('Stream closed before the synthesis completed');
    });
    const request = { text: '点', ssml: '', voice: 'v', rate: '0%', format: ttsConfig.format, label: 'l/点 normal' };
    await expect(provider.synthesize(request)).rejects.toThrow(/edge tts.*l\/点 normal.*3 attempts/i);
    expect(attempts).toBe(3);
    expect(sleeps.length).toBe(2);
  });

  it('succeeds when a later attempt works', async () => {
    let attempts = 0;
    const { provider } = edge(async () => {
      attempts++;
      if (attempts < 2) throw new Error('No audio was received');
      return silentMp3();
    });
    const request = { text: '点', ssml: '', voice: 'v', rate: '0%', format: ttsConfig.format, label: 'l' };
    expect((await provider.synthesize(request)).length).toBeGreaterThan(0);
  });

  it('refuses output that is not MP3 audio, and formats the service cannot produce', async () => {
    const tiny = edge(async () => new Uint8Array(10));
    const request = { text: '点', ssml: '', voice: 'v', rate: '0%', format: ttsConfig.format, label: 'l' };
    await expect(tiny.provider.synthesize(request)).rejects.toThrow(/not MP3 audio/);

    const { provider } = edge();
    await expect(provider.synthesize({ ...request, format: 'riff-24khz-16bit-mono-pcm' })).rejects.toThrow(
      /edge tts supports only/i,
    );
  });
});
