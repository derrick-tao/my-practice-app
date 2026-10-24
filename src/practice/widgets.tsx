// Small pieces shared by the practice screen and the home screen's Keep going buttons.

/**
 * Progress is a climb: a numbered control for every item on a dotted trail. Finished ones are gold and ticked, the
 * one you are on is ringed. A long list shows no more than twelve controls; the count beside it says the rest.
 */
const MAX_CONTROLS = 12;

export function StarBar({ done, total }: { done: number; total: number }) {
  const controls = Math.min(total, MAX_CONTROLS);
  // Past twelve items the stops stand for a share of the list: any progress ticks the first stop, only a finished list ticks them all.
  const reached =
    total <= MAX_CONTROLS || done <= 0
      ? done
      : done >= total
        ? controls
        : Math.min(controls - 1, Math.ceil((done / total) * controls));
  return (
    <div class="starbar">
      <div
        class="starbar__track"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        {Array.from({ length: controls }, (_, i) => (
          <i key={i} class={`starbar__stop${i < reached ? ' starbar__stop--done' : i === reached ? ' starbar__stop--here' : ''}`}>
            {i === reached ? done + 1 : ''}
          </i>
        ))}
      </div>
      <span class="starbar__text" data-testid="progress-text">
        {done} / {total}
      </span>
    </div>
  );
}

/** Shown once the round is past the first one. */
export function RoundBadge({ index }: { index: number }) {
  if (index <= 1) return null;
  return (
    <span class="round-badge" data-testid="round-badge" role="img" aria-label={`Round ${index}`}>
      <span aria-hidden="true">🔁 {index}</span>
    </span>
  );
}
