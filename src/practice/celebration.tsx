import { useEffect, useState } from 'preact/hooks';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const COLORS = ['#ff6b6b', '#ffc21a', '#4ecdc4', '#6c4ff5', '#ff9ff3'];
const PIECES = 40;

/** Follows the device's reduced-motion setting, including a change while the screen is open. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION).matches);
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION);
    const onChange = (): void => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * The party on the completion screen: confetti falls once, or, when the device asks for reduced motion,
 * a soft glow fades in and out instead (nothing moves). Pure decoration: it ignores taps and is hidden
 * from screen readers. Pieces are laid out from their index, so a re-render never reshuffles them.
 */
export function Celebration() {
  if (useReducedMotion()) {
    return <div class="completion-fade" data-testid="completion-fade" aria-hidden="true" />;
  }
  return (
    <div class="confetti" data-testid="confetti" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          class="confetti__piece"
          style={{
            left: `${(i * 37 + 11) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 8) * 0.18}s`,
            animationDuration: `${2.6 + (i % 5) * 0.45}s`,
            '--drift': `${((i * 53) % 21) - 10}vmin`,
            '--spin': `${360 + (i % 4) * 180}deg`,
          }}
        />
      ))}
    </div>
  );
}
