import type { TtsConfig } from './config.ts';

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

/**
 * Wrap a spoken prompt in SSML at the given rate.
 *
 * TICKET-02 HOOK: wrap standalone occurrences of the target in a `<phoneme>` tag derived from the
 * item's pinyin here (so 什/么/只/分 are read as intended). The result feeds the audio content hash.
 */
export function buildSsml(prompt: string, tts: Pick<TtsConfig, 'voice'>, rate: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">` +
    `<voice name="${tts.voice}"><prosody rate="${rate}">${escapeXml(prompt)}</prosody></voice>` +
    `</speak>`
  );
}
