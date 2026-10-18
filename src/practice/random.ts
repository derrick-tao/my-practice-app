// Injectable random source for shuffling. Production uses Math.random. Only the `e2e` build
// (vite --mode e2e, used by the Seam 1 tests) is seeded, so order is deterministic in tests and
// the seed hook does not exist in the deployed build (`import.meta.env.MODE` is replaced at build
// time, which lets the bundler drop the seeded branch).

/** Returns a number in [0, 1), like Math.random. */
export type RandomSource = () => number;

declare global {
  interface Window {
    /** Test builds only: seeds the practice random source (see tests/e2e/practice-driver.ts). */
    __practiceSeed?: number;
  }
}

const DEFAULT_TEST_SEED = 1;

function mulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh random source. Call once per new session so that a seeded build reproduces the same order. */
export function createRandomSource(): RandomSource {
  if (import.meta.env.MODE === 'e2e') return mulberry32(window.__practiceSeed ?? DEFAULT_TEST_SEED);
  return Math.random;
}

/** Fisher-Yates; returns a new array. */
export function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
