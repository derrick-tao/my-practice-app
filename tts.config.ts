// The single TTS config: provider, voice, rates and output format live here.
// Changing the voice (or any value below) changes the audio content hashes, so audio regenerates.
import type { TtsConfig } from './content-build/tts/config.ts';

export const ttsConfig: TtsConfig = {
  // 'azure': Azure Neural TTS over REST. Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION, which only the
  //          main deploy workflow has. Honours <phoneme> markup, so standalone targets are read from their
  //          pinyin (什 shén, 么 me, 只 zhī, 分 fēn).
  // 'edge':  unofficial Microsoft Edge read-aloud service (msedge-tts), the fallback. Needs no key, but
  //          the service accepts only plain text with one voice and one prosody tag, so it CANNOT carry
  //          phoneme markup: the prompt is sent without phoneme tags and polyphones such as 什/么/只/分
  //          may be read wrongly. Give those items an explicit `say` override when using this provider.
  //          Best effort only: the service can change or block datacenter IPs without notice.
  // Audio file names hash the provider, so switching this flag regenerates audio (old files are removed
  // by `npm run audio:generate -- --prune`).
  provider: 'azure',
  voice: 'zh-CN-XiaoxiaoNeural',
  // Normal speed and slow (about -30%).
  rates: { normal: '0%', slow: '-30%' },
  format: 'audio-24khz-48kbitrate-mono-mp3',
};
