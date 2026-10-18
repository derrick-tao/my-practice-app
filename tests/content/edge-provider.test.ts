// Seam 2: the edge (fallback) provider, observed only through the content build. tts.config.ts selects
// the provider; the msedge-tts websocket call and the clock are injected at the build.
import { describe, expect, it } from 'vitest';
import { ttsConfig } from '../../tts.config.ts';
import { silentMp3 } from '../../content-build/tts/fake-provider.ts';
import type { ProviderDeps } from '../../content-build/tts/provider-factory.ts';
import { createWorkspace, listYaml, type Workspace } from './harness.ts';

const edgeConfig = { ...ttsConfig, provider: 'edge' as const };

type Transport = NonNullable<ProviderDeps['edgeTransport']>;
type EdgeCall = Parameters<Transport>[0];

function edge(transport?: Transport) {
  const calls: EdgeCall[] = [];
  const sleeps: number[] = [];
  const providerDeps: ProviderDeps = {
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
  };
  return { providerDeps, calls, sleeps };
}

const ONE_ITEM = listYaml('t', '\n  - target: 点\n    clue: 几点\n    pinyin: diǎn\n');

const workspace = (items = ONE_ITEM): Promise<Workspace> => createWorkspace({ 'chinese/t.yaml': items });

const buildError = (ws: Workspace, options: Parameters<Workspace['buildConfigured']>[0]): Promise<Error> =>
  ws.buildConfigured(options).then(
    () => {
      throw new Error('expected the build to fail, but it succeeded');
    },
    (e: Error) => e,
  );

describe('edge provider (fallback behind the config flag)', () => {
  it('needs no Azure key: builds a whole list with plain text, no phoneme tags, and the configured voice and format', async () => {
    const { providerDeps, calls } = edge();
    const ws = await workspace(
      listYaml(
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
    );
    await ws.buildConfigured({ tts: edgeConfig, providerDeps });

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
    const { providerDeps, calls } = edge();
    const ws = await workspace(listYaml('t', '\n  - target: 点\n    pinyin: diǎn\n    say: "a < b & c"\n'));
    await ws.buildConfigured({ tts: edgeConfig, providerDeps });
    expect(calls[0]!.text).toBe('a &lt; b &amp; c');
  });

  it('names its audio differently from the same content made by another provider', async () => {
    const a = await workspace();
    const b = await workspace();
    await a.buildConfigured({ tts: edgeConfig, providerDeps: edge().providerDeps });
    await b.build(); // the fake provider fills its store under its own file names
    const [aNames, bNames] = [await a.storedAudio(), await b.storedAudio()];
    expect(aNames).toHaveLength(2);
    expect(aNames.filter((name) => bNames.includes(name))).toEqual([]);
  });

  it('retries a failed synthesis a few times, then fails the build with a clear message', async () => {
    let attempts = 0;
    const { providerDeps, sleeps } = edge(async () => {
      attempts++;
      throw new Error('Stream closed before the synthesis completed');
    });
    const error = await buildError(await workspace(), { tts: edgeConfig, providerDeps });
    expect(error.message).toMatch(/edge tts.*t\/点 normal.*3 attempts/i);
    expect(attempts).toBe(3);
    expect(sleeps.length).toBe(2);
  });

  it('succeeds when a later attempt works', async () => {
    let attempts = 0;
    const { providerDeps } = edge(async () => {
      attempts++;
      if (attempts < 2) throw new Error('No audio was received');
      return silentMp3();
    });
    const ws = await workspace();
    await ws.buildConfigured({ tts: edgeConfig, providerDeps });
    expect(await ws.outputAudio()).toHaveLength(2);
  });

  it('refuses output that is not MP3 audio, and formats the service cannot produce', async () => {
    const tiny = edge(async () => new Uint8Array(10));
    const notMp3 = await buildError(await workspace(), { tts: edgeConfig, providerDeps: tiny.providerDeps });
    expect(notMp3.message).toMatch(/not MP3 audio/);

    const pcm = await buildError(await workspace(), {
      tts: { ...edgeConfig, format: 'riff-24khz-16bit-mono-pcm' },
      providerDeps: edge().providerDeps,
    });
    expect(pcm.message).toMatch(/edge tts supports only/i);
  });
});
