// Unofficial fallback: Microsoft Edge's read-aloud service through the msedge-tts package. No key needed.
// Limitation: the service accepts only a single <voice> with a single <prosody>, so it cannot carry
// <phoneme> markup. This provider therefore receives plain text (supportsPhonemes = false) and polyphones
// such as 什/么/只/分 can be read wrongly; give those items an explicit `say` override when using it.
import { looksLikeMp3 } from './mp3.ts';
import { defaultSleep, escapeXml, withRetries, type Sleep } from './retry.ts';
import type { TtsProvider, TtsRequest } from './types.ts';

export interface EdgeCall {
  /** XML-escaped text: msedge-tts wraps it in its own SSML template without escaping it. */
  text: string;
  voice: string;
  /** Prosody rate such as "-30%"; undefined for normal speed. */
  rate?: string;
  format: string;
}

export type EdgeTransport = (call: EdgeCall) => Promise<Uint8Array>;

export interface EdgeProviderOptions {
  transport?: EdgeTransport;
  sleep?: Sleep;
  log?: (line: string) => void;
}

const MAX_ATTEMPTS = 3;
const SUPPORTED_FORMATS = ['audio-24khz-48kbitrate-mono-mp3', 'audio-24khz-96kbitrate-mono-mp3'];

export function createEdgeProvider(options: EdgeProviderOptions = {}): TtsProvider {
  const transport = options.transport ?? msEdgeTransport;
  const sleep = options.sleep ?? defaultSleep;
  const log = options.log ?? (() => {});

  return {
    id: 'edge',
    extension: 'mp3',
    supportsPhonemes: false,

    async synthesize(request: TtsRequest): Promise<Uint8Array> {
      if (!SUPPORTED_FORMATS.includes(request.format)) {
        throw new Error(`Edge TTS supports only ${SUPPORTED_FORMATS.join(' or ')}, got "${request.format}"`);
      }
      const call: EdgeCall = {
        text: escapeXml(request.text),
        voice: request.voice,
        format: request.format,
        ...(request.rate !== '0%' && { rate: request.rate }),
      };
      const result = await withRetries<Uint8Array>(MAX_ATTEMPTS, sleep, async (attempt) => {
        try {
          const bytes = await transport(call);
          if (!looksLikeMp3(bytes)) throw new Error(`response was not MP3 audio (${bytes.length} bytes)`);
          log(`edge tts ok: ${request.label} phoneme=no attempts=${attempt} bytes=${bytes.length}`);
          return { value: bytes };
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          log(`edge tts retry: ${request.label} attempt=${attempt}: ${reason}`);
          return { retry: { reason, waitMs: 2_000 * attempt } };
        }
      });
      if ('value' in result) return result.value;
      throw new Error(`Edge TTS ${request.label} failed after ${MAX_ATTEMPTS} attempts: ${result.exhausted}`);
    },
  };
}

/** The real transport: one websocket synthesis through msedge-tts (loaded lazily, never in tests). */
const msEdgeTransport: EdgeTransport = async ({ text, voice, rate, format }) => {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const outputFormat =
    format === 'audio-24khz-96kbitrate-mono-mp3'
      ? OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
      : OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
  const tts = new MsEdgeTTS({ synthesisTimeoutMs: 30_000 });
  try {
    await tts.setMetadata(voice, outputFormat);
    const { audioStream } = tts.toStream(text, rate ? { rate } : {});
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('close', () => resolve());
      audioStream.on('error', reject);
    });
    return new Uint8Array(Buffer.concat(chunks));
  } finally {
    tts.close();
  }
};
