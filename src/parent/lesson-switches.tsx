// One on/off switch per published lesson: used by first-run setup and the "Assign lessons" section.
import { itemCountOf, type PublishedLesson } from '../content/use-lessons.ts';
import { SwitchRow } from './switch-row.tsx';

export function LessonSwitches({
  lessons,
  assigned,
  onToggle,
  busy,
}: {
  lessons: PublishedLesson[];
  assigned: ReadonlySet<string>;
  onToggle: (lessonId: string, on: boolean) => void;
  /** Lesson ids whose change is being saved: their switch ignores taps. */
  busy?: ReadonlySet<string>;
}) {
  return (
    <ul class="switches">
      {lessons.map(({ lesson }) => {
        const on = assigned.has(lesson.id);
        const count = itemCountOf(lesson, 'dictation');
        return (
          <SwitchRow
            key={lesson.id}
            on={on}
            title={lesson.title}
            meta={`${count} ${count === 1 ? 'character' : 'characters'}`}
            onToggle={() => !busy?.has(lesson.id) && onToggle(lesson.id, !on)}
          />
        );
      })}
    </ul>
  );
}
