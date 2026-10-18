import type { TtsConfig } from './config.ts';
import { toSapi } from '../pinyin.ts';

export interface PromptItem {
  target: string;
  clue?: string;
  say?: string;
}

/** What the audio says: the `say` override, else "target，clue的target", else the target alone. */
export function spokenPrompt(item: PromptItem): string {
  if (item.say) return item.say;
  if (item.clue) return `${item.target}，${item.clue}的${item.target}`;
  return item.target;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface SsmlOptions {
  /** Tone-marked pinyin of the target ("shén"); the source of the phoneme tags. */
  pinyin: string;
  /** False for providers that cannot carry phoneme markup (edge): the prompt is sent as plain text. */
  phonemes: boolean;
}

/**
 * Wrap a spoken prompt in SSML at the given rate.
 *
 * Standalone occurrences of the target (the first and last word of "target，clue的target", or the lone
 * target) are wrapped in a SAPI `<phoneme>` built from the item's pinyin, so 什/么/只/分 are read as
 * intended. The target inside the clue ("什么") is left alone, and a `say` override is spoken exactly as
 * written. The prompt is assembled from segments, never by searching the finished string.
 */
export function buildSsml(
  item: PromptItem,
  tts: Pick<TtsConfig, 'voice'>,
  rate: string,
  options: SsmlOptions,
): string {
  const standalone = options.phonemes
    ? `<phoneme alphabet="sapi" ph="${toSapi(options.pinyin)}">${escapeXml(item.target)}</phoneme>`
    : escapeXml(item.target);
  let body: string;
  if (item.say) body = escapeXml(item.say);
  else if (item.clue) body = `${standalone}，${escapeXml(item.clue)}的${standalone}`;
  else body = standalone;
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">` +
    `<voice name="${tts.voice}"><prosody rate="${rate}">${body}</prosody></voice>` +
    `</speak>`
  );
}
