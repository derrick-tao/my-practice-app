import { pinyin } from 'pinyin-pro';

/** Tone-marked, space-separated pinyin for a target, e.g. "作业" -> "zuò yè". */
export function generatePinyin(target: string): string {
  return pinyin(target, { type: 'array', toneType: 'symbol' }).join(' ');
}

const syllables = (text: string): string[] => pinyin(text, { type: 'array', toneType: 'symbol' });

/**
 * The pinyin of an item: the authored value, else generated. When the clue contains the target, the
 * target's syllables are taken from the clue's reading, because the same character reads differently
 * by context (长 in 校长 is "zhǎng", alone it is "cháng"). Otherwise it is read from the target alone.
 */
export function itemPinyin(item: { target: string; clue?: string; pinyin?: string }): string {
  if (item.pinyin !== undefined) return item.pinyin;
  const at = item.clue?.indexOf(item.target) ?? -1;
  if (item.clue && at >= 0) {
    // pinyin-pro yields one entry per code point, so slice by code points, not UTF-16 units.
    const start = [...item.clue.slice(0, at)].length;
    const inContext = syllables(item.clue).slice(start, start + [...item.target].length);
    if (inContext.length === [...item.target].length) return inContext.join(' ');
  }
  return generatePinyin(item.target);
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
