// The blank of a math problem on screen: a drawn box (CSS, not a character). The learner's digits appear inside it and
// it keeps its size empty or filled. Empty it is announced as "blank"; filled, its digits are its text.

export function MathBlank({ value, testId, done = false }: { value: string | number; testId?: string; done?: boolean }) {
  const empty = value === '';
  return (
    <span
      class={`math__answer${done ? ' math__answer--done' : ''}`}
      data-testid={testId}
      role={empty ? 'img' : undefined}
      aria-label={empty ? 'blank' : undefined}
    >
      {value}
    </span>
  );
}
