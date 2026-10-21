// The on-screen number pad: digits, a delete key and a submit key (OK by default). Shared by the parent gate and the math practice screens,
// so a child who has learnt one has learnt both. It holds no state: the caller owns the entry.
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function NumberPad({
  onDigit,
  onDelete,
  onSubmit,
  submitLabel = 'OK',
  submitName,
}: {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  /** What the submit key shows: the parent gate keeps OK, the math screens show a check-mark glyph. */
  submitLabel?: string;
  /** The submit key's accessible name when the label is only a glyph (the math screens say Check). */
  submitName?: string;
}) {
  return (
    <div class="numpad">
      {DIGITS.map((digit) => (
        <button type="button" class="numpad__key" key={digit} onClick={() => onDigit(digit)}>
          {digit}
        </button>
      ))}
      <button type="button" class="numpad__key numpad__key--minor" onClick={onDelete}>
        <span aria-hidden="true">⌫</span>
        <span class="sr-only">Delete</span>
      </button>
      <button type="button" class="numpad__key" onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" class="numpad__key numpad__key--ok" onClick={onSubmit}>
        {submitName === undefined ? (
          submitLabel
        ) : (
          <>
            <span aria-hidden="true" class="numpad__glyph">
              {submitLabel}
            </span>
            <span class="sr-only">{submitName}</span>
          </>
        )}
      </button>
    </div>
  );
}
