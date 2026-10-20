// What differs between practice types on the practice screen. The screen (practice.tsx) owns what every type
// shares: the header, save and volume notices, break prompt, sounds, audio timing, saving, and completion. A
// type declares its flags and supplies its own stage (what the learner looks at) and controls (what they tap)
// here, so adding a type means adding an entry to FLOWS, not another branch through the screen.
import type { ComponentChildren, ComponentType } from 'preact';
import type { ItemData, PracticeTypeId, Rendition } from '../content/types.ts';
import { DrawingScope, useDrawing } from '../practice/drawing.tsx';
import type { Mark, Round, SessionResult } from '../practice/session.ts';

/** What the screen hands a type's stage and controls for the item being practiced. */
export interface FlowProps {
  item: ItemData;
  round: Round;
  /** Auto-play for this item was refused by the browser: the Listen button pulses. */
  pulse: boolean;
  /** Request this item's audio; it is a tap, so it is allowed and cancels any held auto-play. */
  onListen: (rendition: Rendition) => void;
  onCheck: () => void;
  onMark: (result: Mark) => void;
  /** Move on from an item that is not graded (stroke order). */
  onNext: () => void;
}

/** What wraps an item's stage and controls, so they can share state that lasts as long as the item does. */
export interface ScopeProps {
  item: ItemData;
  children: ComponentChildren;
}

/** The scope of a type that needs none. */
export const NoScope = ({ children }: ScopeProps) => <>{children}</>;

export interface PracticeFlow {
  /**
   * The child hears the item first and writes it: its audio plays on arrival and after each mark, and Check waits
   * until it has been requested. Without it (the child reads the item and says it) nothing plays until Check.
   */
  audioFirst: boolean;
  /** What the completion screen says besides "You did it!". */
  completionLines: (result: SessionResult) => string[];
  /** Wraps the stage and controls of the item being practiced; the screen gives it a new key for each item. Default: none. */
  Scope?: ComponentType<ScopeProps>;
  /** The upper part of the screen. */
  Stage: ComponentType<FlowProps>;
  /** The buttons under the volume hint. */
  Controls: ComponentType<FlowProps>;
}

function ListenRow({ pulse, onListen }: Pick<FlowProps, 'pulse' | 'onListen'>) {
  return (
    <div class="row">
      <button type="button" class={`btn btn--audio${pulse ? ' pulse' : ''}`} onClick={() => onListen('normal')}>
        <span aria-hidden="true">🔊 </span>Listen
      </button>
      <button type="button" class="btn btn--audio" onClick={() => onListen('slow')}>
        <span aria-hidden="true">🐢 </span>Slow
      </button>
    </div>
  );
}

function CheckRow({ onCheck }: Pick<FlowProps, 'onCheck'>) {
  return (
    <button type="button" class="btn btn--primary btn--check" onClick={onCheck}>
      <span aria-hidden="true">👀 </span>Check
    </button>
  );
}

function MarkButtons({ onMark }: Pick<FlowProps, 'onMark'>) {
  return (
    <>
      <button type="button" class="btn btn--primary btn--good" onClick={() => onMark('correct')}>
        <span aria-hidden="true">✅ </span>I got it
      </button>
      <button type="button" class="btn btn--primary btn--bad" onClick={() => onMark('wrong')}>
        <span aria-hidden="true">❌ </span>Not yet
      </button>
    </>
  );
}

/** An item's target in the handwriting font. `fit`: as large as fits on one line (phrases, see .phrase in practice.css) rather than shrunk by its length. */
function TargetText({ item, fit, testId }: { item: ItemData; fit: boolean; testId: string }) {
  return (
    <div
      class={fit ? 'reveal__target phrase' : 'reveal__target'}
      data-testid={testId}
      lang="zh-CN"
      style={fit ? { '--chars': [...item.target].length } : { '--scale': Math.max(1, [...item.target].length / 2) }}
    >
      {item.target}
    </div>
  );
}

function Reveal({
  item,
  fit,
}: {
  item: ItemData;
  /** Fit the target on one line (phrases) rather than shrinking it by its length. */ fit: boolean;
}) {
  return (
    <div class="reveal">
      <TargetText item={item} fit={fit} testId="target" />
      <div class="reveal__pinyin">{item.pinyin}</div>
      {item.clue && <div class="reveal__clue">{item.clue}</div>}
    </div>
  );
}

