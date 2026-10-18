import { describe, expect, it } from 'vitest';
import { ttsConfig } from '../../tts.config.ts';
import { silentMp3 } from '../../content-build/tts/fake-provider.ts';
import { createProvider } from '../../content-build/tts/provider-factory.ts';
import type { TtsRequest } from '../../content-build/tts/types.ts';
import { createWorkspace, listYaml } from './harness.ts';

const KEY = 'sk-test-0123456789abcdef-SECRET';
const ENV = { AZURE_SPEECH_KEY: KEY, AZURE_SPEECH_REGION: 'eastus' };

interface Call {
  url: string;
  init: RequestInit;
  at: number;
}

/** Stubbed fetch, clock and sleep: no network, no real waiting. */
function stub(responses: Array<() => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const fetchStub = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, at: clock });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    return next();
  }) as typeof fetch;
  return {
    calls,
    sleeps,
    deps: {
      fetch: fetchStub,
      now: () => clock,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
    },
  };
}

const ok = () => new Response(silentMp3().buffer as ArrayBuffer, { status: 200 });

const REQUEST: TtsRequest = {
  text: '什，什么的什',
  ssml: '<speak>什</speak>',
  voice: 'zh-CN-XiaoxiaoNeural',
  rate: '-30%',
  format: 'audio-24khz-48kbitrate-mono-mp3',
  label: 'list/什 slow',
};

function azure(responses: Array<() => Response | Promise<Response>>, log: string[] = []) {
  const s = stub(responses);
  const provider = createProvider(ttsConfig, { env: ENV, log: (line) => log.push(line), ...s.deps });
  return { provider, ...s, log };
}

describe('azure provider: request construction', () => {
  it('posts the SSML as UTF-8 to the regional endpoint with the documented headers', async () => {
    const { provider, calls } = azure([ok]);
    await provider.synthesize(REQUEST);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://eastus.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.body).toBe(REQUEST.ssml);
    expect(calls[0]!.init.headers).toEqual({
      'Ocp-Apim-Subscription-Key': KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'my-practice-app-build',
    });
  });

  it('is the configured provider by default and honours phoneme markup', () => {
    const provider = createProvider(ttsConfig, { env: ENV });
    expect(provider.id).toBe('azure');
    expect(provider.extension).toBe('mp3');
    expect(provider.supportsPhonemes).toBe(true);
  });

  it('through the content build, sends the phoneme SSML for 什 at both rates and logs status without the key', async () => {
    const log: string[] = [];
    const { provider, calls } = azure([ok], log);
    const ws = await createWorkspace({
      'chinese/t.yaml': listYaml('t', '\n  - target: 什\n    clue: 什么\n    pinyin: shén\n'),
    });
    await ws.build({ provider, log: (line) => log.push(line) });
    expect(calls.map((c) => c.init.body)).toEqual([
      expect.stringContaining('<prosody rate="0%"><phoneme alphabet="sapi" ph="shen 2">什</phoneme>，什么的'),
      expect.stringContaining('<prosody rate="-30%"><phoneme alphabet="sapi" ph="shen 2">什</phoneme>，什么的'),
    ]);
    expect(log.filter((l) => l.includes('status=200'))).toEqual([
      expect.stringMatching(/t\/什 normal.*phoneme=yes.*status=200.*bytes=\d+/),
      expect.stringMatching(/t\/什 slow.*phoneme=yes.*status=200.*bytes=\d+/),
    ]);
  });
});

