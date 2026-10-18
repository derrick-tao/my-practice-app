import type { TtsConfig } from './config.ts';
import { createFakeProvider } from './fake-provider.ts';
import type { TtsProvider } from './types.ts';

/**
 * Pick the provider named in tts.config.ts.
 *
 * TICKET-02 HOOK: add the 'azure' provider (credentials from AZURE_SPEECH_KEY / AZURE_SPEECH_REGION,
 * never written to disk or printed) and the 'edge' fallback here, and enforce the
 * "build needs audio but has no credentials" failure.
 */
export function createProvider(config: TtsConfig): TtsProvider {
  switch (config.provider) {
    case 'fake':
      return createFakeProvider();
    case 'azure':
    case 'edge':
      throw new Error(`TTS provider "${config.provider}" is not implemented yet (ticket 02).`);
  }
}
