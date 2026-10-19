/**
 * Sound effects for ✅, ❌ and finishing: short, soft sounds in `public/sounds/` (see scripts/generate-sounds.ts),
 * played through HTMLMediaElement like the character audio. They are only played when the learner's sounds
 * setting is on; character audio never goes through here and ignores the setting.
 */
export type EffectName = 'chime' | 'gentle' | 'fanfare';

const EFFECTS: readonly EffectName[] = ['chime', 'gentle', 'fanfare'];

/** How long each file in public/sounds/ lasts, in ms (re-measure if scripts/generate-sounds.ts changes them). */
const LENGTH_MS: Record<EffectName, number> = { chime: 700, gentle: 750, fanfare: 1700 };

export interface Effects {
  /** Start the effect. Returns how long it will be heard for, in ms: 0 when the sounds setting is off. */
  play(name: EffectName): number;
}

export function createEffects(enabled: boolean): Effects {
  if (!enabled) return { play: () => 0 };
  const elements = new Map<EffectName, HTMLAudioElement>();
  const elementFor = (name: EffectName): HTMLAudioElement => {
    let element = elements.get(name);
    if (!element) {
      element = new Audio(`${import.meta.env.BASE_URL}sounds/${name}.wav`);
      element.preload = 'auto';
      element.volume = 0.7;
      elements.set(name, element);
    }
    return element;
  };
  // Fetched as practice opens so the first effect is not late (the service worker has them for offline).
  for (const name of EFFECTS) elementFor(name);
  return {
    play(name) {
      const element = elementFor(name);
      try {
        element.currentTime = 0;
        // A sound effect is never worth an error: if the browser refuses, the child just does not hear it.
        void Promise.resolve(element.play()).catch(() => undefined);
      } catch {
        // Not playable right now.
      }
      return LENGTH_MS[name];
    },
  };
}
