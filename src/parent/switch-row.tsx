// One on/off switch row (a list item): the markup shared by the Settings toggles and the per-list switches.

export function SwitchRow({
  on,
  title,
  meta,
  onToggle,
}: {
  on: boolean;
  title: string;
  meta: string;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        class={`switch${on ? ' switch--on' : ''}`}
        onClick={onToggle}
      >
        <span class="switch__label">
          <span class="switch__title">{title}</span>
          <span class="switch__meta">{meta}</span>
        </span>
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>
    </li>
  );
}
