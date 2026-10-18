// One on/off switch per published list: used by first-run setup and the "Assign lists" section.
import type { PublishedList } from '../content/use-lists.ts';

export function ListSwitches({
  lists,
  assigned,
  onToggle,
  busy,
}: {
  lists: PublishedList[];
  assigned: ReadonlySet<string>;
  onToggle: (listId: string, on: boolean) => void;
  /** List ids whose change is being saved: their switch ignores taps. */
  busy?: ReadonlySet<string>;
}) {
  return (
    <ul class="switches">
      {lists.map(({ list }) => {
        const on = assigned.has(list.id);
        return (
          <li key={list.id}>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              class={`switch${on ? ' switch--on' : ''}`}
              onClick={() => !busy?.has(list.id) && onToggle(list.id, !on)}
            >
              <span class="switch__label">
                <span class="switch__title">{list.title}</span>
                <span class="switch__meta">
                  {list.itemCount} {list.itemCount === 1 ? 'character' : 'characters'}
                </span>
              </span>
              <span class="switch__track" aria-hidden="true">
                <span class="switch__thumb" />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
