// The single TTS config: provider, voice, rates and output format live here.
// Changing the voice (or any value below) changes the audio content hashes, so audio regenerates.
import type { TtsConfig } from './content-build/tts/config.ts';

export const ttsConfig: TtsConfig = {
  // 01 ships only the fake provider (silent placeholder audio).
  // 02 adds 'azure' (default) and 'edge' (unofficial fallback, behind this flag).
  provider: 'fake',
  voice: 'zh-CN-XiaoxiaoNeural',
  // Normal speed and slow (about -30%).
  rates: { normal: '0%', slow: '-30%' },
  format: 'audio-24khz-48kbitrate-mono-mp3',
};
