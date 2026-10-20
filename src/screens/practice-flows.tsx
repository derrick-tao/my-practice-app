// What differs between practice types on the practice screen. The screen (practice.tsx) owns what every type
// shares: the header, save and volume notices, break prompt, sounds, audio timing, saving, and completion. A
// type declares its flags and supplies its own stage (what the learner looks at) and controls (what they tap)
// here, so adding a type means adding an entry to FLOWS, not another branch through the screen.
import type { ComponentType } from "preact";
import type { ItemData, PracticeTypeId, Rendition } from "../content/types.ts";
import type { Mark, Round } from "../practice/session.ts";

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
}

export interface PracticeFlow {
  /**
   * The child hears the item first and writes it: its audio plays on arrival and after each mark, and Check waits
   * until it has been requested. Without it (the child reads the item and says it) nothing plays until Check.
   */
  audioFirst: boolean;
  /** The upper part of the screen. */
  Stage: ComponentType<FlowProps>;
  /** The buttons under the volume hint. */
  Controls: ComponentType<FlowProps>;
}

function ListenRow({ pulse, onListen }: Pick<FlowProps, "pulse" | "onListen">) {
  return (
    <div class="row">
      <button
        type="button"
        class={`btn btn--audio${pulse ? " pulse" : ""}`}
        onClick={() => onListen("normal")}
      >
        <span aria-hidden="true">🔊 </span>Listen
      </button>
      <button
        type="button"
        class="btn btn--audio"
        onClick={() => onListen("slow")}
      >
        <span aria-hidden="true">🐢 </span>Slow
      </button>
    </div>
  );
}

function CheckRow({ onCheck }: Pick<FlowProps, "onCheck">) {
  return (
    <button type="button" class="btn btn--primary btn--check" onClick={onCheck}>
      <span aria-hidden="true">👀 </span>Check
    </button>
  );
}

function MarkButtons({ onMark }: Pick<FlowProps, "onMark">) {
  return (
    <>
      <button
        type="button"
        class="btn btn--primary btn--good"
        onClick={() => onMark("correct")}
      >
        <span aria-hidden="true">✅ </span>I got it
      </button>
      <button
        type="button"
        class="btn btn--primary btn--bad"
        onClick={() => onMark("wrong")}
      >
        <span aria-hidden="true">❌ </span>Not yet
      </button>
    </>
  );
}

/** An item's target in the handwriting font. `fit`: as large as fits on one line (phrases, see .phrase in practice.css) rather than shrunk by its length. */
function TargetText({
  item,
  fit,
  testId,
}: {
  item: ItemData;
  fit: boolean;
  testId: string;
}) {
  return (
    <div
      class={fit ? "reveal__target phrase" : "reveal__target"}
      data-testid={testId}
      lang="zh-CN"
      style={
        fit
          ? { "--chars": [...item.target].length }
          : { "--scale": Math.max(1, [...item.target].length / 2) }
      }
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

/** Dictation: hear it, write it ("Write it!"), Check, then mark. */
const dictation: PracticeFlow = {
  audioFirst: true,
  Stage: ({ item, round }) =>
    round.phase === "revealed" ? (
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
        {props.round.phase === "prompt" && props.round.heardCurrent && (
          <CheckRow onCheck={props.onCheck} />
        )}
        {props.round.phase === "revealed" && (
          <MarkButtons onMark={props.onMark} />
        )}
      </div>
    </>
  ),
};

/** Phrase recognition: read the phrase, Check (which plays it), then mark. */
const phraseRecognition: PracticeFlow = {
  audioFirst: false,
  Stage: ({ item, round }) =>
    round.phase === "revealed" ? (
      <Reveal item={item} fit />
    ) : (
      <div class="reveal">
        <TargetText item={item} fit testId="prompt-phrase" />
      </div>
    ),
  Controls: (props) => (
    <>
      {props.round.phase === "revealed" && <ListenRow {...props} />}
      <div class="row row--primary">
        {props.round.phase === "prompt" && <CheckRow onCheck={props.onCheck} />}
        {props.round.phase === "revealed" && (
          <MarkButtons onMark={props.onMark} />
        )}
      </div>
    </>
  ),
};

export const FLOWS: Record<PracticeTypeId, PracticeFlow> = {
  dictation,
  "phrase-recognition": phraseRecognition,
};
