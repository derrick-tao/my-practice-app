// The on-screen number pad: digits, a delete key and OK. Shared by the parent gate and the math practice screens,
// so a child who has learnt one has learnt both. It holds no state: the caller owns the entry.
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function NumberPad({
  onDigit,
  onDelete,
  onSubmit,
}: {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
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
        OK
      </button>
    </div>
  );
}