describe('azure provider: credentials', () => {
  it.each([
    ['no key', { AZURE_SPEECH_REGION: 'eastus' }],
    ['no region', { AZURE_SPEECH_KEY: KEY }],
    ['empty values', { AZURE_SPEECH_KEY: '', AZURE_SPEECH_REGION: '' }],
    ['nothing', {}],
  ])('reports itself unavailable with %s, naming the variables but no values', (_name, env) => {
    const provider = createProvider(ttsConfig, { env });
    const reason = provider.unavailableReason?.();
    expect(reason).toContain('AZURE_SPEECH_KEY');
    expect(reason).toContain('AZURE_SPEECH_REGION');
    expect(reason).not.toContain(KEY);
  });

  it('is available with a key and region, and rejects a region that is not a plain region name', () => {
    expect(createProvider(ttsConfig, { env: ENV }).unavailableReason?.()).toBeUndefined();
    const bad = createProvider(ttsConfig, { env: { ...ENV, AZURE_SPEECH_REGION: 'evil.example.com/x' } });
    expect(bad.unavailableReason?.()).toContain('AZURE_SPEECH_REGION');
    expect(bad.unavailableReason?.()).not.toContain('evil');
  });
});

describe('azure provider: free-tier throttle and retries', () => {
  it('spaces request starts at least 3.1 s apart (20 requests per 60 s)', async () => {
    const { provider, calls } = azure([ok]);
    for (let i = 0; i < 5; i++) await provider.synthesize(REQUEST);
    const gaps = calls.slice(1).map((c, i) => c.at - calls[i]!.at);
    expect(gaps.every((gap) => gap >= 3100)).toBe(true);
    expect(calls).toHaveLength(5);
  });

  it('retries a 429 after the Retry-After delay, then succeeds', async () => {
    const { provider, calls, sleeps } = azure([
      () => new Response('slow down', { status: 429, headers: { 'Retry-After': '7' } }),
      ok,
    ]);
    const bytes = await provider.synthesize(REQUEST);
    expect(bytes.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(2);
    expect(Math.max(...sleeps)).toBeGreaterThanOrEqual(7000);
  });

  it('backs off exponentially on 429 without Retry-After and on 5xx, then gives up with a clear error', async () => {
    const { provider, calls, sleeps } = azure([() => new Response('busy', { status: 429 })]);
    const error = await provider.synthesize(REQUEST).then(
      () => undefined,
      (e: Error) => e,
    );
    expect(error?.message).toContain('429');
    expect(error?.message).toContain('retries exhausted');
    expect(calls.length).toBeGreaterThanOrEqual(4);
    const waits = sleeps.filter((ms) => ms >= 5000);
    expect(waits.length).toBeGreaterThanOrEqual(3);
    expect(waits[1]!).toBeGreaterThan(waits[0]!);
  });

  it('does not retry a rejected request (400): reports status, label and a short body, never the key', async () => {
    const { provider, calls } = azure([
      () => new Response(`Invalid phoneme ${'x'.repeat(2000)}`, { status: 400 }),
    ]);
    const error = await provider.synthesize(REQUEST).then(
      () => undefined,
      (e: Error) => e,
    );
    expect(calls).toHaveLength(1);
    expect(error?.message).toContain('400');
    expect(error?.message).toContain('list/什 slow');
    expect(error!.message.length).toBeLessThan(600);
    expect(error?.message).not.toContain(KEY);
  });

  it('retries network failures and never lets the key reach the error message', async () => {
    const { provider } = azure([
      () => {
        throw new TypeError(`fetch failed for key ${KEY}`);
      },
    ]);
    const error = await provider.synthesize(REQUEST).then(
      () => undefined,
      (e: Error) => e,
    );
    expect(error?.message).toContain('network error');
    expect(error?.message).not.toContain(KEY);
    expect(String(error?.cause ?? '')).not.toContain(KEY);
  });

  it('refuses a response that is not MP3 audio instead of storing it', async () => {
    const { provider } = azure([() => new Response('<html>error page</html>'.repeat(50), { status: 200 })]);
    await expect(provider.synthesize(REQUEST)).rejects.toThrow(/not MP3 audio/);
  });

  it('never logs the key or any request header', async () => {
    const log: string[] = [];
    const { provider } = azure([() => new Response('busy', { status: 429 }), ok], log);
    await provider.synthesize(REQUEST);
    const everything = log.join('\n');
    expect(everything).not.toContain(KEY);
    expect(everything.toLowerCase()).not.toContain('ocp-apim');
  });
});
