// Seam 2: the Azure provider, observed only through the content build. The provider is the one
// tts.config.ts selects; credentials, network and clock are injected at the build, so no real request is
// made and no test waits.
import { describe, expect, it } from 'vitest';
import { silentMp3 } from '../../content-build/tts/fake-provider.ts';
import { createWorkspace, lessonYaml, type Workspace } from './harness.ts';

const KEY = 'sk-test-0123456789abcdef-SECRET';
const ENV = { AZURE_SPEECH_KEY: KEY, AZURE_SPEECH_REGION: 'eastus' };

interface Call {
  url: string;
  init: RequestInit;
  at: number;
}

type Reply = () => Response | Promise<Response>;

/** Stubbed fetch, clock and sleep: no network, no real waiting. The last reply repeats. */
function network(replies: Reply[]) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const fetchStub = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, at: clock });
    return replies[Math.min(calls.length - 1, replies.length - 1)]!();
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

const ok: Reply = () => new Response(silentMp3().buffer as ArrayBuffer, { status: 200 });

const ONE_ITEM = lessonYaml('t', '\n  - target: 什\n    clue: 什么\n    pinyin: shén\n');

async function workspace(items = ONE_ITEM): Promise<Workspace> {
  return createWorkspace({ 'chinese/t.yaml': items });
}

/** Build with the configured provider (Azure) against the stubbed network; resolves to the build error, if any. */
async function azureBuild(
  ws: Workspace,
  replies: Reply[],
  env: Record<string, string> = ENV,
): Promise<{ error?: Error; log: string[]; calls: Call[]; sleeps: number[] }> {
  const net = network(replies);
  const log: string[] = [];
  const error = await ws
    .buildConfigured({ providerDeps: { env, ...net.deps }, log: (line) => log.push(line) })
    .then(
      () => undefined,
      (e: Error) => e,
    );
  return { ...(error && { error }), log, calls: net.calls, sleeps: net.sleeps };
}

describe('azure provider: request construction', () => {
  it('posts each rendition as UTF-8 SSML to the regional endpoint with the documented headers', async () => {
    const { calls, error } = await azureBuild(await workspace(), [ok]);
    expect(error).toBeUndefined();
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.url).toBe('https://eastus.tts.speech.microsoft.com/cognitiveservices/v1');
      expect(call.init.method).toBe('POST');
      expect(call.init.headers).toEqual({
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'my-practice-app-build',
      });
    }
  });

  it('is the configured provider by default: sends phoneme SSML for 什 at both rates and logs status without the key', async () => {
    const { calls, log } = await azureBuild(await workspace(), [ok]);
    expect(calls.map((c) => c.init.body)).toEqual([
      expect.stringContaining('<prosody rate="0%"><phoneme alphabet="sapi" ph="shen 2">什</phoneme>，什么的'),
      expect.stringContaining('<prosody rate="-30%"><phoneme alphabet="sapi" ph="shen 2">什</phoneme>，什么的'),
    ]);
    expect(log.filter((l) => l.includes('status=200'))).toEqual([
      expect.stringMatching(/t\/什 normal.*phoneme=yes.*status=200.*bytes=\d+/),
      expect.stringMatching(/t\/什 slow.*phoneme=yes.*status=200.*bytes=\d+/),
    ]);
    expect(log.join('\n')).not.toContain(KEY);
  });

  it('writes the audio it received to the audio store and the site output', async () => {
    const ws = await workspace();
    await azureBuild(ws, [ok]);
    expect(await ws.storedAudio()).toHaveLength(2);
    expect(await ws.outputAudio()).toHaveLength(2);
  });
});

describe('azure provider: credentials', () => {
  it.each([
    ['no key', { AZURE_SPEECH_REGION: 'eastus' }],
    ['no region', { AZURE_SPEECH_KEY: KEY }],
    ['empty values', { AZURE_SPEECH_KEY: '', AZURE_SPEECH_REGION: '' }],
    ['nothing', {}],
  ])('fails the build with %s before any request, naming the variables but no values', async (_name, env) => {
    const { error, calls } = await azureBuild(await workspace(), [ok], env);
    expect(calls).toEqual([]);
    expect(error?.message).toContain('AZURE_SPEECH_KEY');
    expect(error?.message).toContain('AZURE_SPEECH_REGION');
    expect(error?.message).not.toContain(KEY);
  });

  it('builds with a key and region, and rejects a region that is not a plain region name', async () => {
    expect((await azureBuild(await workspace(), [ok])).error).toBeUndefined();

    const bad = await azureBuild(await workspace(), [ok], { ...ENV, AZURE_SPEECH_REGION: 'evil.example.com/x' });
    expect(bad.calls).toEqual([]);
    expect(bad.error?.message).toContain('AZURE_SPEECH_REGION');
    expect(bad.error?.message).not.toContain('evil');
  });
});

