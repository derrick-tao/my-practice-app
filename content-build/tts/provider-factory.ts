import { createAzureProvider } from './azure-provider.ts';
import type { TtsConfig } from './config.ts';
import { createEdgeProvider, type EdgeTransport } from './edge-provider.ts';
import type { TtsProvider } from './types.ts';

export interface ProviderDeps {
  /** Defaults to process.env. Only AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are read, and only by azure. */
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (line: string) => void;
  /** Replaces the msedge-tts websocket call (tests). */
  edgeTransport?: EdgeTransport;
}

/**
 * Pick the provider named in tts.config.ts. Credentials are read from the environment at run time,
 * never from disk, and a missing key is not an error here: the build reports it (with the number of
 * audio files that needed it) only if some audio actually has to be generated.
 */
export function createProvider(config: TtsConfig, deps: ProviderDeps = {}): TtsProvider {
  switch (config.provider) {
    case 'azure':
      return createAzureProvider({
        env: deps.env ?? process.env,
        ...(deps.fetch && { fetch: deps.fetch }),
        ...(deps.sleep && { sleep: deps.sleep }),
        ...(deps.now && { now: deps.now }),
        ...(deps.log && { log: deps.log }),
      });
    case 'edge':
      return createEdgeProvider({
        ...(deps.edgeTransport && { transport: deps.edgeTransport }),
        ...(deps.sleep && { sleep: deps.sleep }),
        ...(deps.log && { log: deps.log }),
      });
  }
}
