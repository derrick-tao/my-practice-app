// The practice environment of the running app: real randomness, the clock and fresh ids. Tests pin their own.
import { createRandomSource } from './random.ts';
import type { PracticeEnv } from './session.ts';

export const realEnv = (): PracticeEnv => ({
  random: createRandomSource(),
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
});
