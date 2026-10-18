/**
 * Which real provider generates audio. The silent placeholder provider is not selectable here: it is
 * opt-in per run (`--fake-audio` / FAKE_AUDIO=1) so a misconfigured build can never ship silence.
 */
export type TtsProviderId = 'azure' | 'edge';

export interface TtsConfig {
  provider: TtsProviderId;
  voice: string;
  rates: { normal: string; slow: string };
  format: string;
}
