// The "Are you sure?" panel for kid-facing destructive actions: a question with ✅ Yes / ❌ No. No
// destructive action takes a single tap (spec, Kid UI), so the action runs from `onYes`, never from
// the button that opened the panel.
import { useId } from 'preact/hooks';
import './confirm.css';

export function ConfirmYesNo({
  question,
  onYes,
  onNo,
  busy = false,
  flat = false,
}: {
  question: string;
  onYes: () => void;
  onNo: () => void;
  /** The answer is being saved: taps are ignored (a double tap cannot act twice). */
  busy?: boolean;
  /** For use inside a card: drops the panel's own border and background so it is not a card in a card. */
  flat?: boolean;
}) {
  const questionId = useId(); // several can be open at once
  return (
    <section class={flat ? 'confirm confirm--flat' : 'confirm'} aria-labelledby={questionId}>
      <p id={questionId} class="confirm__question">
        {question}
      </p>
      <div class="row row--primary">
        <button type="button" class="btn btn--primary btn--good" disabled={busy} onClick={onYes}>
          <span aria-hidden="true">✅ </span>Yes
        </button>
        <button type="button" class="btn btn--primary btn--danger" disabled={busy} onClick={onNo}>
          <span aria-hidden="true">❌ </span>No
        </button>
      </div>
    </section>
  );
}
