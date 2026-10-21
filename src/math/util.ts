// Small helpers the math practice types share.

/** The minus sign as it is written on screen (not the keyboard hyphen). */
export const MINUS = '−';

/** The whole numbers from `from` to `to`, both included (empty when `to` is below `from`). */
export const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
