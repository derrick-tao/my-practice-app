// One on/off switch per published list: used by first-run setup and the "Assign lists" section.
import type { PublishedList } from '../content/use-lists.ts';
import { SwitchRow } from './switch-row.tsx';

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
          <SwitchRow
            key={list.id}
            on={on}
            title={list.title}
            meta={`${list.itemCount} ${list.itemCount === 1 ? 'character' : 'characters'}`}
            onToggle={() => !busy?.has(list.id) && onToggle(list.id, !on)}
          />
        );
      })}
    </ul>
  );
}
