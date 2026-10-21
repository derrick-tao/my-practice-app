// Two big buttons, True and False: how a true-or-false math problem is answered. Like the number pad it holds no
// state; one tap is the whole answer.
import './true-false-pad.css';

export function TrueFalsePad({ onAnswer }: { onAnswer: (answer: 'true' | 'false') => void }) {
  return (
    <div class="row row--primary true-false-pad">
      <button type="button" class="btn btn--primary true-false-pad__button" onClick={() => onAnswer('true')}>
        True
      </button>
      <button type="button" class="btn btn--primary true-false-pad__button" onClick={() => onAnswer('false')}>
        False
      </button>
    </div>
  );
}
