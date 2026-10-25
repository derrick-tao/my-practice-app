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
  /** Stop and let go of every element, once the screen that owns the effects is gone. */
  release(): void;
}

/**
 * One element per effect for the life of the practice screen that made them, released when it goes (like the
 * character audio). Elements shared for the life of the page were left behind in whatever state the browser had
 * put them in (iOS suspends idle media in a home-screen app), and the effects stayed silent until a reload; a
 * fresh set per screen that was never let go slowed the page instead.
 */
export function createEffects(enabled: boolean): Effects {
  if (!enabled) return { play: () => 0, release: () => undefined };
  const elements = new Map<EffectName, HTMLAudioElement>();
  const create = (name: EffectName): HTMLAudioElement => {
    const element = new Audio(`${import.meta.env.BASE_URL}sounds/${name}.wav`);
    element.preload = 'auto';
    element.volume = 0.7;
    elements.set(name, element);
    return element;
  };
  const discard = (element: HTMLAudioElement): void => {
    element.pause();
    element.removeAttribute('src');
    element.load();
  };
  const elementFor = (name: EffectName): HTMLAudioElement => elements.get(name) ?? create(name);
  /** A fresh element for a name whose element failed, so one bad element does not silence the effect for good. */
  const replace = (name: EffectName): HTMLAudioElement => {
    const old = elements.get(name);
    if (old) discard(old);
    return create(name);
  };
  const start = (element: HTMLAudioElement, name: EffectName, retry: boolean): void => {
    try {
      if (element.error) {
        start(replace(name), name, false);
        return;
      }
      element.currentTime = 0;
      // A sound effect is never worth an error: if the browser refuses, the child just does not hear it.
      Promise.resolve(element.play()).catch(() => {
        if (retry && elements.get(name) === element) start(replace(name), name, false);
      });
    } catch {
      // Not playable right now.
    }
  };
  // Fetched as practice opens so the first effect is not late (the service worker has them for offline).
  for (const name of EFFECTS) elementFor(name);
  return {
    play(name) {
      start(elementFor(name), name, true);
      return LENGTH_MS[name];
    },
    release() {
      for (const element of elements.values()) discard(element);
      elements.clear();
    },
  };
}
