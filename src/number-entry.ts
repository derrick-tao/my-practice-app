// How many digits the number pad takes, in one place: the pad (parent gate, math screens) stops at this many, and
// a math answer is read as at most this many (src/math/answer.ts). Three is enough for the biggest answer, 100.
export const MAX_DIGITS = 3;

/** The entry after the digit is tapped; a full entry ignores it. */
export const addDigit = (entry: string, digit: string): string => (entry.length < MAX_DIGITS ? entry + digit : entry);