describe('azure provider: free-tier throttle and retries', () => {
  it('spaces request starts at least 3.1 s apart (20 requests per 60 s)', async () => {
    const items = '\n  - target: 找\n    pinyin: zhǎo\n  - target: 点\n    pinyin: diǎn\n  - target: 分\n    pinyin: fēn\n';
    const { calls } = await azureBuild(await workspace(lessonYaml('t', items)), [ok]);
    expect(calls).toHaveLength(6);
    const gaps = calls.slice(1).map((c, i) => c.at - calls[i]!.at);
    expect(gaps.every((gap) => gap >= 3100)).toBe(true);
  });

  it('retries a 429 after the Retry-After delay, then succeeds', async () => {
    const ws = await workspace();
    const { calls, sleeps, error, log } = await azureBuild(ws, [
      () => new Response('slow down', { status: 429, headers: { 'Retry-After': '7' } }),
      ok,
    ]);
    expect(error).toBeUndefined();
    expect(calls).toHaveLength(3); // normal: 429 then ok; slow: ok
    expect(Math.max(...sleeps)).toBeGreaterThanOrEqual(7000);
    expect(log.some((line) => /t\/什 normal.*attempts=2/.test(line))).toBe(true);
    expect(await ws.outputAudio()).toHaveLength(2);
  });

  it('backs off exponentially on 429 without Retry-After and on 5xx, then gives up with a clear error', async () => {
    const { calls, sleeps, error } = await azureBuild(await workspace(), [() => new Response('busy', { status: 429 })]);
    expect(error?.message).toContain('429');
    expect(error?.message).toContain('retries exhausted');
    expect(error?.message).toContain('t/什 normal');
    expect(calls.length).toBeGreaterThanOrEqual(4);
    const waits = sleeps.filter((ms) => ms >= 5000);
    expect(waits.length).toBeGreaterThanOrEqual(3);
    expect(waits[1]!).toBeGreaterThan(waits[0]!);

    const server = await azureBuild(await workspace(), [() => new Response('oops', { status: 503 })]);
    expect(server.error?.message).toContain('503');
    expect(server.error?.message).toContain('retries exhausted');
  });

  it('does not retry a rejected request (400): reports status, label and a short body, never the key', async () => {
    const { calls, error } = await azureBuild(await workspace(), [
      () => new Response(`Invalid phoneme ${'x'.repeat(2000)}`, { status: 400 }),
    ]);
    expect(calls).toHaveLength(1);
    expect(error?.message).toContain('400');
    expect(error?.message).toContain('t/什 normal');
    expect(error!.message.length).toBeLessThan(600);
    expect(error?.message).not.toContain(KEY);
  });

  it('retries network failures and never lets the key reach the error message', async () => {
    const { error } = await azureBuild(await workspace(), [
      () => {
        throw new TypeError(`fetch failed for key ${KEY}`);
      },
    ]);
    expect(error?.message).toContain('network error');
    expect(error?.message).not.toContain(KEY);
    expect(String(error?.cause ?? '')).not.toContain(KEY);
  });

  it('refuses a response that is not MP3 audio instead of storing it', async () => {
    const ws = await workspace();
    const { error } = await azureBuild(ws, [() => new Response('<html>error page</html>'.repeat(50), { status: 200 })]);
    expect(error?.message).toMatch(/not MP3 audio/);
    expect(await ws.storedAudio()).toEqual([]);
  });

  it('never logs the key or any request header', async () => {
    const { log } = await azureBuild(await workspace(), [() => new Response('busy', { status: 429 }), ok]);
    expect(log.length).toBeGreaterThan(0);
    const everything = log.join('\n');
    expect(everything).not.toContain(KEY);
    expect(everything.toLowerCase()).not.toContain('ocp-apim');
  });
});
