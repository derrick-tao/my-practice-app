export type TtsProviderId = 'fake' | 'azure' | 'edge';

export interface TtsConfig {
  provider: TtsProviderId;
  voice: string;
  rates: { normal: string; slow: string };
  format: string;
}
