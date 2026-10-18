// Azure Neural TTS over REST (no SDK).
// Secrets: the key is only ever put in the request header. It is never logged, never part of an error
// message, and error messages are built from the status and a short response body only.
import { looksLikeMp3 } from './mp3.ts';
import type { TtsProvider, TtsRequest } from './types.ts';

export interface AzureProviderOptions {
  /** Environment to read AZURE_SPEECH_KEY / AZURE_SPEECH_REGION from. */
  env: Record<string, string | undefined>;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Receives one line per finished request (label, status, size). Never headers, never the key. */
  log?: (line: string) => void;
  /** Minimum time between request starts. The free tier allows 20 per 60 s, so 3.1 s keeps a margin. */
  minGapMs?: number;
  maxAttempts?: number;
  /** First retry delay when the service gives none; doubles per attempt. */
  backoffBaseMs?: number;
  timeoutMs?: number;
}

const REGION = /^[a-z0-9]+$/;
const MAX_WAIT_MS = 120_000;

export function createAzureProvider(options: AzureProviderOptions): TtsProvider {
  const key = options.env.AZURE_SPEECH_KEY ?? '';
  const region = options.env.AZURE_SPEECH_REGION ?? '';
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => {});
  const minGapMs = options.minGapMs ?? 3_100;
  const maxAttempts = options.maxAttempts ?? 6;
  const backoffBaseMs = options.backoffBaseMs ?? 5_000;
  const timeoutMs = options.timeoutMs ?? 30_000;
  let lastStart = Number.NEGATIVE_INFINITY;

  const unavailableReason = (): string | undefined => {
    if (!key || !region) return 'AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must both be set';
    if (!REGION.test(region)) {
      return 'AZURE_SPEECH_REGION must be a plain region name such as "eastus" (lowercase letters and digits)';
    }
    return undefined;
  };

  return {
    id: 'azure',
    extension: 'mp3',
    supportsPhonemes: true,
    unavailableReason,

    async synthesize(request: TtsRequest): Promise<Uint8Array> {
      const problem = unavailableReason();
      if (problem) throw new Error(`Azure TTS unavailable: ${problem}`);
      if (!request.format.endsWith('mp3')) {
        throw new Error(`Azure TTS: only MP3 output formats are supported, got "${request.format}"`);
      }
      const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
      const phoneme = request.ssml.includes('<phoneme') ? 'yes' : 'no';
      let lastStatus = 'none';

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const wait = lastStart + minGapMs - now();
        if (wait > 0) await sleep(wait);
        lastStart = now();

        let response: Response;
        try {
          response = await doFetch(url, {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': key,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': request.format,
              'User-Agent': 'my-practice-app-build',
            },
            body: request.ssml,
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (error) {
          // Only the error class: the message or cause could echo request details.
          lastStatus = 'network error';
          const kind = error instanceof Error ? error.name : 'unknown';
          log(`azure tts retry: ${request.label} network error (${kind}) attempt=${attempt}`);
          if (attempt < maxAttempts) await sleep(backoff(backoffBaseMs, attempt));
          continue;
        }

        if (response.ok) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (!looksLikeMp3(bytes)) {
            throw new Error(`Azure TTS ${request.label}: response was not MP3 audio (${bytes.length} bytes)`);
          }
          log(
            `azure tts ok: ${request.label} phoneme=${phoneme} status=${response.status} ` +
              `attempts=${attempt} bytes=${bytes.length}`,
          );
          return bytes;
        }

        if (response.status === 429 || response.status >= 500) {
          lastStatus = String(response.status);
          const retryAfter = Number(response.headers.get('retry-after'));
          const delay =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, MAX_WAIT_MS)
              : backoff(backoffBaseMs, attempt);
          log(`azure tts retry: ${request.label} status=${response.status} attempt=${attempt} wait=${delay}ms`);
          if (attempt < maxAttempts) await sleep(delay);
          continue;
        }

        // 400 (bad SSML or unrecognised phoneme), 401, 415 ...: retrying cannot help.
        const body = (await response.text()).slice(0, 300);
        log(`azure tts rejected: ${request.label} phoneme=${phoneme} status=${response.status}`);
        throw new Error(`Azure TTS ${request.label}: HTTP ${response.status}: ${body}`);
      }
      throw new Error(`Azure TTS ${request.label}: retries exhausted (last status: ${lastStatus})`);
    },
  };
}

function backoff(baseMs: number, attempt: number): number {
  return Math.min(baseMs * 2 ** (attempt - 1), MAX_WAIT_MS);
}
