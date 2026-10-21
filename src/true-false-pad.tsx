// Two big buttons, True and False: how a true-or-false math problem is answered. Like the number pad it holds no
// state; one tap is the whole answer. Each has its own colour (blue and orange, a colour-blind-safe pair that is
// none of the app's purple, green or red) and keeps its word, so colour is never the only cue.
import './true-false-pad.css';

export function TrueFalsePad({ onAnswer }: { onAnswer: (answer: 'true' | 'false') => void }) {
  return (
    <div class="row row--primary true-false-pad">
      <button type="button" class="btn true-false-pad__button true-false-pad__button--true" onClick={() => onAnswer('true')}>
        True
      </button>
      <button type="button" class="btn true-false-pad__button true-false-pad__button--false" onClick={() => onAnswer('false')}>
        False
      </button>
    </div>
  );
}
