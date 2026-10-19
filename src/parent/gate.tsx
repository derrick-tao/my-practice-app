// The parent gate: a multiplication question a first grader can't answer, entered on an on-screen
// number pad. A wrong answer gives a NEW question (never the same one twice in a row); no lockout.
//
// `ParentGate` is only the question. Where a pass leads is up to the caller: the parent area unlocks
// itself (parent/area.tsx), first-run setup moves to the next step, and ticket 09 uses it as a one-off
// confirmation before stopping a practice.
import { useState } from 'preact/hooks';

export interface GateQuestion {
  a: number;
  b: number;
}

const FACTORS = [6, 7, 8, 9] as const;

/** A random `a x b` with a and b from 6 to 9, different from `previous` when given. */
export function newGateQuestion(previous?: GateQuestion, random: () => number = Math.random): GateQuestion {
  for (;;) {
    const a = FACTORS[Math.floor(random() * FACTORS.length)]!;
    const b = FACTORS[Math.floor(random() * FACTORS.length)]!;
    if (!previous || previous.a !== a || previous.b !== b) return { a, b };
  }
}

const MAX_DIGITS = 3;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function ParentGate({ onPassed }: { onPassed: () => void }) {
  const [question, setQuestion] = useState(() => newGateQuestion());
  const [entry, setEntry] = useState('');
  const [missed, setMissed] = useState(false);

  const press = (digit: string): void => setEntry((current) => (current.length < MAX_DIGITS ? current + digit : current));

  const submit = (): void => {
    if (entry === '') return;
    if (Number(entry) === question.a * question.b) {
      onPassed();
      return;
    }
    setQuestion((previous) => newGateQuestion(previous));
    setEntry('');
    setMissed(true);
  };

  return (
    <section class="gate" aria-labelledby="gate-title">
      <h1 id="gate-title" class="gate__title">
        <span aria-hidden="true">🔒 </span>Grown-ups only
      </h1>
      <p class="gate__question" data-testid="gate-question">
        {question.a} × {question.b}
      </p>
      <p class="gate__answer" data-testid="gate-answer" aria-live="polite">
        {entry === '' ? '?' : entry}
      </p>
      {missed && (
        <p class="gate__missed" role="status">
          Not quite. Here is a new one!
        </p>
      )}
      <div class="numpad">
        {DIGITS.map((digit) => (
          <button type="button" class="numpad__key" key={digit} onClick={() => press(digit)}>
            {digit}
          </button>
        ))}
        <button type="button" class="numpad__key numpad__key--minor" onClick={() => setEntry((e) => e.slice(0, -1))}>
          <span aria-hidden="true">⌫</span>
          <span class="sr-only">Delete</span>
        </button>
        <button type="button" class="numpad__key" onClick={() => press('0')}>
          0
        </button>
        <button type="button" class="numpad__key numpad__key--ok" onClick={submit}>
          OK
        </button>
      </div>
    </section>
  );
}