/** The completion of a graded type: the first-try score and the number of rounds. */
const firstTryAndRounds = ({ firstTryCorrect, total, rounds }: SessionResult): string[] => [
  `${firstTryCorrect} of ${total} on the first try!`,
  `Rounds: ${rounds}`,
];

/** Dictation: hear it, write it ("Write it!"), Check, then mark. */
const dictation: PracticeFlow = {
  audioFirst: true,
  completionLines: firstTryAndRounds,
  Stage: ({ item, round }) =>
    round.phase === 'revealed' ? (
      <Reveal item={item} fit={false} />
    ) : (
      <p class="prompt">
        <span aria-hidden="true">✏️ </span>Write it!
      </p>
    ),
  Controls: (props) => (
    <>
      <ListenRow {...props} />
      <div class="row row--primary">
        {props.round.phase === 'prompt' && props.round.heardCurrent && <CheckRow onCheck={props.onCheck} />}
        {props.round.phase === 'revealed' && <MarkButtons onMark={props.onMark} />}
      </div>
    </>
  ),
};

/** Phrase recognition: read the phrase, Check (which plays it), then mark. */
const phraseRecognition: PracticeFlow = {
  audioFirst: false,
  completionLines: firstTryAndRounds,
  Stage: ({ item, round }) =>
    round.phase === 'revealed' ? (
      <Reveal item={item} fit />
    ) : (
      <div class="reveal">
        <TargetText item={item} fit testId="prompt-phrase" />
      </div>
    ),
  Controls: (props) => (
    <>
      {props.round.phase === 'revealed' && <ListenRow {...props} />}
      <div class="row row--primary">
        {props.round.phase === 'prompt' && <CheckRow onCheck={props.onCheck} />}
        {props.round.phase === 'revealed' && <MarkButtons onMark={props.onMark} />}
      </div>
    </>
  ),
};

/** Stroke order: hear the character, watch it drawn stroke by stroke, then Next. Nothing is graded. */
const strokeOrder: PracticeFlow = {
  audioFirst: true,
  completionLines: ({ total }) => [`${total} ${total === 1 ? 'character' : 'characters'} drawn`],
  Scope: DrawingScope,
  Stage: ({ item }) => {
    const drawing = useDrawing();
    return (
      <div class="reveal">
        <div class="drawing" data-testid="drawing" data-strokes-drawn={drawing.drawn} data-strokes-total={drawing.total}>
          <div class="drawing__canvas" ref={drawing.hostRef} role="img" aria-label="The character being drawn" />
        </div>
        {/* Always there, so the drawing does not move when the pinyin and clue appear. */}
        <div class="drawing__caption">
          {drawing.finished && (
            <>
              <div class="reveal__pinyin">{item.pinyin}</div>
              {item.clue && <div class="reveal__clue">{item.clue}</div>}
            </>
          )}
        </div>
      </div>
    );
  },
  Controls: (props) => {
    const drawing = useDrawing();
    return (
      <>
        <ListenRow {...props} />
        <div class="row row--primary">
          {drawing.finished ? (
            <button type="button" class="btn btn--primary btn--good" onClick={props.onNext}>
              <span aria-hidden="true">➡️ </span>Next
            </button>
          ) : drawing.playing ? (
            <button type="button" class="btn btn--primary" onClick={drawing.pause}>
              <span aria-hidden="true">⏸ </span>Pause
            </button>
          ) : (
            <>
              <button
                type="button"
                class="btn btn--primary"
                disabled={drawing.drawing || drawing.total === undefined}
                onClick={drawing.nextStroke}
              >
                <span aria-hidden="true">🖌️ </span>Next stroke
              </button>
              <button type="button" class="btn btn--primary" onClick={drawing.play}>
                <span aria-hidden="true">▶ </span>Play
              </button>
            </>
          )}
          {drawing.total !== undefined && (
            <button type="button" class="btn btn--primary" onClick={drawing.replay}>
              <span aria-hidden="true">↺ </span>Replay
            </button>
          )}
        </div>
      </>
    );
  },
};

export const FLOWS: Record<PracticeTypeId, PracticeFlow> = {
  dictation,
  'stroke-order': strokeOrder,
  'phrase-recognition': phraseRecognition,
};
