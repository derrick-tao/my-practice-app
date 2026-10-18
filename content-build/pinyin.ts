import { pinyin } from 'pinyin-pro';

/** Tone-marked, space-separated pinyin for a target, e.g. "作业" -> "zuò yè". */
export function generatePinyin(target: string): string {
  return pinyin(target, { type: 'array', toneType: 'symbol' }).join(' ');
}
