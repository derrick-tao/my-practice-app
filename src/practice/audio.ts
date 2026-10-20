import { useEffect, useMemo } from 'preact/hooks';
import { contentUrl } from '../content/client.ts';

/**
 * Plays item audio through HTMLMediaElement (the Seam 1 stub records those play() calls).
 * One element per audio file is kept so repeat taps and preloading reuse it.
 */
export interface AudioPlayer {
  /**
   * Request playback from the start. Resolves true once playback started, false if the browser
   * rejected it (e.g. iOS blocking auto-play outside a user gesture).
   * Call it synchronously from the tap handler, or from a timer of at most 1 s that the handler set:
   * that is what keeps iOS happy.
   */
  play(audioRef: string): Promise<boolean>;
  preload(audioRefs: readonly string[]): void;
  /** Stop and let go of every element, once the screen that owns the player is gone. */
  release(): void;
}

export function createAudioPlayer(): AudioPlayer {
  const elements = new Map<string, HTMLAudioElement>();
  const elementFor = (audioRef: string): HTMLAudioElement => {
    let element = elements.get(audioRef);
    if (!element) {
      element = new Audio(contentUrl(audioRef));
      element.preload = 'auto';
      elements.set(audioRef, element);
    }
    return element;
  };
  return {
    play(audioRef) {
      const element = elementFor(audioRef);
      try {
        element.currentTime = 0;
      } catch {
        // Not seekable yet (metadata still loading): it will play from the start anyway.
      }
      try {
        return Promise.resolve(element.play()).then(
          () => true,
          () => false,
        );
      } catch {
        return Promise.resolve(false);
      }
    },
    preload(audioRefs) {
      for (const audioRef of audioRefs) elementFor(audioRef);
    },
    release() {
      // Elements that were played and merely dropped stay alive in the browser, and the page slows down as they pile up.
      for (const element of elements.values()) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
      elements.clear();
    },
  };
}

/** A player for the life of the calling screen. */
export function useAudioPlayer(): AudioPlayer {
  const player = useMemo(createAudioPlayer, []);
  useEffect(() => () => player.release(), []);
  return player;
}
