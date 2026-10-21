// One on/off switch per published lesson: used by first-run setup and the "Assign lessons" section.
import type { PublishedLesson } from '../content/use-lessons.ts';
import { listCountsLabel } from '../practice/practice-types.tsx';
import { SwitchRow } from './switch-row.tsx';

export function LessonSwitches({
  lessons,
  assigned,
  onToggle,
  busy,
  problemCount,
}: {
  lessons: PublishedLesson[];
  assigned: ReadonlySet<string>;
  onToggle: (lessonId: string, on: boolean) => void;
  /** Lesson ids whose change is being saved: their switch ignores taps. */
  busy?: ReadonlySet<string>;
  /** The learner's "Problems per practice", shown as the size of a math practice type (the default when omitted, for a learner not yet made). */
  problemCount?: number;
}) {
  return (
    <ul class="switches">
      {lessons.map(({ lesson }) => {
        const on = assigned.has(lesson.id);
        return (
          <SwitchRow
            key={lesson.id}
            on={on}
            title={lesson.title}
            meta={listCountsLabel(lesson, problemCount)}
            onToggle={() => !busy?.has(lesson.id) && onToggle(lesson.id, !on)}
          />
        );
      })}
    </ul>
  );
}
