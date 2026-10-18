import { pinyin } from 'pinyin-pro';

/** Tone-marked, space-separated pinyin for a target, e.g. "作业" -> "zuò yè". */
export function generatePinyin(target: string): string {
  return pinyin(target, { type: 'array', toneType: 'symbol' }).join(' ');
}

/** The pinyin of an item: the authored value, else generated from the target. */
export function itemPinyin(item: { target: string; pinyin?: string }): string {
  return item.pinyin ?? generatePinyin(item.target);
}

const TONE_MARKS: Record<string, [base: string, tone: number]> = {
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['v', 1], ǘ: ['v', 2], ǚ: ['v', 3], ǜ: ['v', 4],
};

/**
 * Tone-marked pinyin ("shén me") to the SAPI phone string Azure expects ("shen 2 me 5"):
 * a tone digit after each syllable, neutral tone = 5, ü written as v.
 */
export function toSapi(pinyinText: string): string {
  return pinyinText
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((syllable) => {
      let tone = 5;
      let base = '';
      for (const char of syllable) {
        const marked = TONE_MARKS[char];
        if (marked) {
          base += marked[0];
          tone = marked[1];
        } else {
          base += char === 'ü' ? 'v' : char;
        }
      }
      return `${base} ${tone}`;
    })
    .join(' ');
}
