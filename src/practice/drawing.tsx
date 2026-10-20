// The stroke order drawing: a character's strokes drawn one at a time over a faint outline by Hanzi Writer, with
// stroke data read from the file the build bundled (never the library's CDN). DrawingScope owns everything about
// the drawing for one item, and the stage and controls (see practice-flows.tsx) read it through useDrawing, so
// the stage can show the character while the controls drive it. It plays by itself (a stroke, then a pause to copy
// it on paper); the child can replay it. Which stroke the drawing is on is screen state only and is not saved: a
// resumed session shows its character from the first stroke.
import HanziWriter, { type CharacterJson, type CharDataLoaderFn } from 'hanzi-writer';
import { createContext, type ComponentChildren, type RefObject } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { contentUrl } from '../content/client.ts';
import type { ItemData } from '../content/types.ts';
import type { ProfileSettings } from '../storage/types.ts';

export interface Drawing {
  /** The element the character is drawn into. */
  hostRef: RefObject<HTMLDivElement | null>;
  /** Strokes drawn so far. */
  drawn: number;
  /** The character's stroke count, once its data has loaded. */
  total: number | undefined;
  /** Fully drawn (or its data could not be loaded, which must not strand the child): the pinyin, clue and Next show. */
  finished: boolean;
  /** Clear the strokes and auto-play from the first. */
  replay: () => void;
}

const DrawingContext = createContext<Drawing | undefined>(undefined);

export function useDrawing(): Drawing {
  const drawing = useContext(DrawingContext);
  if (!drawing) throw new Error('useDrawing needs a DrawingScope');
  return drawing;
}

/** A faint gray for the outline of the whole character, the screen's ink for the strokes drawn. */
const OUTLINE_COLOR = '#dcd8e8';
const STROKE_COLOR = '#2b2250';

/**
 * The learner's stroke speed setting as Hanzi Writer's `strokeAnimationSpeed`. It draws a stroke in
 * (length + 600) / (3 * speed) ms, about 0.3 to 0.5 s at its default speed of 1, so normal (half that speed) gives
 * the 1 s or so a child can follow, slow about 2 s and fast about 0.5 s.
 */
const STROKE_ANIMATION_SPEEDS: Record<ProfileSettings['strokeSpeed'], number> = { slow: 0.25, normal: 0.5, fast: 1 };

/** Mount one item's drawing; give it a key per item so each character starts afresh. */
export function DrawingScope({
  item,
  strokeSpeed,
  strokePauseSeconds,
  children,
}: Pick<ProfileSettings, 'strokeSpeed' | 'strokePauseSeconds'> & { item: ItemData; children: ComponentChildren }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | undefined>(undefined);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [drawn, setDrawn] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Bumped by a replay and on unmount, so a stroke begun before it cannot count itself afterwards. */
  const run = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let mounted = true;
    const charDataLoader: CharDataLoaderFn = (_char, onLoad, onError) => {
      if (!item.strokes) return onError(new Error(`${item.target} has no stroke data`));
      fetch(contentUrl(item.strokes))
        .then((response) => {
          if (!response.ok) throw new Error(`Could not load ${item.strokes} (${response.status})`);
          return response.json() as Promise<CharacterJson>;
        })
        .then((data) => {
          if (mounted) setTotal(data.strokes.length);
          onLoad(data);
        }, onError);
    };
    const size = host.clientWidth;
    writer.current = HanziWriter.create(host, item.target, {
      width: size,
      height: size,
      padding: 8,
      showCharacter: false,
      showOutline: true,
      outlineColor: OUTLINE_COLOR,
      strokeColor: STROKE_COLOR,
      strokeAnimationSpeed: STROKE_ANIMATION_SPEEDS[strokeSpeed],
      charDataLoader,
      onLoadCharDataError: () => mounted && setFailed(true),
    });
    return () => {
      mounted = false;
      run.current++;
      void writer.current?.pauseAnimation(); // a stroke still being drawn stops with the screen
    };
  }, []);

  const nextStroke = (): void => {
    if (!writer.current || drawing || total === undefined || drawn >= total) return;
    const thisRun = run.current;
    setDrawing(true);
    void writer.current
      .animateStroke(drawn, {
        onComplete: ({ canceled }) => {
          if (canceled || thisRun !== run.current) return;
          setDrawn((n) => n + 1);
          setDrawing(false);
        },
      })
      .catch(() => setDrawing(false));
  };

  // Auto-play: the first stroke starts when the data has loaded (and again after a replay), each later one after the
  // pause. The timer goes when the child replays or leaves, so none outlives what it was waiting for.
  useEffect(() => {
    if (total === undefined || drawing || drawn >= total) return;
    if (drawn === 0) {
      nextStroke();
      return;
    }
    const timer = setTimeout(nextStroke, strokePauseSeconds * 1_000);
    return () => clearTimeout(timer);
  }, [total, drawing, drawn]);

  const replay = (): void => {
    run.current++;
    // Instant: the strokes go, the outline stays.
    void writer.current?.hideCharacter({ duration: 0 });
    setDrawn(0);
    setDrawing(false);
  };

  const finished = failed || (total !== undefined && drawn >= total);
  return (
    <DrawingContext.Provider value={{ hostRef, drawn, total, finished, replay }}>{children}</DrawingContext.Provider>
  );
}
