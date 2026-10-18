import { contentUrl } from '../content/client.ts';

/**
 * Plays item audio through HTMLMediaElement (the Seam 1 stub records those play() calls).
 * One element per audio file is kept so repeat taps and preloading reuse it.
 */
export interface AudioPlayer {
  /**
   * Request playback from the start. Resolves true once playback started, false if the browser
   * rejected it (e.g. iOS blocking auto-play outside a user gesture).
   * Call it synchronously from the tap handler: that is what keeps iOS happy.
   */
  play(audioRef: string): Promise<boolean>;
  preload(audioRefs: readonly string[]): void;
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
  };
}
